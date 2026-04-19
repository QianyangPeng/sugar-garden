/**
 * 糖糖花园 · Cloudflare Worker backend
 *
 * Endpoints:
 *   POST   /family                  Register new family (Turnstile + IP rate limit)
 *   GET    /family                  Fetch family settings + member list (auth)
 *   PATCH  /family                  Update settings (auth)
 *   POST   /family/rotate-token     Rotate family token (auth)
 *   POST   /member                  Join family as member (auth)
 *   PATCH  /member/:id              Update own member name (auth)
 *   GET    /sync?since=<ts>         Incremental pull: entries + school_sugar changed since ts (auth)
 *   POST   /entry                   Create or upsert entry (auth)
 *   DELETE /entry/:id               Soft-delete entry (auth)
 *   PUT    /school-sugar            Upsert school sugar for a date (auth)
 *
 * Auth: Bearer <familyToken>. Server hashes and looks up.
 * Member: X-Member-Id header (client-generated UUID) identifies the device/person.
 *
 * Configure secrets via `wrangler secret put`:
 *   TURNSTILE_SECRET — from Cloudflare Turnstile widget config
 *
 * Bindings (wrangler.toml):
 *   DB            — D1 database
 *   KV            — KV namespace for counters
 *   REG_LIMITER   — Rate Limit binding for /family registration (per IP)
 *   WRITE_LIMITER — Rate Limit binding for writes (per family)
 *   ALLOWED_ORIGIN — env var, e.g. "https://qianyangpeng.github.io"
 */

export interface Env {
  DB: D1Database;
  KV: KVNamespace;
  REG_LIMITER: { limit: (opts: { key: string }) => Promise<{ success: boolean }> };
  WRITE_LIMITER: { limit: (opts: { key: string }) => Promise<{ success: boolean }> };
  TURNSTILE_SECRET: string;
  ALLOWED_ORIGIN: string;
  MAX_REGISTRATIONS_PER_DAY: string;
}

const JSON_HEADERS = { "content-type": "application/json; charset=utf-8" };

function corsHeaders(env: Env): Record<string, string> {
  return {
    "access-control-allow-origin": env.ALLOWED_ORIGIN,
    "access-control-allow-methods": "GET,POST,PATCH,PUT,DELETE,OPTIONS",
    "access-control-allow-headers": "authorization,content-type,x-member-id,x-member-name,x-turnstile-token",
    "access-control-max-age": "86400",
    "vary": "origin",
  };
}

function json(body: unknown, status = 200, env?: Env): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...JSON_HEADERS, ...(env ? corsHeaders(env) : {}) },
  });
}

function err(msg: string, status = 400, env?: Env): Response {
  return json({ error: msg }, status, env);
}

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

function timingSafeEq(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function isUuid(s: unknown): s is string {
  return typeof s === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

function isYmd(s: unknown): s is string {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function clampStr(s: unknown, max: number, fallback = ""): string {
  if (typeof s !== "string") return fallback;
  return s.slice(0, max);
}

function clampNum(n: unknown, min: number, max: number, fallback: number): number {
  const v = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(v)) return fallback;
  return Math.max(min, Math.min(max, v));
}

async function verifyTurnstile(token: string, ip: string, env: Env): Promise<boolean> {
  if (!token) return false;
  const body = new FormData();
  body.append("secret", env.TURNSTILE_SECRET);
  body.append("response", token);
  if (ip) body.append("remoteip", ip);
  try {
    const r = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST", body,
    });
    const data = await r.json() as { success?: boolean };
    return data.success === true;
  } catch {
    return false;
  }
}

type Family = {
  id: string;
  token_hash: string;
  child_name: string;
  date_of_birth: string;
  daily_limit: number;
  created_at: number;
  updated_at: number;
  last_activity_at: number;
};

