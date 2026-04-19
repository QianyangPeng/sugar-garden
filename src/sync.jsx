// Sync layer: identity, server API, offline queue, invite links.
// Runs alongside data.jsx. Keeps network concerns out of UI code.

// ---------- runtime config ----------
// SG_CONFIG is injected by index.html (see <script> block there).
// Fields: { apiUrl: 'https://sugar-garden.<user>.workers.dev', turnstileSiteKey: '0x...' }
const CFG = (typeof window !== 'undefined' && window.SG_CONFIG) || { apiUrl: '', turnstileSiteKey: '' };

// ---------- identity ----------
function loadIdentity() {
  try { const r = localStorage.getItem(LS_IDENTITY); if (r) return JSON.parse(r); } catch {}
  return null;
}
function saveIdentity(id) {
  try { localStorage.setItem(LS_IDENTITY, JSON.stringify(id)); } catch {}
}
function clearIdentity() {
  try { localStorage.removeItem(LS_IDENTITY); } catch {}
}

function uuid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const hex = Array.from(b).map(x => x.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}

function randomToken(bytes = 32) {
  const b = crypto.getRandomValues(new Uint8Array(bytes));
  // base64url (no padding, URL-safe)
  let s = btoa(String.fromCharCode(...b));
  return s.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function sha256Hex(input) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// ---------- invite link parsing ----------
function parseInviteFragment() {
  if (typeof location === 'undefined') return null;
  const h = location.hash || '';
  const m = h.match(/join=([0-9a-f-]+)\.([A-Za-z0-9_-]+)/i);
  if (!m) return null;
  return { familyId: m[1], token: m[2] };
}

function clearInviteFragment() {
  if (typeof history === 'undefined' || !history.replaceState) return;
  try { history.replaceState(null, '', location.pathname + location.search); } catch {}
}

function buildInviteUrl(familyId, token) {
  const base = location.origin + location.pathname;
  return `${base}#join=${familyId}.${token}`;
}

// ---------- Turnstile ----------
// The Turnstile script renders a widget on demand. We call renderTurnstile(elementId)
// once during the new-family flow; it resolves with a token or null if config missing.
function renderTurnstile(container) {
  return new Promise((resolve) => {
    if (!CFG.turnstileSiteKey) { resolve(null); return; }
    if (!window.turnstile) {
      // script not loaded yet
      const waitStart = Date.now();
      const iv = setInterval(() => {
        if (window.turnstile) {
          clearInterval(iv);
          doRender();
        } else if (Date.now() - waitStart > 8000) {
          clearInterval(iv);
          resolve(null);
        }
      }, 120);
      return;
    }
    doRender();
    function doRender() {
      try {
        window.turnstile.render(container, {
          sitekey: CFG.turnstileSiteKey,
          theme: 'light',
          size: 'flexible',
          callback: (t) => resolve(t),
          'error-callback': () => resolve(null),
          'timeout-callback': () => resolve(null),
        });
      } catch { resolve(null); }
    }
  });
}

// ---------- low-level API ----------
async function apiFetch(path, opts = {}) {
  if (!CFG.apiUrl) throw new Error('no_api_url');
  const url = CFG.apiUrl.replace(/\/$/, '') + path;
  const r = await fetch(url, opts);
  let body = null;
  try { body = await r.json(); } catch {}
  if (!r.ok) {
    const err = new Error((body && body.error) || `http_${r.status}`);
    err.status = r.status;
    err.body = body;
    throw err;
  }
  return body;
}

function authHeaders(token, memberId, memberName) {
  const h = { 'authorization': `Bearer ${token}`, 'content-type': 'application/json' };
  if (memberId) h['x-member-id'] = memberId;
  if (memberName) h['x-member-name'] = memberName;
  return h;
}

const api = {
  async register({ familyId, token, memberId, memberName, childName, dateOfBirth, dailyLimit, turnstileToken }) {
    const tokenHash = await sha256Hex(token);
    return apiFetch('/family', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-turnstile-token': turnstileToken || '' },
      body: JSON.stringify({ familyId, tokenHash, memberId, memberName, childName, dateOfBirth, dailyLimit }),
    });
  },
  async getFamily(token, memberId, memberName) {
    return apiFetch('/family', { method: 'GET', headers: authHeaders(token, memberId, memberName) });
  },
  async patchFamily(token, memberId, patch) {
    return apiFetch('/family', { method: 'PATCH', headers: authHeaders(token, memberId), body: JSON.stringify(patch) });
  },
  async rotateToken(token, memberId, newToken) {
    const tokenHash = await sha256Hex(newToken);
    return apiFetch('/family/rotate-token', { method: 'POST', headers: authHeaders(token, memberId), body: JSON.stringify({ tokenHash }) });
  },
  async joinMember(token, memberId, name) {
    return apiFetch('/member', { method: 'POST', headers: authHeaders(token, memberId), body: JSON.stringify({ memberId, name }) });
  },
  async updateMember(token, memberId, targetId, name) {
    return apiFetch(`/member/${encodeURIComponent(targetId)}`, { method: 'PATCH', headers: authHeaders(token, memberId), body: JSON.stringify({ name }) });
  },
  async sync(token, memberId, since) {
    const q = since ? `?since=${encodeURIComponent(since)}` : '';
    return apiFetch(`/sync${q}`, { method: 'GET', headers: authHeaders(token, memberId) });
  },
  async putEntry(token, memberId, entry) {
    return apiFetch('/entry', { method: 'POST', headers: authHeaders(token, memberId), body: JSON.stringify(entry) });
  },
  async deleteEntry(token, memberId, id) {
    return apiFetch(`/entry/${encodeURIComponent(id)}`, { method: 'DELETE', headers: authHeaders(token, memberId) });
  },
  async putSchoolSugar(token, memberId, date, sugar) {
    return apiFetch('/school-sugar', { method: 'PUT', headers: authHeaders(token, memberId), body: JSON.stringify({ date, sugar }) });
  },
};

