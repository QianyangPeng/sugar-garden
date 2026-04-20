// Data layer: food library, flowers, state, calculations.
//
// v2 model (gacha + pacing):
//  - Flowers grouped into 5 rarity tiers: R / SR / SSR / SSSR / UR
//  - Each new day the kid spins a wheel (rarity then species). Result is deterministic
//    per family+date+pullIndex, so family members see the same rolls.
//  - Today's quality is derived LIVE from pacing (sugar vs time elapsed). Can recover
//    during the day if the kid stops eating. Locks at midnight (time_fraction = 1).
//  - Yesterday's final flower gets planted into a free-play flower field the next day.
//  - Pulls-per-day depends on yesterday's final quality (rewards good days).

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

// -------- Rarity tiers --------
// 5 tiers N / R / SR / SSR / UR. 'rainbow' is special-cased in components.
const RARITY_META = {
  N:    { stars: 1, label: '普通', color: '#6ab04c', colorSoft: '#c8e6b6', colorFaint: '#eaf4e0', stroke: '#3b6e2b' },
  R:    { stars: 2, label: '稀有', color: '#3b9cf5', colorSoft: '#a9d3f9', colorFaint: '#e6f1fb', stroke: '#1c6fc2' },
  SR:   { stars: 3, label: '超稀', color: '#a259e0', colorSoft: '#d8b8f0', colorFaint: '#f0e4fa', stroke: '#6f2bb5' },
  SSR:  { stars: 4, label: '极稀', color: '#ff9420', colorSoft: '#ffcf91', colorFaint: '#fff0dd', stroke: '#c86f00' },
  UR:   { stars: 5, label: '传说', color: 'rainbow', colorSoft: '#ffffff', colorFaint: '#fff',    stroke: '#2b2033' },
};
const RARITY_ORDER = ['N', 'R', 'SR', 'SSR', 'UR'];

// Per-pull probabilities now shift with yesterday's final quality. Good days
// bias toward high-tier pulls; bad days bias toward N. Within-tier species
// selection remains uniform. All rows sum to 1.0.
//
// These numbers were balanced so that a kid who usually eats "ok"-ish sees UR
// roughly 5% of pulls (PLAN.md target) but perfect-day streaks can push it to
// 8%, keeping the top tier reachable without trivializing it.
const RARITY_PROB_BY_QUALITY = {
  perfect: { N: 0.25, R: 0.28, SR: 0.22, SSR: 0.17,  UR: 0.08  },
  great:   { N: 0.32, R: 0.30, SR: 0.20, SSR: 0.11,  UR: 0.07  },
  ok:      { N: 0.40, R: 0.30, SR: 0.17, SSR: 0.08,  UR: 0.05  },
  okish:   { N: 0.50, R: 0.28, SR: 0.13, SSR: 0.06,  UR: 0.03  },
  wilted:  { N: 0.62, R: 0.25, SR: 0.09, SSR: 0.03,  UR: 0.01  },
  dead:    { N: 0.75, R: 0.18, SR: 0.05, SSR: 0.015, UR: 0.005 },
};
// Backward compat for callers without a quality context.
const RARITY_PROB = RARITY_PROB_BY_QUALITY.ok;

function rarityProbForQuality(quality) {
  return RARITY_PROB_BY_QUALITY[quality] || RARITY_PROB_BY_QUALITY.ok;
}

// Pulls allocated to today, based on yesterday's final quality.
// More pulls => better expected outcome under option-ii (keep or reroll each time).
const PULLS_FOR_QUALITY = {
  perfect: 5,
  great:   4,
  ok:      3,
  okish:   2,
  wilted:  2,
  dead:    1,
};
const DEFAULT_PULLS = 3;

