// Data layer: food library, flowers, state, calculations.
// Adapted from design handoff. Changes vs original:
//  - Flower RNG seeded by familyId (not childName) so all family members agree.
//  - LS key namespaced to 'sg:state'; identity lives in 'sg:identity'.
//  - Added updatedAt tracking on entries + schoolSugar for incremental sync.
//  - Added merge helpers for inbound server data.

// -------- Food library (24 items, 4 categories) --------
const FOOD_LIBRARY = [
  { id: 'lollipop',   name: '棒棒糖',        emoji: '🍭', sugar: 6,  category: 'snack' },
  { id: 'gummy',      name: '软糖',          emoji: '🍬', sugar: 4,  category: 'snack' },
  { id: 'chocolate',  name: '巧克力',        emoji: '🍫', sugar: 12, category: 'snack' },
  { id: 'cookie',     name: '饼干',          emoji: '🍪', sugar: 5,  category: 'snack' },
  { id: 'marshmallow',name: '棉花糖',        emoji: '☁️', sugar: 7,  category: 'snack' },
  { id: 'icecream',   name: '冰淇淋',        emoji: '🍦', sugar: 14, category: 'snack' },
  { id: 'pudding',    name: '布丁',          emoji: '🍮', sugar: 10, category: 'snack' },
  { id: 'yogurt',     name: '酸奶',          emoji: '🥛', sugar: 8,  category: 'snack' },
  { id: 'juice',      name: '果汁',          emoji: '🧃', sugar: 18, category: 'drink' },
  { id: 'soda',       name: '汽水',          emoji: '🥤', sugar: 26, category: 'drink' },
  { id: 'milktea',    name: '奶茶小杯',      emoji: '🧋', sugar: 22, category: 'drink' },
  { id: 'cocoa',      name: '热可可',        emoji: '☕', sugar: 14, category: 'drink' },
  { id: 'sportsdrink',name: '运动饮料',      emoji: '🍶', sugar: 12, category: 'drink' },
  { id: 'apple',      name: '苹果(半个)',    emoji: '🍎', sugar: 9,  category: 'fruit', natural: true },
  { id: 'banana',     name: '香蕉',          emoji: '🍌', sugar: 12, category: 'fruit', natural: true },
  { id: 'grape',      name: '葡萄',          emoji: '🍇', sugar: 10, category: 'fruit', natural: true },
  { id: 'strawberry', name: '草莓',          emoji: '🍓', sugar: 4,  category: 'fruit', natural: true },
  { id: 'watermelon', name: '西瓜片',        emoji: '🍉', sugar: 9,  category: 'fruit', natural: true },
  { id: 'orange',     name: '橙子',          emoji: '🍊', sugar: 12, category: 'fruit', natural: true },
  { id: 'donut',      name: '甜甜圈',        emoji: '🍩', sugar: 15, category: 'bakery' },
  { id: 'cake',       name: '小蛋糕',        emoji: '🍰', sugar: 20, category: 'bakery' },
  { id: 'muffin',     name: '麦芬',          emoji: '🧁', sugar: 17, category: 'bakery' },
  { id: 'croissant',  name: '甜面包',        emoji: '🥐', sugar: 8,  category: 'bakery' },
  { id: 'honey',      name: '蜂蜜',          emoji: '🍯', sugar: 17, category: 'bakery' },
];

const CATEGORY_META = {
  snack:  { name: '零食', color: '#ff7ab0' },
  drink:  { name: '饮料', color: '#7ec4ff' },
  fruit:  { name: '水果', color: '#7ad9b5' },
  bakery: { name: '烘焙', color: '#ffd24a' },
};