async function authFamily(req: Request, env: Env): Promise<{ family: Family; token: string } | Response> {
  const authz = req.headers.get("authorization") || "";
  if (!authz.startsWith("Bearer ")) return err("missing bearer", 401, env);
  const token = authz.slice(7).trim();
  if (token.length < 20 || token.length > 256) return err("bad token", 401, env);
  const hash = await sha256Hex(token);
  const row = await env.DB.prepare("SELECT * FROM families WHERE token_hash = ?").bind(hash).first<Family>();
  if (!row) return err("unauthorized", 401, env);
  return { family: row, token };
}

async function touchFamily(env: Env, familyId: string): Promise<void> {
  await env.DB.prepare("UPDATE families SET last_activity_at = ? WHERE id = ?")
    .bind(Date.now(), familyId).run();
}

async function upsertMember(env: Env, familyId: string, memberId: string, name: string | null): Promise<void> {
  const now = Date.now();
  const existing = await env.DB.prepare("SELECT id FROM members WHERE id = ? AND family_id = ?")
    .bind(memberId, familyId).first();
  if (existing) {
    if (name) {
      await env.DB.prepare("UPDATE members SET name = ?, last_seen_at = ? WHERE id = ?")
        .bind(name, now, memberId).run();
    } else {
      await env.DB.prepare("UPDATE members SET last_seen_at = ? WHERE id = ?")
        .bind(now, memberId).run();
    }
  } else {
    await env.DB.prepare("INSERT INTO members (id, family_id, name, joined_at, last_seen_at) VALUES (?, ?, ?, ?, ?)")
      .bind(memberId, familyId, name || "家人", now, now).run();
  }
}

async function rateLimitRegister(env: Env, ip: string): Promise<{ ok: boolean; reason?: string }> {
  // Per-IP burst: use CF Rate Limit binding
  const bucket = await env.REG_LIMITER.limit({ key: `reg:${ip}` });
  if (!bucket.success) return { ok: false, reason: "ip-rate" };

  // Global daily circuit breaker in KV
  const today = new Date().toISOString().slice(0, 10);
  const max = Number(env.MAX_REGISTRATIONS_PER_DAY) || 1000;
  const cur = Number(await env.KV.get(`reg:${today}`)) || 0;
  if (cur >= max) return { ok: false, reason: "global-cap" };
  await env.KV.put(`reg:${today}`, String(cur + 1), { expirationTtl: 86400 * 2 });
  return { ok: true };
}

async function rateLimitWrite(env: Env, familyId: string): Promise<boolean> {
  const bucket = await env.WRITE_LIMITER.limit({ key: `w:${familyId}` });
  return bucket.success;
}

// ---------------- handlers ----------------