// -------- Flower species (20 total across 5 tiers) --------
const FLOWERS = {
  // N (10) — 普通，最常见
  'c-tulip':      { name: '郁金香',   rarity: 'N',    petal: '#ff9ec4', center: '#ffd24a', shape: 'tulip',     desc: '经典合抱五瓣' },
  'c-daisy':      { name: '雏菊',     rarity: 'N',    petal: '#f2e9ff', center: '#ffd24a', shape: 'daisy',     desc: '淡紫白八瓣' },
  'c-sunflower':  { name: '向日葵',   rarity: 'N',    petal: '#ffd24a', center: '#7c4a1d', shape: 'sunflower', desc: '金黄十二瓣' },
  'c-poppy':      { name: '罂粟',     rarity: 'N',    petal: '#ff5c6c', center: '#2b2033', shape: 'poppy',     desc: '朱红五瓣' },
  'c-cosmos':     { name: '波斯菊',   rarity: 'N',    petal: '#b892ff', center: '#ffd24a', shape: 'cosmos',    desc: '粉紫六瓣' },
  'c-marigold':   { name: '万寿菊',   rarity: 'N',    petal: '#ffb085', center: '#c2453c', shape: 'marigold',  desc: '橙红双层' },
  'c-bluebell':   { name: '风铃草',   rarity: 'N',    petal: '#7ec4ff', center: '#7ec4ff', shape: 'bluebell',  desc: '蓝色钟铃' },
  'c-pansy':      { name: '三色堇',   rarity: 'N',    petal: '#b892ff', center: '#ffd24a', shape: 'pansy',     desc: '紫黄三色' },
  's-dandelion':  { name: '蒲公英',   rarity: 'N',    petal: '#ffffff', center: '#7c4a1d', shape: 'dandelion', desc: '种子乘风飞向远方' },
  'c-chrysanthemum':{ name: '菊花',   rarity: 'N',    petal: '#ffd24a', center: '#c28c1f', shape: 'chrysanthemum', desc: '金黄多层，秋之隽逸' },

  // R (8) — 稀有，蓝色
  'u-emerald':    { name: '翡翠花',   rarity: 'R',    petal: '#5bc08c', center: '#ffd24a', shape: 'emerald',   desc: '翠绿菱形，坚毅绽放' },
  'r-honeybee':   { name: '蜂蜜花',   rarity: 'R',    petal: '#ffd24a', center: '#7c4a1d', shape: 'honeybee',  desc: '小蜜蜂最爱的花' },
  'r-crystalrose':{ name: '水晶玫瑰', rarity: 'R',    petal: '#a0e7f0', center: '#ffffff', shape: 'crystalrose',desc: '晶莹剔透的梦想之花' },
  'r-lavender':   { name: '薰衣草',   rarity: 'R',    petal: '#b892ff', center: '#6f2bb5', shape: 'lavender',  desc: '地中海的蓝紫色穗状花序' },
  'r-iris':       { name: '鸢尾',     rarity: 'R',    petal: '#b892ff', center: '#ffd24a', shape: 'iris',      desc: '三瓣立起、三瓣下垂' },
  'r-hydrangea':  { name: '绣球花',   rarity: 'R',    petal: '#b3c8ff', center: '#ffd24a', shape: 'hydrangea', desc: '蓝粉渐变的球状簇生' },
  'r-violet':     { name: '紫罗兰',   rarity: 'R',    petal: '#9470d0', center: '#ffd24a', shape: 'violet',    desc: '五瓣心形，上浅下深' },
  'r-forgetmenot':{ name: '勿忘我',   rarity: 'R',    petal: '#7ec4ff', center: '#ffd24a', shape: 'forgetmenot',desc: '五圆蓝瓣 + 亮黄花心' },

  // SR (6) — 超稀，紫色
  'r-moonflower': { name: '月光花',   rarity: 'SR',   petal: '#e0e6ff', center: '#b892ff', shape: 'moonflower',desc: '只在糖分很少的夜晚开放' },
  'r-stardust':   { name: '星砂花',   rarity: 'SR',   petal: '#2b2058', center: '#ffd24a', shape: 'stardust',  desc: '花瓣上带着星星' },
  'u-sakura':     { name: '樱花',     rarity: 'SR',   petal: '#ffc7d8', center: '#ffffff', shape: 'sakura',    desc: '温柔的粉色五瓣' },
  's-rose':       { name: '玫瑰',     rarity: 'SR',   petal: '#d94560', center: '#8a1824', shape: 'rose',      desc: '多层螺旋的经典重瓣' },
  's-peony':      { name: '牡丹',     rarity: 'SR',   petal: '#ffa6cd', center: '#ffd24a', shape: 'peony',     desc: '国色天香，蓬松大花' },
  's-orchid':     { name: '兰花',     rarity: 'SR',   petal: '#ead5ff', center: '#ffd24a', shape: 'orchid',    desc: '三大瓣 + 紫唇，清雅幽香' },

  // SSR (6) — 极稀，橙色
  'r-rainbowlily':{ name: '彩虹百合', rarity: 'SSR',  petal: 'rainbow', center: '#ffd24a', shape: 'rainbowlily',desc: '承载着今天的好心情' },
  'u-phoenix':    { name: '凤凰花',   rarity: 'SSR',  petal: '#ff5c6c', center: '#ffd24a', shape: 'phoenix',   desc: '展翅火红的传说' },
  's-butterfly':  { name: '蝴蝶兰',   rarity: 'SSR',  petal: '#ffb085', center: '#c86f00', shape: 'butterfly', desc: '花瓣如蝶翼展开' },
  's-lotus':      { name: '莲花',     rarity: 'SSR',  petal: '#ffc4dc', center: '#ffd24a', shape: 'lotus',     desc: '佛国圣花，粉瓣层叠临水' },
  's-flame':      { name: '火焰花',   rarity: 'SSR',  petal: '#ff5c2a', center: '#ffd24a', shape: 'flame',     desc: '燃烧如火，热浪升腾' },
  's-edelweiss':  { name: '雪绒花',   rarity: 'SSR',  petal: '#ffffff', center: '#ffd24a', shape: 'edelweiss', desc: '阿尔卑斯之星，雪中白绒' },

  // UR (5) — 传说，彩虹色
  'ur-starlight': { name: '星光花',   rarity: 'UR',   petal: '#ffd24a', center: '#fff5a0', shape: 'starlight', desc: '传说中只在完美的日子绽放' },
  'ur-crystal':   { name: '琉璃花',   rarity: 'UR',   petal: '#ffffff', center: '#ffd24a', shape: 'crystal',   desc: '折射出所有颜色的水晶花' },
  'ur-aurora':    { name: '极光花',   rarity: 'UR',   petal: '#7ad9b5', center: '#e0ecff', shape: 'aurora',    desc: '北极的梦幻之光' },
  'ur-spiderlily':{ name: '曼珠沙华', rarity: 'UR',   petal: '#ff3050', center: '#8a1824', shape: 'spider-lily',desc: '彼岸的鲜红与金蕊' },
  'ur-laurel':    { name: '月桂冠花', rarity: 'UR',   petal: '#ffd24a', center: '#fff5a0', shape: 'laurel',    desc: '胜利与荣耀的象征' },
};

