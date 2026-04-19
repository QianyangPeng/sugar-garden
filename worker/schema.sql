-- 糖糖花园 · Cloudflare D1 schema
-- Append-only entries. Families + members per family. Server never stores plaintext tokens.

CREATE TABLE IF NOT EXISTS families (
  id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL,
  child_name TEXT NOT NULL DEFAULT '',
  date_of_birth TEXT NOT NULL DEFAULT '',
  daily_limit INTEGER NOT NULL DEFAULT 19,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  last_activity_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_families_last_activity ON families(last_activity_at);

CREATE TABLE IF NOT EXISTS members (
  id TEXT PRIMARY KEY,
  family_id TEXT NOT NULL,
  name TEXT NOT NULL,
  joined_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL,
  FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_members_family ON members(family_id);

-- Food entries. Append-only. Soft delete via deleted_at so sync can propagate deletions.
CREATE TABLE IF NOT EXISTS entries (
  id TEXT PRIMARY KEY,
  family_id TEXT NOT NULL,
  member_id TEXT,
  date TEXT NOT NULL,               -- YYYY-MM-DD
  ts INTEGER NOT NULL,              -- epoch ms when event occurred
  food_id TEXT,
  name TEXT NOT NULL,
  emoji TEXT NOT NULL,
  sugar REAL NOT NULL,
  category TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER,
  FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_entries_family_updated ON entries(family_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_entries_family_date ON entries(family_id, date);

-- One row per (family_id, date) for in-school sugar amount. Upsert, last-write-wins.
CREATE TABLE IF NOT EXISTS school_sugar (
  family_id TEXT NOT NULL,
  date TEXT NOT NULL,
  sugar REAL NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (family_id, date),
  FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_school_sugar_family_updated ON school_sugar(family_id, updated_at);

-- Daily counters for global circuit-breaker. Key: "reg:YYYY-MM-DD" or "fam:<id>:YYYY-MM-DD-HH".
-- Stored in KV instead; this table is a fallback for audit.
CREATE TABLE IF NOT EXISTS registration_log (
  day TEXT NOT NULL,
  ip TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (day, ip)
);