// -------- Flower species --------
const FLOWERS = {
  'c-tulip':     { name: '郁金香', rarity: 'common', petal: '#ff9ec4', center: '#ffd24a', shape: 'tulip' },
  'c-daisy':     { name: '雏菊',   rarity: 'common', petal: '#f2e9ff', center: '#ffd24a', shape: 'daisy' },
  'c-sunflower': { name: '向日葵', rarity: 'common', petal: '#ffd24a', center: '#7c4a1d', shape: 'sunflower' },
  'c-poppy':     { name: '罂粟',   rarity: 'common', petal: '#ff5c6c', center: '#2b2033', shape: 'poppy' },
  'c-cosmos':    { name: '波斯菊', rarity: 'common', petal: '#b892ff', center: '#ffd24a', shape: 'cosmos' },
  'c-marigold':  { name: '万寿菊', rarity: 'common', petal: '#ffb085', center: '#c2453c', shape: 'marigold' },
  'c-bluebell':  { name: '风铃草', rarity: 'common', petal: '#7ec4ff', center: '#7ec4ff', shape: 'bluebell' },
  'c-pansy':     { name: '三色堇', rarity: 'common', petal: '#b892ff', center: '#ffd24a', shape: 'pansy' },
  'r-moonflower':  { name: '月光花', rarity: 'rare', petal: '#e0e6ff', center: '#b892ff', shape: 'moonflower', desc: '只在糖分很少的夜晚开放' },
  'r-crystalrose': { name: '水晶玫瑰', rarity: 'rare', petal: '#a0e7f0', center: '#ffffff', shape: 'crystalrose', desc: '晶莹剔透的梦想之花' },
  'r-rainbowlily': { name: '彩虹百合', rarity: 'rare', petal: 'rainbow', center: '#ffd24a', shape: 'rainbowlily', desc: '承载着今天的好心情' },
  'r-stardust':    { name: '星砂花', rarity: 'rare', petal: '#2b2058', center: '#ffd24a', shape: 'stardust', desc: '花瓣上带着星星' },
  'r-honeybee':    { name: '蜂蜜花', rarity: 'rare', petal: '#ffd24a', center: '#7c4a1d', shape: 'honeybee', desc: '小蜜蜂最爱的花' },
  'u-emerald':  { name: '翡翠花', rarity: 'unlock', petal: '#5bc08c', center: '#ffd24a', shape: 'emerald',  desc: '连续 3 天达标解锁', unlockStreak: 3 },
  'u-sakura':   { name: '樱花',   rarity: 'unlock', petal: '#ffc7d8', center: '#ffffff', shape: 'sakura',   desc: '连续 5 天达标解锁', unlockStreak: 5 },
  'u-phoenix':  { name: '凤凰花', rarity: 'unlock', petal: '#ff5c6c', center: '#ffd24a', shape: 'phoenix',  desc: '连续 7 天达标解锁', unlockStreak: 7 },
};

function qualityFromRatio(r) {
  if (r >= 1.3) return 'dead';
  if (r >= 1.0) return 'wilted';
  if (r >= 0.9) return 'okish';
  if (r >= 0.7) return 'ok';
  if (r >= 0.4) return 'great';
  return 'perfect';
}

function pickFlowerForDay({ ratio, dateStr, unlockedUnlocks, streakToday, seed }) {
  const q = qualityFromRatio(ratio);
  if (q === 'dead' || q === 'wilted') return { speciesId: null, quality: q };

  const rng = mulberry32(hashStr(dateStr + '-' + (seed || 'x')));

  if (ratio < 0.5) {
    if (rng() < 0.18) {
      const rares = Object.keys(FLOWERS).filter(k => FLOWERS[k].rarity === 'rare');
      const pick = rares[Math.floor(rng() * rares.length)];
      return { speciesId: pick, quality: q };
    }
  }

  if (streakToday >= 3) {
    const u = Object.keys(FLOWERS).filter(k => FLOWERS[k].rarity === 'unlock');
    const eligible = u.filter(k => streakToday >= FLOWERS[k].unlockStreak);
    if (eligible.length && rng() < 0.5) {
      return { speciesId: eligible[eligible.length - 1], quality: q };
    }
  }

  const commons = Object.keys(FLOWERS).filter(k => FLOWERS[k].rarity === 'common');
  const pick = commons[Math.floor(rng() * commons.length)];
  return { speciesId: pick, quality: q };
}