// -------- Flower roll (gacha) --------
// Deterministic given (familyId, date, pullIndex, quality).
function rollRarity(seed, weights = RARITY_PROB) {
  const r = mulberry32(seed)();
  let cumulative = 0;
  for (const tier of RARITY_ORDER) {
    cumulative += weights[tier] || 0;
    if (r < cumulative) return tier;
  }
  return 'N';
}
function rollSpecies(seed, rarity) {
  const list = Object.keys(FLOWERS).filter(k => FLOWERS[k].rarity === rarity);
  if (!list.length) return null;
  const pick = Math.floor(mulberry32(seed + 1)() * list.length);
  return list[pick];
}
// Composite: given familyId + date + pullIndex, produce a reproducible
// {rarity, speciesId}. `quality` is yesterday's final quality and picks the
// weight row; `forceRarity` (debug) short-circuits the rarity roll.
//
// `nonce` breaks determinism when passed (debug only). Normal play leaves it 0
// so family devices agree. Debug mode injects Date.now() so repeated
// forced spins / reset-and-respin give different flowers for testing.
function rollFlower(familyId, date, pullIndex, forceRarity, quality, nonce) {
  const weights = rarityProbForQuality(quality || 'ok');
  const nSuffix = nonce ? `:n${nonce}` : '';
  const seed = hashStr(`${familyId}:${date}:${pullIndex}${nSuffix}:rarity`);
  const rarity = forceRarity && RARITY_META[forceRarity] ? forceRarity : rollRarity(seed, weights);
  const speciesSeed = hashStr(`${familyId}:${date}:${pullIndex}${nSuffix}:${rarity}`);
  const speciesId = rollSpecies(speciesSeed, rarity);
  return { rarity, speciesId, pullIndex };
}