async function handleRegister(req: Request, env: Env, ip: string): Promise<Response> {
  const turnstile = req.headers.get("x-turnstile-token") || "";
  const limited = await rateLimitRegister(env, ip);
  if (!limited.ok) {
    if (limited.reason === "global-cap") {
      return err("registration_paused", 503, env);
    }
    return err("too_many_requests", 429, env);
  }
  const okTurnstile = await verifyTurnstile(turnstile, ip, env);
  if (!okTurnstile) return err("turnstile_failed", 403, env);

  let body: any;
  try { body = await req.json(); } catch { return err("invalid_json", 400, env); }
  const familyId = body?.familyId;
  const tokenHash = body?.tokenHash;
  if (!isUuid(familyId)) return err("bad_family_id", 400, env);
  if (typeof tokenHash !== "string" || tokenHash.length !== 64 || !/^[0-9a-f]+$/.test(tokenHash)) {
    return err("bad_token_hash", 400, env);
  }
  const memberId = body?.memberId;
  const memberName = clampStr(body?.memberName, 32, "家人");
  if (!isUuid(memberId)) return err("bad_member_id", 400, env);

  const childName = clampStr(body?.childName, 32, "");
  const dob = isYmd(body?.dateOfBirth) ? body.dateOfBirth : "";
  const dailyLimit = clampNum(body?.dailyLimit, 5, 60, 19);
  const now = Date.now();

  try {
    await env.DB.prepare(
      `INSERT INTO families (id, token_hash, child_name, date_of_birth, daily_limit, created_at, updated_at, last_activity_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(familyId, tokenHash, childName, dob, dailyLimit, now, now, now).run();
  } catch (e: any) {
    const msg = String(e?.message || e);
    if (msg.includes("UNIQUE")) return err("family_exists", 409, env);
    return err("db_error", 500, env);
  }
  await upsertMember(env, familyId, memberId, memberName);
  return json({ ok: true, familyId }, 201, env);
}

async function handleGetFamily(auth: { family: Family }, env: Env, memberId: string | null, memberName: string | null): Promise<Response> {
  if (memberId && isUuid(memberId)) await upsertMember(env, auth.family.id, memberId, memberName || null);
  await touchFamily(env, auth.family.id);
  const members = await env.DB.prepare(
    "SELECT id, name, joined_at, last_seen_at FROM members WHERE family_id = ? ORDER BY joined_at ASC"
  ).bind(auth.family.id).all();
  return json({
    family: {
      id: auth.family.id,
      childName: auth.family.child_name,
      dateOfBirth: auth.family.date_of_birth,
      dailyLimit: auth.family.daily_limit,
      updatedAt: auth.family.updated_at,
    },
    members: members.results || [],
  }, 200, env);
}

async function handlePatchFamily(req: Request, auth: { family: Family }, env: Env): Promise<Response> {
  if (!(await rateLimitWrite(env, auth.family.id))) return err("too_many_requests", 429, env);
  let body: any;
  try { body = await req.json(); } catch { return err("invalid_json", 400, env); }
  const patch: string[] = [];
  const args: any[] = [];
  if (typeof body.childName === "string") { patch.push("child_name = ?"); args.push(clampStr(body.childName, 32, "")); }
  if (typeof body.dateOfBirth === "string") {
    if (body.dateOfBirth !== "" && !isYmd(body.dateOfBirth)) return err("bad_dob", 400, env);
    patch.push("date_of_birth = ?"); args.push(body.dateOfBirth);
  }
  if (body.dailyLimit !== undefined) { patch.push("daily_limit = ?"); args.push(clampNum(body.dailyLimit, 5, 60, 19)); }
  if (!patch.length) return err("no_changes", 400, env);
  const now = Date.now();
  patch.push("updated_at = ?"); args.push(now);
  patch.push("last_activity_at = ?"); args.push(now);
  args.push(auth.family.id);
  await env.DB.prepare(`UPDATE families SET ${patch.join(", ")} WHERE id = ?`).bind(...args).run();
  return json({ ok: true }, 200, env);
}

async function handleRotateToken(req: Request, auth: { family: Family }, env: Env): Promise<Response> {
  if (!(await rateLimitWrite(env, auth.family.id))) return err("too_many_requests", 429, env);
  let body: any;
  try { body = await req.json(); } catch { return err("invalid_json", 400, env); }
  const newHash = body?.tokenHash;
  if (typeof newHash !== "string" || newHash.length !== 64 || !/^[0-9a-f]+$/.test(newHash)) {
    return err("bad_token_hash", 400, env);
  }
  const now = Date.now();
  await env.DB.prepare("UPDATE families SET token_hash = ?, updated_at = ?, last_activity_at = ? WHERE id = ?")
    .bind(newHash, now, now, auth.family.id).run();
  return json({ ok: true }, 200, env);
}

async function handleJoinMember(req: Request, auth: { family: Family }, env: Env, memberId: string | null): Promise<Response> {
  let body: any;
  try { body = await req.json(); } catch { return err("invalid_json", 400, env); }
  const name = clampStr(body?.name, 32, "家人");
  const mid = isUuid(memberId) ? memberId : isUuid(body?.memberId) ? body.memberId : null;
  if (!mid) return err("bad_member_id", 400, env);
  await upsertMember(env, auth.family.id, mid, name);
  await touchFamily(env, auth.family.id);
  return json({ ok: true, memberId: mid }, 200, env);
}

async function handleUpdateMember(req: Request, auth: { family: Family }, env: Env, targetId: string): Promise<Response> {
  if (!isUuid(targetId)) return err("bad_member_id", 400, env);
  let body: any;
  try { body = await req.json(); } catch { return err("invalid_json", 400, env); }
  const name = clampStr(body?.name, 32, "");
  if (!name) return err("bad_name", 400, env);
  const r = await env.DB.prepare("UPDATE members SET name = ?, last_seen_at = ? WHERE id = ? AND family_id = ?")
    .bind(name, Date.now(), targetId, auth.family.id).run();
  if (!r.success) return err("db_error", 500, env);
  return json({ ok: true }, 200, env);
}

async function handleSync(url: URL, auth: { family: Family }, env: Env): Promise<Response> {
  const since = Number(url.searchParams.get("since") || "0") || 0;
  const entries = await env.DB.prepare(
    `SELECT id, member_id AS memberId, date, ts, food_id AS foodId, name, emoji, sugar, category, updated_at AS updatedAt, deleted_at AS deletedAt
     FROM entries WHERE family_id = ? AND updated_at > ? ORDER BY updated_at ASC LIMIT 5000`
  ).bind(auth.family.id, since).all();
  const school = await env.DB.prepare(
    `SELECT date, sugar, updated_at AS updatedAt FROM school_sugar WHERE family_id = ? AND updated_at > ? ORDER BY updated_at ASC LIMIT 2000`
  ).bind(auth.family.id, since).all();
  await touchFamily(env, auth.family.id);
  return json({
    entries: entries.results || [],
    schoolSugar: school.results || [],
    now: Date.now(),
  }, 200, env);
}

async function handlePutEntry(req: Request, auth: { family: Family }, env: Env, memberId: string | null): Promise<Response> {
  if (!(await rateLimitWrite(env, auth.family.id))) return err("too_many_requests", 429, env);
  let body: any;
  try { body = await req.json(); } catch { return err("invalid_json", 400, env); }
  const id = body?.id;
  if (typeof id !== "string" || id.length < 8 || id.length > 64) return err("bad_entry_id", 400, env);
  const date = body?.date;
  if (!isYmd(date)) return err("bad_date", 400, env);
  const ts = clampNum(body?.ts, 0, Date.now() + 86400000, Date.now());
  const foodId = body?.foodId ? clampStr(body.foodId, 32) : null;
  const name = clampStr(body?.name, 48, "");
  const emoji = clampStr(body?.emoji, 8, "🍴");
  const sugar = clampNum(body?.sugar, 0, 500, 0);
  const category = clampStr(body?.category, 16, "snack");
  const mid = isUuid(memberId) ? memberId : null;
  const now = Date.now();
  if (!name) return err("bad_name", 400, env);

  // UPSERT idempotent on id; only overwrite if incoming updated_at newer (last-write-wins)
  const existing = await env.DB.prepare("SELECT updated_at FROM entries WHERE id = ? AND family_id = ?")
    .bind(id, auth.family.id).first<{ updated_at: number }>();
  if (existing) {
    if (existing.updated_at >= now) return json({ ok: true, skipped: true }, 200, env);
    await env.DB.prepare(
      `UPDATE entries SET member_id = ?, date = ?, ts = ?, food_id = ?, name = ?, emoji = ?, sugar = ?, category = ?, updated_at = ?, deleted_at = NULL WHERE id = ? AND family_id = ?`
    ).bind(mid, date, ts, foodId, name, emoji, sugar, category, now, id, auth.family.id).run();
  } else {
    await env.DB.prepare(
      `INSERT INTO entries (id, family_id, member_id, date, ts, food_id, name, emoji, sugar, category, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(id, auth.family.id, mid, date, ts, foodId, name, emoji, sugar, category, now).run();
  }
  await touchFamily(env, auth.family.id);
  return json({ ok: true, updatedAt: now }, 200, env);
}

async function handleDeleteEntry(auth: { family: Family }, env: Env, id: string): Promise<Response> {
  if (!(await rateLimitWrite(env, auth.family.id))) return err("too_many_requests", 429, env);
  if (typeof id !== "string" || id.length < 8 || id.length > 64) return err("bad_entry_id", 400, env);
  const now = Date.now();
  await env.DB.prepare("UPDATE entries SET deleted_at = ?, updated_at = ? WHERE id = ? AND family_id = ?")
    .bind(now, now, id, auth.family.id).run();
  await touchFamily(env, auth.family.id);
  return json({ ok: true, updatedAt: now }, 200, env);
}

async function handlePutSchoolSugar(req: Request, auth: { family: Family }, env: Env): Promise<Response> {
  if (!(await rateLimitWrite(env, auth.family.id))) return err("too_many_requests", 429, env);
  let body: any;
  try { body = await req.json(); } catch { return err("invalid_json", 400, env); }
  const date = body?.date;
  if (!isYmd(date)) return err("bad_date", 400, env);
  const sugar = clampNum(body?.sugar, 0, 200, 0);
  const now = Date.now();
  await env.DB.prepare(
    `INSERT INTO school_sugar (family_id, date, sugar, updated_at) VALUES (?, ?, ?, ?)
     ON CONFLICT(family_id, date) DO UPDATE SET sugar = excluded.sugar, updated_at = excluded.updated_at`
  ).bind(auth.family.id, date, sugar, now).run();
  await touchFamily(env, auth.family.id);
  return json({ ok: true, updatedAt: now }, 200, env);
}

async function cleanupInactive(env: Env, ctx: ExecutionContext): Promise<void> {
  const cutoff = Date.now() - 60 * 86400 * 1000;
  await env.DB.prepare("DELETE FROM families WHERE last_activity_at < ?").bind(cutoff).run();
  // Cascade should handle members/entries/school_sugar.
  // KV reg:<date> entries expire via TTL; nothing else to do.
}

// ---------------- router ----------------

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(req.url);
    const method = req.method.toUpperCase();
    const ip = req.headers.get("cf-connecting-ip") || "0.0.0.0";

    if (method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(env) });
    }

    try {
      // Public: register
      if (url.pathname === "/family" && method === "POST") {
        return await handleRegister(req, env, ip);
      }

      // Everything else needs auth
      if (url.pathname === "/health" && method === "GET") {
        return json({ ok: true, now: Date.now() }, 200, env);
      }

      const authOrRes = await authFamily(req, env);
      if (authOrRes instanceof Response) return authOrRes;

      const memberId = req.headers.get("x-member-id");
      const memberName = req.headers.get("x-member-name");

      if (url.pathname === "/family" && method === "GET") {
        return await handleGetFamily(authOrRes, env, memberId, memberName);
      }
      if (url.pathname === "/family" && method === "PATCH") {
        return await handlePatchFamily(req, authOrRes, env);
      }
      if (url.pathname === "/family/rotate-token" && method === "POST") {
        return await handleRotateToken(req, authOrRes, env);
      }
      if (url.pathname === "/member" && method === "POST") {
        return await handleJoinMember(req, authOrRes, env, memberId);
      }
      const mm = url.pathname.match(/^\/member\/([^\/]+)$/);
      if (mm && method === "PATCH") {
        return await handleUpdateMember(req, authOrRes, env, mm[1]);
      }
      if (url.pathname === "/sync" && method === "GET") {
        return await handleSync(url, authOrRes, env);
      }
      if (url.pathname === "/entry" && method === "POST") {
        return await handlePutEntry(req, authOrRes, env, memberId);
      }
      const em = url.pathname.match(/^\/entry\/([^\/]+)$/);
      if (em && method === "DELETE") {
        return await handleDeleteEntry(authOrRes, env, em[1]);
      }
      if (url.pathname === "/school-sugar" && method === "PUT") {
        return await handlePutSchoolSugar(req, authOrRes, env);
      }

      return err("not_found", 404, env);
    } catch (e: any) {
      return err(`internal: ${String(e?.message || e).slice(0, 200)}`, 500, env);
    }
  },

  async scheduled(_ev: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(cleanupInactive(env, ctx));
  },
};