function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function mulberry32(a) {
  return function() {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = a;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// -------- Time / date helpers --------
function ymd(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function parseYMD(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}
function isWeekday(dateStr) {
  const d = parseYMD(dateStr);
  const dow = d.getDay();
  return dow >= 1 && dow <= 5;
}

const DAY_START_HOUR = 7;
const DAY_END_HOUR = 22;
const SEGMENTS = [
  { id: 'morning',   label: '上午', emoji: '🌅', start: 7,  end: 12 },
  { id: 'afternoon', label: '下午', emoji: '☀️', start: 12, end: 17 },
  { id: 'evening',   label: '晚上', emoji: '🌙', start: 17, end: 22 },
];
function segmentFor(hour) {
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  return 'evening';
}
function expectedProgress(now) {
  const h = now.getHours() + now.getMinutes() / 60;
  if (h <= DAY_START_HOUR) return 0;
  if (h >= DAY_END_HOUR) return 1;
  return (h - DAY_START_HOUR) / (DAY_END_HOUR - DAY_START_HOUR);
}

// -------- localStorage keys --------
const LS_STATE = 'sg:state';
const LS_IDENTITY = 'sg:identity';
const LS_PENDING = 'sg:pending';

function loadState() {
  try { const r = localStorage.getItem(LS_STATE); if (r) return JSON.parse(r); } catch(e){}
  return null;
}
function saveState(s) {
  try { localStorage.setItem(LS_STATE, JSON.stringify(s)); } catch(e){}
}

function defaultState() {
  return {
    settings: {
      childName: '',
      dateOfBirth: '',
      dailyLimit: 19,
      wakeHour: 7,
      onboarded: false,
      settingsUpdatedAt: 0,
    },
    // Per-day: { date, schoolSugar, schoolSugarUpdatedAt, entries: [...], planted, flower }
    days: {},
    unlockedUnlocks: [],
    lastOpenedDate: null,
    ui: { seenOverage: {} },
    members: [],
    lastSyncAt: 0,
  };
}

function ageFromDob(dob) {
  if (!dob) return 4;
  const b = parseYMD(dob);
  const now = new Date();
  let a = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) a--;
  return Math.max(1, a);
}
function defaultLimitByAge(age) {
  if (age <= 3) return 15;
  if (age <= 6) return 19;
  if (age <= 10) return 24;
  return 30;
}

function ensureDay(state, date) {
  if (state.days[date]) return state;
  return { ...state, days: { ...state.days, [date]: {
    date, schoolSugar: 0, schoolSugarUpdatedAt: 0, entries: [], planted: false, flower: null,
  }}};
}

function addEntry(state, { foodId, name, emoji, sugar, category, memberId }) {
  const now = new Date();
  const date = ymd(now);
  let next = ensureDay(state, date);
  const entry = {
    id: 'e_' + Math.random().toString(36).slice(2,9) + now.getTime(),
    ts: now.getTime(),
    foodId: foodId || null,
    memberId: memberId || null,
    name, emoji, sugar: Number(sugar) || 0,
    category: category || 'snack',
    updatedAt: now.getTime(),
    deleted: false,
    _pending: true,
  };
  next = { ...next, days: { ...next.days, [date]: {
    ...next.days[date], entries: [...next.days[date].entries, entry]
  }}};
  saveState(next);
  return { state: next, entry };
}

function removeEntry(state, date, id) {
  if (!state.days[date]) return state;
  const now = Date.now();
  const next = { ...state, days: { ...state.days, [date]: {
    ...state.days[date],
    entries: state.days[date].entries.map(e =>
      e.id === id ? { ...e, deleted: true, updatedAt: now, _pending: true } : e
    ),
  }}};
  saveState(next);
  return next;
}

function setSchoolSugar(state, date, sugar) {
  const now = Date.now();
  let next = ensureDay(state, date);
  next = { ...next, days: { ...next.days, [date]: {
    ...next.days[date],
    schoolSugar: Math.max(0, Number(sugar) || 0),
    schoolSugarUpdatedAt: now,
    _schoolPending: true,
  }}};
  saveState(next);
  return next;
}

function updateSettings(state, patch) {
  const now = Date.now();
  const next = { ...state, settings: {
    ...state.settings, ...patch, settingsUpdatedAt: now, _settingsPending: true,
  }};
  saveState(next);
  return next;
}

function totalForDay(day) {
  if (!day) return 0;
  const live = (day.entries || []).filter(e => !e.deleted);
  return (day.schoolSugar || 0) + live.reduce((a, e) => a + (e.sugar || 0), 0);
}

function dayStatus(state, date, atTime) {
  const day = state.days[date];
  const total = totalForDay(day);
  const limit = state.settings.dailyLimit;
  const now = atTime || new Date();
  const expected = expectedProgress(now);
  const actualRatio = total / limit;
  const target = Math.max(0.05, expected);
  let health;
  if (actualRatio <= target * 0.9) health = 'thriving';
  else if (actualRatio <= target * 1.1) health = 'ok';
  else if (actualRatio <= 1.0) health = 'stressed';
  else health = 'wilting';
  const liveEntries = (day?.entries || []).filter(e => !e.deleted);
  return { total, limit, ratio: actualRatio, expected, health, school: day?.schoolSugar || 0, entries: liveEntries };
}

function computeStreak(state, uptoDate) {
  let streak = 0;
  const d = parseYMD(uptoDate);
  for (let i = 0; i < 30; i++) {
    const dd = new Date(d); dd.setDate(dd.getDate() - i);
    const key = ymd(dd);
    const day = state.days[key];
    if (!day) break;
    const total = totalForDay(day);
    const r = total / state.settings.dailyLimit;
    if (r >= 1.0) break;
    streak++;
  }
  return streak;
}

function plantFlowerFor(state, date, familyId) {
  const day = state.days[date];
  if (!day || day.planted) return { state, newlyPlanted: null, newUnlocks: [] };
  const total = totalForDay(day);
  const r = state.settings.dailyLimit > 0 ? total / state.settings.dailyLimit : 0;
  const streak = computeStreak(state, date);
  const flower = pickFlowerForDay({
    ratio: r, dateStr: date, unlockedUnlocks: state.unlockedUnlocks, streakToday: streak,
    seed: familyId || 'local',
  });
  const newUnlocks = [];
  for (const key of Object.keys(FLOWERS)) {
    const f = FLOWERS[key];
    if (f.rarity !== 'unlock') continue;
    if (streak >= f.unlockStreak && !state.unlockedUnlocks.includes(key)) newUnlocks.push(key);
  }
  const next = {
    ...state,
    days: { ...state.days, [date]: { ...day, planted: true, flower } },
    unlockedUnlocks: [...state.unlockedUnlocks, ...newUnlocks],
  };
  saveState(next);
  return { state: next, newlyPlanted: { date, flower }, newUnlocks };
}

function unplantedPastDays(state) {
  const today = ymd(new Date());
  const out = [];
  for (const key of Object.keys(state.days)) {
    if (key < today && !state.days[key].planted) out.push(key);
  }
  out.sort();
  return out;
}

function monthData(state, refDate) {
  const base = refDate || new Date();
  const year = base.getFullYear();
  const month = base.getMonth();
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const startDow = first.getDay();
  const mondayStart = ((startDow + 6) % 7);
  const cells = [];
  for (let i = 0; i < mondayStart; i++) cells.push(null);
  for (let d = 1; d <= last.getDate(); d++) {
    const date = ymd(new Date(year, month, d));
    const day = state.days[date];
    cells.push({ date, day: d, data: day || null });
  }
  return { year, month, cells };
}

function trendData(state, days) {
  const out = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now); d.setDate(d.getDate() - i);
    const date = ymd(d);
    const day = state.days[date];
    out.push({ date, total: totalForDay(day), dow: d.getDay(), day: d.getDate(), limit: state.settings.dailyLimit });
  }
  return out;
}