// Yesterday's final quality (or 'ok' default). Drives both today's pulls and
// today's probability distribution — they stay in lock-step.
function effectiveQualityFor(state, date) {
  const d = parseYMD(date);
  d.setDate(d.getDate() - 1);
  const prev = ymd(d);
  const prevDay = state.days[prev];
  if (!prevDay?.spin || prevDay.spin.keptIndex == null) return 'ok';
  const total = totalForDay(prevDay);
  return qualityFromPacing(total, state.settings.dailyLimit, 1.0);
}

// -------- Pacing-based quality --------
// quality = f(totalSugar, limit, expected(time_fraction))
//   target = max(0.05, expected)
//   pacingRatio = totalSugar / (limit * target)
// Stronger early-eating penalty; recovers if kid stops.
function qualityFromPacing(totalSugar, limit, expected) {
  const target = Math.max(0.05, expected);
  const pacing = totalSugar / (limit * target);
  if (pacing >= 1.8) return 'dead';
  if (pacing >= 1.3) return 'wilted';
  if (pacing >= 1.0) return 'okish';
  if (pacing >= 0.7) return 'ok';
  if (pacing >= 0.4) return 'great';
  return 'perfect';
}

// Quality tier for a given date. For today, uses current time-of-day.
// For any past date, expected = 1.0 (end of day) so pacing = absolute ratio.
function qualityForDay(state, date, atTime) {
  const day = state.days[date];
  if (!day) return null;
  const total = totalForDay(day);
  const today = ymd(atTime || new Date());
  const expected = date === today ? expectedProgress(atTime || new Date()) : 1.0;
  return qualityFromPacing(total, state.settings.dailyLimit, expected);
}