// ---------- high-level flows ----------

// Create a new family. Returns identity + initial family payload.
async function createNewFamily({ turnstileToken, childName, dateOfBirth, dailyLimit, memberName }) {
  const identity = {
    familyId: uuid(),
    token: randomToken(32),
    memberId: uuid(),
    memberName: memberName || '家人',
    createdAt: Date.now(),
    role: 'creator',
  };
  await api.register({
    familyId: identity.familyId,
    token: identity.token,
    memberId: identity.memberId,
    memberName: identity.memberName,
    childName: childName || '',
    dateOfBirth: dateOfBirth || '',
    dailyLimit: dailyLimit || 19,
    turnstileToken,
  });
  saveIdentity(identity);
  return identity;
}

// Join an existing family by invite fragment.
// inviteFrag = {familyId, token}
async function joinFamily(inviteFrag, memberName) {
  const identity = {
    familyId: inviteFrag.familyId,
    token: inviteFrag.token,
    memberId: uuid(),
    memberName: memberName || '家人',
    createdAt: Date.now(),
    role: 'joiner',
  };
  // Hit /family to validate token exists
  const payload = await api.getFamily(identity.token, identity.memberId, identity.memberName);
  // Register member
  await api.joinMember(identity.token, identity.memberId, identity.memberName);
  saveIdentity(identity);
  return { identity, payload };
}

// Do a full sync pass: pull incremental, push pending ops.
// Returns a {state, touched} where touched = true if any remote change landed.
async function syncAll(state, identity, { onState } = {}) {
  if (!identity || !CFG.apiUrl) return { state, touched: false };
  let cur = state;
  let touched = false;

  // 1. Pull family settings + member list (cheap, always)
  try {
    const fam = await api.getFamily(identity.token, identity.memberId, identity.memberName);
    cur = applyServerFamily(cur, fam.family, fam.members);
    touched = true;
    onState?.(cur);
  } catch (e) {
    if (e.status === 401) return { state: cur, touched: false, authError: true };
    // non-auth errors: continue
  }

  // 2. Pull incremental entries + school_sugar
  try {
    const since = Number(cur.lastSyncAt) || 0;
    const data = await api.sync(identity.token, identity.memberId, since);
    if (data.entries?.length) { cur = mergeServerEntries(cur, data.entries); touched = true; }
    if (data.schoolSugar?.length) { cur = mergeServerSchoolSugar(cur, data.schoolSugar); touched = true; }
    const serverNow = Number(data.now) || Date.now();
    cur = { ...cur, lastSyncAt: serverNow };
    saveState(cur);
    onState?.(cur);
  } catch (e) {
    if (e.status === 401) return { state: cur, touched, authError: true };
  }

  // 3. Push pending ops
  cur = await flushPending(cur, identity, { onState });
  return { state: cur, touched };
}

// Walk state for pending flags and push them. Idempotent — on failure, flag stays set.
async function flushPending(state, identity, { onState } = {}) {
  if (!identity || !CFG.apiUrl) return state;
  let cur = state;

  // Settings
  if (cur.settings._settingsPending) {
    try {
      await api.patchFamily(identity.token, identity.memberId, {
        childName: cur.settings.childName,
        dateOfBirth: cur.settings.dateOfBirth,
        dailyLimit: cur.settings.dailyLimit,
      });
      cur = markSettingsSynced(cur);
      onState?.(cur);
    } catch (e) { if (e.status === 401) return cur; }
  }

  for (const date of Object.keys(cur.days)) {
    const day = cur.days[date];

    // school sugar
    if (day._schoolPending) {
      try {
        await api.putSchoolSugar(identity.token, identity.memberId, date, day.schoolSugar || 0);
        cur = markSchoolSynced(cur, date);
        onState?.(cur);
      } catch (e) { if (e.status === 401) return cur; }
    }

    // entries
    for (const e of day.entries) {
      if (!e._pending) continue;
      try {
        if (e.deleted) {
          await api.deleteEntry(identity.token, identity.memberId, e.id);
        } else {
          await api.putEntry(identity.token, identity.memberId, {
            id: e.id, date, ts: e.ts, foodId: e.foodId, name: e.name,
            emoji: e.emoji, sugar: e.sugar, category: e.category,
          });
        }
        cur = markEntrySynced(cur, e.id);
        onState?.(cur);
      } catch (err) { if (err.status === 401) return cur; }
    }
  }
  return cur;
}

// Rotate the family token (logical "reset invite link"). New token replaces old in DB.
// All other members must re-paste a fresh invite link.
async function rotateFamilyToken(identity) {
  const newToken = randomToken(32);
  await api.rotateToken(identity.token, identity.memberId, newToken);
  const updated = { ...identity, token: newToken };
  saveIdentity(updated);
  return updated;
}

Object.assign(window, {
  SG_CONFIG: CFG,
  loadIdentity, saveIdentity, clearIdentity,
  uuid, randomToken, sha256Hex,
  parseInviteFragment, clearInviteFragment, buildInviteUrl,
  renderTurnstile,
  api, createNewFamily, joinFamily,
  syncAll, flushPending,
  rotateFamilyToken,
});