// -------- Server merge helpers --------

// Merge server-side entries into state. Server is source of truth for id+updatedAt pairs.
function mergeServerEntries(state, rows) {
  if (!rows || !rows.length) return state;
  const next = { ...state, days: { ...state.days } };
  for (const r of rows) {
    const date = r.date;
    if (!next.days[date]) {
      next.days[date] = { date, schoolSugar: 0, schoolSugarUpdatedAt: 0, entries: [], planted: false, flower: null };
    } else {
      next.days[date] = { ...next.days[date], entries: [...next.days[date].entries] };
    }
    const entries = next.days[date].entries;
    const existingIdx = entries.findIndex(e => e.id === r.id);
    const incoming = {
      id: r.id,
      ts: Number(r.ts),
      foodId: r.foodId || null,
      memberId: r.memberId || null,
      name: r.name,
      emoji: r.emoji,
      sugar: Number(r.sugar) || 0,
      category: r.category || 'snack',
      updatedAt: Number(r.updatedAt),
      deleted: !!r.deletedAt,
    };
    if (existingIdx === -1) {
      entries.push(incoming);
    } else {
      const prev = entries[existingIdx];
      if ((prev.updatedAt || 0) < incoming.updatedAt) {
        entries[existingIdx] = incoming;
      }
    }
    // Re-plant may need to be invalidated if the day's total changed
    if (next.days[date].planted) {
      next.days[date] = { ...next.days[date], planted: false, flower: null };
    }
  }
  saveState(next);
  return next;
}