// Pulls allocated today, based on yesterday's final quality (if any).
function pullsForDate(state, date) {
  const q = effectiveQualityFor(state, date);
  return PULLS_FOR_QUALITY[q] || DEFAULT_PULLS;
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

// -------- Flower field (garden) layout --------
// 48 slots in an irregular hexagonal-ish grid. Rendered as offset rows.
// Coordinates are relative percentages so CSS can absolute-position without math.
function buildFieldSlots() {
  const slots = [];
  // 6 rows × 8 cols with slight stagger for a more organic look
  for (let row = 0; row < 6; row++) {
    for (let col = 0; col < 8; col++) {
      const id = `${row}-${col}`;
      const x = 6 + col * 11.5 + (row % 2 === 1 ? 5.5 : 0);   // percent
      const y = 12 + row * 14;                                   // percent
      slots.push({ id, row, col, x, y });
    }
  }
  return slots;
}
const FIELD_SLOTS = buildFieldSlots();

// -------- localStorage keys --------
const LS_STATE = 'sg:state';
const LS_IDENTITY = 'sg:identity';
const LS_PENDING = 'sg:pending';

// Bump when the state shape or rarity labels change in a way that needs migration.
const STATE_SCHEMA_VERSION = 2;

// Migrate older state blobs. v1→v2 dropped the SSSR tier and renamed tiers
// (R→N, SR→R, SSR→SR, SSSR→SSR, UR→UR). The safe-and-cheap path is to drop
// stale spin results; everything else (entries, schoolSugar, plantedAt) is
// unaffected and stays put.
function migrateState(s) {
  if (!s || s.schemaVersion === STATE_SCHEMA_VERSION) return s;
  const newDays = {};
  for (const [date, day] of Object.entries(s.days || {})) {
    newDays[date] = { ...day, spin: null, plantedAt: null };
  }
  return {
    ...s,
    days: newDays,
    schemaVersion: STATE_SCHEMA_VERSION,
    // Strip removed fields from old schemas.
    unlockedUnlocks: undefined,
  };
}

function loadState() {
  try {
    const r = localStorage.getItem(LS_STATE);
    if (r) return migrateState(JSON.parse(r));
  } catch(e){}
  return null;
}
function saveState(s) {
  try { localStorage.setItem(LS_STATE, JSON.stringify(s)); } catch(e){}
}

function defaultState() {
  return {
    schemaVersion: STATE_SCHEMA_VERSION,
    settings: {
      childName: '',
      dateOfBirth: '',
      dailyLimit: 19,
      wakeHour: 7,
      onboarded: false,
      settingsUpdatedAt: 0,
    },
    // Per-day: {
    //   date,
    //   schoolSugar, schoolSugarUpdatedAt,
    //   entries: [...],
    //   spin: { attempts: [{rarity, speciesId}], keptIndex, pullsAllocated, updatedAt } | null,
    //   plantedAt: { slotId, ts } | null,
    //   _schoolPending, _spinPending, _plantPending (local-only)
    // }
    days: {},
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
    date, schoolSugar: 0, schoolSugarUpdatedAt: 0, entries: [],
    spin: null, plantedAt: null,
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

// Record a spin attempt (for today). Appends to attempts history.
// If state.debug.forceRarity is set, the rarity is overridden (and flag cleared).
// `precomputedRoll` lets SpinWheel pass in the same roll it animated so the
// committed result matches the carousel landing exactly (important when a
// nonce-based roll would otherwise differ between pre-compute and commit).
function addSpinAttempt(state, date, identity, precomputedRoll) {
  let next = ensureDay(state, date);
  const day = next.days[date];
  const attempts = day.spin?.attempts || [];
  const allocated = day.spin?.pullsAllocated ?? pullsForDate(state, date);
  if (attempts.length >= allocated) return next;
  const forceRarity = state.debug?.forceRarity || null;
  let roll = precomputedRoll;
  if (!roll) {
    const quality = effectiveQualityFor(state, date);
    roll = rollFlower(identity?.familyId || 'local', date, attempts.length, forceRarity, quality);
  }
  const now = Date.now();
  const newAttempts = [...attempts, { rarity: roll.rarity, speciesId: roll.speciesId }];
  next = { ...next, days: { ...next.days, [date]: {
    ...day,
    spin: {
      attempts: newAttempts,
      keptIndex: null,
      pullsAllocated: allocated,
      updatedAt: now,
    },
    _spinPending: true,
  }}};
  if (forceRarity) {
    const newDebug = { ...(next.debug || {}) };
    delete newDebug.forceRarity;
    next = { ...next, debug: newDebug };
  }
  saveState(next);
  return next;
}

// Lock in the last attempt as the kept result. No more re-rolling today.
function keepSpin(state, date) {
  const day = state.days[date];
  if (!day || !day.spin || !day.spin.attempts.length) return state;
  const now = Date.now();
  const next = { ...state, days: { ...state.days, [date]: {
    ...day,
    spin: {
      ...day.spin,
      keptIndex: day.spin.attempts.length - 1,
      updatedAt: now,
    },
    _spinPending: true,
  }}};
  saveState(next);
  return next;
}

function plantAt(state, date, slotId) {
  const day = state.days[date];
  if (!day) return state;
  const now = Date.now();
  const next = { ...state, days: { ...state.days, [date]: {
    ...day,
    plantedAt: { slotId, ts: now },
    _plantPending: true,
  }}};
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
  const quality = qualityFromPacing(total, limit, date === ymd(now) ? expected : 1.0);
  const liveEntries = (day?.entries || []).filter(e => !e.deleted);
  return { total, limit, ratio: actualRatio, expected, quality, school: day?.schoolSugar || 0, entries: liveEntries };
}

// Today's kept flower (if spin is locked). Returns {rarity, speciesId} or null.
function keptFlowerFor(state, date) {
  const spin = state.days[date]?.spin;
  if (!spin || spin.keptIndex == null) return null;
  return spin.attempts[spin.keptIndex] || null;
}

// Dates that have a kept spin but haven't been planted yet (excluding today).
function unplantedSpunDates(state) {
  const today = ymd(new Date());
  const out = [];
  for (const key of Object.keys(state.days)) {
    if (key >= today) continue;
    const d = state.days[key];
    if (d.spin?.keptIndex != null && !d.plantedAt) out.push(key);
  }
  out.sort();
  return out;
}

// Month view data (still used by history screen)
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

function mergeServerEntries(state, rows) {
  if (!rows || !rows.length) return state;
  const next = { ...state, days: { ...state.days } };
  for (const r of rows) {
    const date = r.date;
    if (!next.days[date]) {
      next.days[date] = { date, schoolSugar: 0, schoolSugarUpdatedAt: 0, entries: [], spin: null, plantedAt: null };
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
    if (existingIdx === -1) entries.push(incoming);
    else {
      const prev = entries[existingIdx];
      if ((prev.updatedAt || 0) < incoming.updatedAt) entries[existingIdx] = incoming;
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
      next.days[date] = { date, schoolSugar: Number(r.sugar) || 0, schoolSugarUpdatedAt: ts, entries: [], spin: null, plantedAt: null };
    } else {
      const cur = next.days[date];
      if ((cur.schoolSugarUpdatedAt || 0) < ts) {
        next.days[date] = { ...cur, schoolSugar: Number(r.sugar) || 0, schoolSugarUpdatedAt: ts };
      }
    }
  }
  saveState(next);
  return next;
}

// Server-side day_state rows: { date, spinJson, plantedSlot, plantedAt, updatedAt }
function mergeServerDayState(state, rows) {
  if (!rows || !rows.length) return state;
  const next = { ...state, days: { ...state.days } };
  for (const r of rows) {
    const date = r.date;
    const ts = Number(r.updatedAt);
    if (!next.days[date]) {
      next.days[date] = { date, schoolSugar: 0, schoolSugarUpdatedAt: 0, entries: [], spin: null, plantedAt: null };
    }
    const cur = next.days[date];
    let spin = cur.spin;
    let plantedAt = cur.plantedAt;
    if (r.spinJson) {
      try {
        const remoteSpin = JSON.parse(r.spinJson);
        // Drop stale spins with pre-v2 rarity labels; the kid will re-spin.
        const validAttempts = (remoteSpin.attempts || []).every(a => RARITY_META[a.rarity]);
        if (validAttempts && (!spin || (spin.updatedAt || 0) < ts)) {
          spin = { ...remoteSpin, updatedAt: ts };
        }
      } catch {}
    }
    if (r.plantedSlot) {
      if (!plantedAt || (plantedAt.ts || 0) < Number(r.plantedAt || ts)) {
        plantedAt = { slotId: r.plantedSlot, ts: Number(r.plantedAt) || ts };
      }
    }
    next.days[date] = { ...cur, spin, plantedAt };
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
      next = { ...next, settings: { ...next.settings, onboarded: true, childName: family.childName || next.settings.childName, dateOfBirth: family.dateOfBirth || next.settings.dateOfBirth, dailyLimit: Number(family.dailyLimit) || next.settings.dailyLimit, settingsUpdatedAt: serverTs || Date.now() } };
    }
  }
  if (members) next = { ...next, members };
  saveState(next);
  return next;
}

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
function markDayStateSynced(state, date) {
  if (!state.days[date]) return state;
  const next = { ...state, days: { ...state.days, [date]: { ...state.days[date], _spinPending: false, _plantPending: false } } };
  saveState(next);
  return next;
}

// -------- Debug helpers (used only via ?debug=1) --------

function debugIsEnabled() {
  if (typeof location === 'undefined') return false;
  return new URLSearchParams(location.search).has('debug');
}

function debugSetForceRarity(state, rarity) {
  const next = { ...state, debug: { ...(state.debug || {}), forceRarity: rarity } };
  saveState(next);
  return next;
}

function debugResetTodaySpin(state) {
  const today = ymd(new Date());
  const day = state.days[today];
  if (!day) return state;
  const next = { ...state, days: { ...state.days, [today]: { ...day, spin: null, plantedAt: null } } };
  saveState(next);
  return next;
}

// Creates a fake unplanted past day with a kept spin of the given rarity.
// Each call walks further back in time so the user can stack up plantings.
function debugSeedYesterdayUnplanted(state, identity, rarity = 'SSR') {
  const speciesList = Object.keys(FLOWERS).filter(k => FLOWERS[k].rarity === rarity);
  const speciesId = speciesList[Math.floor(Math.random() * speciesList.length)] || 'c-daisy';
  // Find first past date that isn't already in state.days
  let dateStr = null;
  for (let delta = 1; delta < 365; delta++) {
    const d = new Date(); d.setDate(d.getDate() - delta);
    const cand = ymd(d);
    if (!state.days[cand]) { dateStr = cand; break; }
  }
  if (!dateStr) return state;
  const now = Date.now();
  const next = { ...state, days: { ...state.days, [dateStr]: {
    date: dateStr, schoolSugar: 0, schoolSugarUpdatedAt: 0, entries: [],
    spin: { attempts: [{ rarity, speciesId }], keptIndex: 0, pullsAllocated: 3, updatedAt: now },
    plantedAt: null,
  }}};
  saveState(next);
  return next;
}

function debugWipeLocal() {
  try {
    localStorage.removeItem(LS_STATE);
    localStorage.removeItem(LS_IDENTITY);
    localStorage.removeItem(LS_PENDING);
  } catch {}
}

Object.assign(window, {
  FOOD_LIBRARY, CATEGORY_META, FLOWERS, SEGMENTS,
  RARITY_META, RARITY_ORDER, RARITY_PROB, RARITY_PROB_BY_QUALITY, rarityProbForQuality,
  effectiveQualityFor, PULLS_FOR_QUALITY, DEFAULT_PULLS,
  FIELD_SLOTS,
  DAY_START_HOUR, DAY_END_HOUR,
  LS_STATE, LS_IDENTITY, LS_PENDING,
  ymd, parseYMD, isWeekday, segmentFor, expectedProgress,
  loadState, saveState, defaultState,
  ageFromDob, defaultLimitByAge,
  ensureDay, addEntry, removeEntry, setSchoolSugar, updateSettings,
  addSpinAttempt, keepSpin, plantAt,
  rollFlower, pullsForDate, qualityFromPacing, qualityForDay, hashStr,
  totalForDay, dayStatus, keptFlowerFor, unplantedSpunDates,
  monthData, trendData,
  mergeServerEntries, mergeServerSchoolSugar, mergeServerDayState, applyServerFamily,
  markEntrySynced, markSchoolSynced, markSettingsSynced, markDayStateSynced,
  debugIsEnabled, debugSetForceRarity, debugResetTodaySpin, debugSeedYesterdayUnplanted, debugWipeLocal,
});