function mergeServerSchoolSugar(state, rows) {
  if (!rows || !rows.length) return state;
  const next = { ...state, days: { ...state.days } };
  for (const r of rows) {
    const date = r.date;
    const ts = Number(r.updatedAt);
    if (!next.days[date]) {
      next.days[date] = { date, schoolSugar: Number(r.sugar) || 0, schoolSugarUpdatedAt: ts, entries: [], planted: false, flower: null };
    } else {
      const cur = next.days[date];
      if ((cur.schoolSugarUpdatedAt || 0) < ts) {
        next.days[date] = { ...cur, schoolSugar: Number(r.sugar) || 0, schoolSugarUpdatedAt: ts, planted: false, flower: null };
      }
    }
  }
  saveState(next);
  return next;
}

function applyServerFamily(state, family, members) {
  let next = { ...state };
  if (family) {
    const serverTs = Number(family.updatedAt) || 0;
    const localTs = Number(next.settings.settingsUpdatedAt) || 0;
    if (serverTs > localTs) {
      next = { ...next, settings: {
        ...next.settings,
        childName: family.childName || '',
        dateOfBirth: family.dateOfBirth || '',
        dailyLimit: Number(family.dailyLimit) || 19,
        onboarded: true,
        settingsUpdatedAt: serverTs,
      }};
    } else if (!next.settings.onboarded && family.childName) {
      // Joiner case: mark onboarded once we have a name.
      next = { ...next, settings: { ...next.settings, onboarded: true, childName: family.childName || next.settings.childName, dateOfBirth: family.dateOfBirth || next.settings.dateOfBirth, dailyLimit: Number(family.dailyLimit) || next.settings.dailyLimit, settingsUpdatedAt: serverTs || Date.now() } };
    }
  }
  if (members) {
    next = { ...next, members };
  }
  saveState(next);
  return next;
}

// Strip _pending markers on an entry after server ack.
function markEntrySynced(state, id) {
  const next = { ...state, days: { ...state.days } };
  for (const d of Object.keys(next.days)) {
    next.days[d] = { ...next.days[d], entries: next.days[d].entries.map(e => e.id === id ? { ...e, _pending: false } : e) };
  }
  saveState(next);
  return next;
}
function markSchoolSynced(state, date) {
  if (!state.days[date]) return state;
  const next = { ...state, days: { ...state.days, [date]: { ...state.days[date], _schoolPending: false } } };
  saveState(next);
  return next;
}
function markSettingsSynced(state) {
  const next = { ...state, settings: { ...state.settings, _settingsPending: false } };
  saveState(next);
  return next;
}

Object.assign(window, {
  FOOD_LIBRARY, CATEGORY_META, FLOWERS, SEGMENTS,
  DAY_START_HOUR, DAY_END_HOUR,
  LS_STATE, LS_IDENTITY, LS_PENDING,
  ymd, parseYMD, isWeekday, segmentFor, expectedProgress,
  loadState, saveState, defaultState,
  ageFromDob, defaultLimitByAge,
  ensureDay, addEntry, removeEntry, setSchoolSugar, updateSettings,
  totalForDay, dayStatus, computeStreak, pickFlowerForDay, qualityFromRatio,
  plantFlowerFor, unplantedPastDays,
  monthData, trendData,
  mergeServerEntries, mergeServerSchoolSugar, applyServerFamily,
  markEntrySynced, markSchoolSynced, markSettingsSynced,
});
