// Screen components for the Sugar Garden app.
const { useState, useEffect, useRef, useMemo } = React;

// ============ RARITY PRIMITIVES ============
// Used in home card, spin wheel, calendar cells, flower field, gallery.
const RAINBOW_BG = 'conic-gradient(from 0deg, #ff5c6c, #ffb085, #ffd24a, #7ad9b5, #7ec4ff, #b892ff, #ff5c6c)';
const RAINBOW_LINEAR = 'linear-gradient(90deg, #ff5c6c, #ffb085, #ffd24a, #7ad9b5, #7ec4ff, #b892ff, #ff5c6c)';
// Seamless looping gradient (starts and ends with the same red, tile-safe under 400% size).
const RAINBOW_LINEAR_LOOP = 'linear-gradient(90deg, #ff5c6c, #ffb085, #ffd24a, #7ad9b5, #7ec4ff, #b892ff, #ff5c6c, #ffb085, #ffd24a, #7ad9b5, #7ec4ff, #b892ff, #ff5c6c)';

// Shared keyframes for rarity effects (injected once, used by gallery + app).
(function injectRarityStyles() {
  if (typeof document === 'undefined') return;
  if (document.getElementById('sg-rarity-styles')) return;
  const s = document.createElement('style');
  s.id = 'sg-rarity-styles';
  s.textContent = `
    @keyframes sg-rainbow { 0%{background-position:0% 0} 100%{background-position:200% 0} }
    @keyframes sg-rainbow-rotate { 0%{background-position:0% 50%} 100%{background-position:200% 50%} }
    @keyframes sg-rainbow-slide {
      0%   { background-position: 0% 50%; }
      100% { background-position: 400% 50%; }
    }
    @keyframes sg-sheen { 0%,100%{background-position:0% 50%} 50%{background-position:100% 50%} }
    @keyframes sg-sparkle-float {
      0%   { opacity: 0; transform: translateY(0) scale(0.5); }
      20%  { opacity: 1; }
      80%  { opacity: 1; }
      100% { opacity: 0; transform: translateY(-40px) scale(1.2); }
    }
    @keyframes sg-glow-breath {
      0%,100% { opacity: 0.55; transform: scale(0.96); }
      50%     { opacity: 1;    transform: scale(1.08); }
    }
    @keyframes sg-tear {
      0%   { opacity: 0; transform: translateY(0) scale(0.5); }
      25%  { opacity: 0.9; }
      100% { opacity: 0; transform: translateY(30px) scale(1); }
    }
  `;
  document.head.appendChild(s);
})();

function StarRating({ rarity, size = 12, onDark = false }) {
  const r = RARITY_META[rarity] || RARITY_META.N;
  // On a colored background (e.g. inside RarityBadge), solid white stars with a
  // subtle shadow read cleanly regardless of tier color.
  if (onDark) {
    return (
      <span style={{ display: 'inline-flex', gap: 1, lineHeight: 1 }}>
        {Array.from({ length: r.stars }).map((_, i) => (
          <span key={i} style={{
            fontSize: size, lineHeight: 1, color: '#fff',
            textShadow: '0 1px 2px rgba(0,0,0,0.35), 0 0 4px rgba(255,255,255,0.4)',
          }}>★</span>
        ))}
      </span>
    );
  }
  const isRainbow = rarity === 'UR';
  return (
    <span style={{ display: 'inline-flex', gap: 1, lineHeight: 1 }}>
      {Array.from({ length: r.stars }).map((_, i) => {
        const base = { fontSize: size, lineHeight: 1 };
        if (isRainbow) {
          return <span key={i} style={{
            ...base,
            background: RAINBOW_LINEAR, backgroundSize: '200% 100%',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            backgroundClip: 'text', color: 'transparent',
            animation: 'sg-rainbow 4s linear infinite',
          }}>★</span>;
        }
        return <span key={i} style={{ ...base, color: r.color }}>★</span>;
      })}
    </span>
  );
}

function RarityBadge({ rarity, size = 'md' }) {
  const r = RARITY_META[rarity] || RARITY_META.N;
  const isRainbow = rarity === 'UR';
  const fz = { sm: 10, md: 12, lg: 14 }[size] || 12;
  const py = { sm: 2, md: 4, lg: 6 }[size] || 4;
  const px = { sm: 8, md: 10, lg: 14 }[size] || 10;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: `${py}px ${px}px`, borderRadius: 999,
      background: isRainbow ? RAINBOW_LINEAR : r.color,
      backgroundSize: isRainbow ? '400% 100%' : undefined,
      animation: isRainbow ? 'sg-rainbow-slide 8s linear infinite' : null,
      color: '#fff', font: `700 ${fz}px 'Noto Sans SC'`, letterSpacing: 0.5,
      textShadow: '0 1px 2px rgba(0,0,0,0.25)',
      whiteSpace: 'nowrap',
    }}>
      {rarity} <StarRating rarity={rarity} size={fz - 1} onDark />
    </span>
  );
}

// Frame that wraps content with a rarity-specific border / glow.
// UR uses a seamless linear rainbow slide (400% wide, repeating) — smoother
// than conic-gradient for rectangular frames. SSR / SR use gradient sheens.
function RarityFrame({ rarity, children, padding = 6, radius = 18, animate = true, style }) {
  const r = RARITY_META[rarity] || RARITY_META.N;
  const wrap = { position: 'relative', borderRadius: radius, padding, ...style };

  if (rarity === 'UR') {
    return (
      <div style={{
        ...wrap,
        background: RAINBOW_LINEAR_LOOP,
        backgroundSize: '400% 100%',
        animation: animate ? 'sg-rainbow-slide 8s linear infinite' : null,
        boxShadow: '0 0 24px rgba(255,210,74,0.45), 0 0 8px rgba(184,146,255,0.4), 0 6px 18px rgba(0,0,0,0.1)',
      }}>
        <div style={{ background: '#fffef5', borderRadius: radius - 2, padding: 0, position: 'relative', overflow: 'hidden' }}>
          {children}
        </div>
      </div>
    );
  }
  if (rarity === 'SSR') {
    return (
      <div style={{
        ...wrap,
        background: `linear-gradient(135deg, ${r.color}, #ffd24a, ${r.color})`,
        backgroundSize: '300% 300%',
        animation: animate ? 'sg-sheen 6s ease-in-out infinite' : null,
        boxShadow: `0 0 18px ${r.colorSoft}, 0 4px 14px rgba(200,111,0,0.18)`,
      }}>
        <div style={{ background: '#fff', borderRadius: radius - 2 }}>{children}</div>
      </div>
    );
  }
  if (rarity === 'SR') {
    return (
      <div style={{
        ...wrap,
        background: `linear-gradient(135deg, ${r.color}, #d9b7f7, ${r.color})`,
        backgroundSize: '300% 300%',
        animation: animate ? 'sg-sheen 6s ease-in-out infinite' : null,
        boxShadow: `0 0 12px ${r.colorSoft}, 0 3px 10px rgba(111,43,181,0.15)`,
      }}>
        <div style={{ background: '#fff', borderRadius: radius - 2 }}>{children}</div>
      </div>
    );
  }
  if (rarity === 'R') {
    return (
      <div style={{
        ...wrap, border: `2.5px solid ${r.color}`, background: '#fff',
        boxShadow: `0 2px 8px ${r.colorSoft}`,
      }}>
        {children}
      </div>
    );
  }
  return (
    <div style={{ ...wrap, border: `2px solid ${r.color}`, background: '#fff' }}>
      {children}
    </div>
  );
}

// Particles & overlays layered on top of the flower. Intensity scales with rarity tier.
// Uses a multi-layer aura (core highlight + mid color + soft outer fade) for SR+
// so high-tier flowers feel "premium" rather than fogged.
function QualityFx({ quality, rarity, box = 120 }) {
  const r = RARITY_META[rarity] || RARITY_META.N;
  const tier = RARITY_ORDER.indexOf(rarity) + 1;   // 1..5
  const isRainbow = rarity === 'UR';

  if (quality === 'perfect' || quality === 'great') {
    const count = quality === 'perfect' ? tier + 2 : tier;
    return (
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        {/* Aura (SR+ only): layered gradients for a 3-D glow rather than flat fog. */}
        {tier >= 3 && (
          <>
            {/* outer soft fade */}
            <div style={{
              position: 'absolute', inset: '-4%',
              borderRadius: '50%',
              background: isRainbow
                ? 'radial-gradient(ellipse at 50% 55%, rgba(255,210,74,0.22) 0%, rgba(184,146,255,0.12) 40%, transparent 72%)'
                : `radial-gradient(ellipse at 50% 55%, ${r.colorSoft}66 0%, ${r.colorSoft}22 40%, transparent 72%)`,
              animation: 'sg-glow-breath 3.8s ease-in-out infinite',
              filter: 'blur(2px)',
            }} />
            {/* mid color band */}
            <div style={{
              position: 'absolute', inset: '14%',
              borderRadius: '50%',
              background: isRainbow
                ? 'radial-gradient(circle at 50% 55%, rgba(255,184,104,0.35) 0%, rgba(124,196,255,0.2) 50%, transparent 72%)'
                : `radial-gradient(circle at 50% 55%, ${r.color}44 0%, ${r.color}22 45%, transparent 72%)`,
              animation: 'sg-glow-breath 3.2s ease-in-out infinite 0.4s',
            }} />
            {/* inner white highlight */}
            <div style={{
              position: 'absolute', inset: '30%',
              borderRadius: '50%',
              background: 'radial-gradient(circle at 45% 40%, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0.15) 40%, transparent 65%)',
              animation: 'sg-glow-breath 2.8s ease-in-out infinite 0.8s',
            }} />
          </>
        )}
        {tier === 5 && (
          <div style={{
            position: 'absolute', inset: '8%',
            borderRadius: '50%',
            background: RAINBOW_BG, backgroundSize: '200% 200%',
            opacity: 0.11, mixBlendMode: 'screen',
            animation: 'sg-rainbow-rotate 8s linear infinite',
          }} />
        )}
        {/* Sparkles rising from petals */}
        {Array.from({ length: count }).map((_, i) => (
          <span key={i} style={{
            position: 'absolute',
            left: `${10 + (i * 17) % 80}%`,
            bottom: `${15 + (i % 2) * 25}%`,
            fontSize: quality === 'perfect' ? 14 : 11,
            color: isRainbow ? '#ffd24a' : r.color,
            animation: `sg-sparkle-float ${2.2 + (i % 3) * 0.4}s ease-out ${i * 0.3}s infinite`,
            opacity: 0, filter: 'drop-shadow(0 0 3px rgba(255,210,74,0.8))',
          }}>✦</span>
        ))}
      </div>
    );
  }

  if (quality === 'wilted' || quality === 'dead') {
    return (
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        {[0, 1].map(i => (
          <span key={i} style={{
            position: 'absolute',
            left: `${30 + i * 35}%`, top: '38%',
            width: 6, height: 10, background: '#7ec4ff', borderRadius: '50%',
            animation: `sg-tear 2.8s ease-in ${i * 1.3}s infinite`, opacity: 0,
          }} />
        ))}
      </div>
    );
  }
  return null;
}

// Three drifting leaf particles that animate on card hover (CSS-driven from flowers.jsx).
function WindLeaves() {
  return (
    <>
      <div className="sg-wind-leaf" />
      <div className="sg-wind-leaf" style={{ top: '20%' }} />
      <div className="sg-wind-leaf" style={{ top: '55%' }} />
    </>
  );
}

// ============ SPIN WHEEL ============
// Two-phase reveal. We pre-compute the roll's (rarity, species) BEFORE the
// animation so stage 2's carousel lands exactly on the correct flower.
//
//  Phase 1 (spinning-rarity): 5 rarity tiles; highlight cycles through them
//    with decelerating ticks (55ms → 320ms using t² easing), lands on target.
//  Phase 2 (spinning-species): a horizontal carousel strip of the target
//    tier's species slides left via a single CSS transition with cubic-bezier
//    ease-out — fast at start, slow landing on the target centered.
//  Phase 3 (result): shows the committed flower in its rarity frame.
function SpinWheel({ state, identity, date, setState, onDone }) {
  const day = state.days[date];
  const allocated = pullsForDate(state, date);
  const attempts = day?.spin?.attempts || [];
  const used = attempts.length;
  const lastAttempt = attempts[attempts.length - 1] || null;

  const [phase, setPhase] = useState(() => lastAttempt ? 'result' : 'intro');
  const [rarityIdx, setRarityIdx] = useState(0);
  const [target, setTarget] = useState(null);   // { rarity, speciesId } pre-computed
  const [speciesStrip, setSpeciesStrip] = useState([]);
  const [stripTx, setStripTx] = useState(0);
  const [stripTransition, setStripTransition] = useState('none');
  const timersRef = useRef([]);

  useEffect(() => () => { timersRef.current.forEach(clearTimeout); timersRef.current = []; }, []);
  const sleep = (ms) => new Promise(r => { const id = setTimeout(r, ms); timersRef.current.push(id); });

  // Decelerating tick animation. Intervals grow as t² so ticks start fast and slow down.
  async function animateTicks(startIdx, totalSteps, wrapMod, onTick, minMs, maxMs) {
    let cur = startIdx;
    for (let i = 0; i < totalSteps; i++) {
      const t = i / Math.max(1, totalSteps - 1);
      const interval = minMs + (maxMs - minMs) * t * t;
      await sleep(interval);
      cur = (cur + 1) % wrapMod;
      onTick(cur);
    }
  }

  const ITEM_WIDTH = 140;
  const VISIBLE = 3;   // strip viewport shows 3 items, center one is "selected"

  async function runSpin() {
    if (used >= allocated) return;
    // 1. Pre-compute the roll. In debug mode we mix a Date.now() nonce into
    //    the seed so repeated forced spins / reset-then-respin produce different
    //    flowers for testing. We pass the exact roll to addSpinAttempt below
    //    so the committed result matches the animation landing — no drift.
    const forceRarity = state.debug?.forceRarity || null;
    const quality = effectiveQualityFor(state, date);
    const inDebug = debugIsEnabled() || !!forceRarity;
    const nonce = inDebug ? Date.now() : 0;
    const roll = rollFlower(identity?.familyId || 'local', date, used, forceRarity, quality, nonce);
    setTarget(roll);

    // 2. Rarity phase: decelerating tile-highlight, lands on target tier.
    setPhase('spinning-rarity');
    const rarityTargetIdx = RARITY_ORDER.indexOf(roll.rarity);
    const rarityFullCycles = 2;
    const rarityStart = 0;
    const rarityTotalSteps = rarityFullCycles * RARITY_ORDER.length +
      ((rarityTargetIdx - rarityStart + RARITY_ORDER.length) % RARITY_ORDER.length);
    setRarityIdx(rarityStart);
    await animateTicks(rarityStart, rarityTotalSteps, RARITY_ORDER.length, setRarityIdx, 55, 320);
    // Give a short beat so the user sees the locked-in rarity.
    await sleep(250);

    // 3. Species phase: build a strip with target *not at the end* — extra species
    //    follow the target so the carousel visually spills past rather than
    //    "hitting a wall". The slide lands the target centered.
    const list = Object.keys(FLOWERS).filter(k => FLOWERS[k].rarity === roll.rarity);
    const targetSpeciesIdx = list.indexOf(roll.speciesId);
    const cycles = 3;
    const tailExtra = 4;   // items after target, visible off-screen to the right
    const strip = [];
    for (let c = 0; c < cycles; c++) strip.push(...list);
    strip.push(...list.slice(0, targetSpeciesIdx + 1));
    for (let i = 0; i < tailExtra; i++) {
      strip.push(list[(targetSpeciesIdx + 1 + i) % list.length]);
    }
    setSpeciesStrip(strip);
    setStripTx(0);
    setStripTransition('none');
    setPhase('spinning-species');
    // Two frames so the transition: none commits before we trigger the slide.
    await sleep(60);
    // Target lives cycles-deep into the strip, not at the end.
    const targetIndexInStrip = cycles * list.length + targetSpeciesIdx;
    const targetTx = -(targetIndexInStrip - Math.floor(VISIBLE / 2)) * ITEM_WIDTH;
    // cubic-bezier picked so the last ~20% of the slide is very slow —
    // the carousel visibly creeps to a stop, slot-machine style.
    setStripTransition('transform 2.8s cubic-bezier(0.08, 0.82, 0.12, 1)');
    setStripTx(targetTx);
    await sleep(2850);

    // 4. Commit (rollFlower inside addSpinAttempt will produce the same result).
    // Pass the precomputed roll so the commit matches what the animation showed
    // (matters when nonce is set — re-rolling would give a different result).
    const next = addSpinAttempt(state, date, identity, roll);
    setState?.(next);
    setPhase('result');
  }

  function keep() {
    const next = keepSpin(state, date);
    setState?.(next);
    onDone?.();
  }

  function reroll() {
    setTarget(null);
    setSpeciesStrip([]);
    setStripTx(0);
    setStripTransition('none');
    setRarityIdx(0);
    runSpin();
  }

  const tiers = RARITY_ORDER;
  const currentRarityHighlight = phase === 'spinning-rarity'
    ? tiers[rarityIdx % tiers.length]
    : (target?.rarity || lastAttempt?.rarity);

  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 65,
      background: 'linear-gradient(180deg, #23331f 0%, #3a5030 100%)',
      color: '#fff', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', padding: 24, overflow: 'hidden',
    }}>
      {/* Pull counter top-right */}
      <div style={{
        position: 'absolute', top: 24, right: 24,
        padding: '8px 14px', borderRadius: 14,
        background: 'rgba(255,255,255,0.12)', border: '1.5px solid rgba(255,255,255,0.3)',
        font: "700 13px 'Noto Sans SC'",
      }}>🎟️ 剩余 {Math.max(0, allocated - (phase === 'result' ? used : used))} / {allocated}</div>

      {phase === 'intro' && (
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 64, marginBottom: 16 }}>🎰</div>
          <h1 style={{ font: "700 32px 'ZCOOL KuaiLe'", margin: 0 }}>今天运气如何？</h1>
          <p style={{ font: "500 14px/1.6 'Noto Sans SC'", color: '#cfe3be', marginTop: 12 }}>
            你有 <b style={{ color: '#ffd24a' }}>{allocated}</b> 次抽卡机会<br/>
            抽到不喜欢的可以再抽一次，但会消耗一次机会
          </p>
          <button onClick={runSpin} style={{
            marginTop: 30, padding: '16px 38px', borderRadius: 24,
            border: '3px solid #fff', background: '#ffd24a', color: '#23331f',
            font: "700 18px 'Noto Sans SC'", boxShadow: '0 4px 0 #fff', cursor: 'pointer',
          }}>开始抽卡 🌸</button>
        </div>
      )}

      {(phase === 'spinning-rarity' || phase === 'spinning-species' || phase === 'result') && (
        <>
          {/* Rarity wheel: 5 tiles in a row, one highlighted */}
          <div style={{
            display: 'flex', gap: 8, marginBottom: 20,
            opacity: phase === 'intro' ? 0 : 1, transition: 'opacity 0.3s',
          }}>
            {tiers.map(t => {
              const active = t === currentRarityHighlight;
              const m = RARITY_META[t];
              const isRb = t === 'UR';
              return (
                <div key={t} style={{
                  padding: '10px 14px', borderRadius: 12,
                  background: active ? (isRb ? RAINBOW_LINEAR : m.color) : 'rgba(255,255,255,0.08)',
                  backgroundSize: isRb && active ? '200% 100%' : undefined,
                  animation: isRb && active ? 'sg-rainbow 4s linear infinite' : null,
                  border: active ? '2.5px solid #fff' : '2px solid rgba(255,255,255,0.2)',
                  color: active ? '#fff' : 'rgba(255,255,255,0.5)',
                  font: "700 14px 'Noto Sans SC'", transition: 'all 0.12s',
                  transform: active ? 'scale(1.1)' : 'scale(1)',
                  boxShadow: active ? `0 0 20px ${isRb ? '#ffd24a' : m.color}` : 'none',
                }}>{t}</div>
              );
            })}
          </div>

          {/* Species reveal / spinning */}
          <div style={{ minHeight: 300, display: 'grid', placeItems: 'center' }}>
            {phase === 'spinning-rarity' && (
              <div style={{ font: "700 20px 'ZCOOL KuaiLe'", color: '#ffd24a', letterSpacing: 3 }}>
                转动中…
              </div>
            )}
            {phase === 'spinning-species' && (
              <div style={{
                width: VISIBLE * ITEM_WIDTH, overflow: 'hidden', position: 'relative',
                maskImage: 'linear-gradient(90deg, transparent 0%, black 12%, black 88%, transparent 100%)',
                WebkitMaskImage: 'linear-gradient(90deg, transparent 0%, black 12%, black 88%, transparent 100%)',
              }}>
                <div style={{
                  display: 'flex',
                  transform: `translateX(${stripTx}px)`,
                  transition: stripTransition,
                  willChange: 'transform',
                }}>
                  {speciesStrip.map((id, i) => (
                    <div key={i} style={{
                      width: ITEM_WIDTH, flexShrink: 0, textAlign: 'center',
                      padding: '8px 0', boxSizing: 'border-box',
                    }}>
                      <FlowerSVG size={100} species={id} quality="perfect" animate={false} />
                      <div style={{ font: "600 12px 'ZCOOL KuaiLe'", color: '#fff', marginTop: 2, opacity: 0.85 }}>
                        {FLOWERS[id]?.name}
                      </div>
                    </div>
                  ))}
                </div>
                {/* center selection indicator */}
                <div style={{
                  position: 'absolute', top: 0, bottom: 0, left: '50%',
                  width: ITEM_WIDTH, transform: 'translateX(-50%)',
                  border: '2px solid #ffd24a', borderRadius: 14,
                  pointerEvents: 'none',
                  boxShadow: '0 0 16px rgba(255,210,74,0.5), inset 0 0 12px rgba(255,210,74,0.2)',
                }} />
              </div>
            )}
            {phase === 'result' && lastAttempt && (
              <div className="sg-flower-card" style={{ textAlign: 'center' }}>
                <RarityFrame rarity={lastAttempt.rarity} padding={6} radius={22} animate={true}
                  style={{ marginBottom: 14 }}>
                  <div style={{ padding: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
                    <FlowerSVG size={160} species={lastAttempt.speciesId} quality="perfect" animate />
                    <QualityFx quality="perfect" rarity={lastAttempt.rarity} />
                    <WindLeaves />
                  </div>
                </RarityFrame>
                <RarityBadge rarity={lastAttempt.rarity} size="lg" />
                <h2 style={{ font: "700 26px 'ZCOOL KuaiLe'", margin: '10px 0 4px', color: '#fff' }}>
                  {FLOWERS[lastAttempt.speciesId]?.name}
                </h2>
                <p style={{ font: "500 13px 'Noto Sans SC'", color: '#cfe3be', margin: '0 0 18px', maxWidth: 280 }}>
                  {FLOWERS[lastAttempt.speciesId]?.desc}
                </p>
              </div>
            )}
          </div>

          {/* Actions (only in result phase) */}
          {phase === 'result' && (
            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={keep} style={{
                padding: '14px 28px', borderRadius: 18,
                border: '3px solid #fff', background: '#6ab04c', color: '#fff',
                font: "700 16px 'Noto Sans SC'", boxShadow: '0 4px 0 rgba(0,0,0,0.3)', cursor: 'pointer',
              }}>✓ 保留这朵</button>
              {allocated - used > 0 && (
                <button onClick={reroll} style={{
                  padding: '14px 22px', borderRadius: 18,
                  border: '3px solid #fff', background: 'transparent', color: '#fff',
                  font: "700 14px 'Noto Sans SC'", cursor: 'pointer',
                }}>🔄 再抽一次（剩 {allocated - used}）</button>
              )}
            </div>
          )}
        </>
      )}

      {/* Keyframes come from the global rarity-styles injection at the top of this file. */}
    </div>
  );
}

// PlantYesterday is folded into FlowerField below. The field automatically enters
// "plant mode" whenever there's a kept-but-unplanted past day.

// ============ FLOWER FIELD (primary garden view + plant mode) ============
// Visual plan:
//  - No pots. Flowers stand free in a green-to-soil gradient field.
//  - Row-based depth: back rows smaller + lower z-index, front rows larger +
//    higher z-index, so front flowers visually overlap back ones (层层叠叠).
//  - Deterministic per-slot tilt (-6°..+6°) for natural scatter.
//  - Plant mode: triggered automatically when there's an unplanted past day
//    (normal flow) or when debug seeds one. Empty slots pulse; clicking one
//    calls plantAt and, if more dates are queued, the next one loads.
function FlowerField({ state, setState, onClose, onOpenHistory }) {
  const plantings = [];
  for (const date of Object.keys(state.days)) {
    const d = state.days[date];
    if (!d.plantedAt?.slotId) continue;
    const flower = keptFlowerFor(state, date);
    if (!flower) continue;
    const quality = qualityFromPacing(totalForDay(d), state.settings.dailyLimit, 1.0);
    plantings.push({ date, slotId: d.plantedAt.slotId, flower, quality });
  }
  const bySlot = {};
  for (const p of plantings) bySlot[p.slotId] = p;

  // Detect the earliest unplanted spun past day → enter plant mode
  const unplanted = unplantedSpunDates(state);
  const plantDate = unplanted[0] || null;
  const plantFlower = plantDate ? keptFlowerFor(state, plantDate) : null;
  const plantQuality = plantDate ? qualityFromPacing(
    totalForDay(state.days[plantDate]), state.settings.dailyLimit, 1.0
  ) : 'perfect';
  const inPlantMode = !!plantFlower;

  const [selected, setSelected] = useState(null);

  function pickSlot(slotId) {
    if (!plantDate) return;
    if (bySlot[slotId]) return;
    const next = plantAt(state, plantDate, slotId);
    setState?.(next);
  }

  // Unified wind: rAF-driven CSS variable on the field container. Every flower
  // reads `var(--wind-deg)` in its transform so they all lean the same direction.
  // Mouse position tilts the wind stronger toward the cursor side; when no mouse,
  // a slow sin wave keeps the field alive.
  const fieldRef = useRef(null);
  const mouseRef = useRef({ x: 0.5, active: false });

  useEffect(() => {
    let raf, start = performance.now();
    const tick = (t) => {
      const elapsed = (t - start) / 1000;
      // Two layered sines so it doesn't feel metronomic.
      const base = Math.sin(elapsed * 0.75) * 2.4 + Math.sin(elapsed * 1.3 + 0.8) * 0.8;
      const m = mouseRef.current;
      const pull = m.active ? (m.x - 0.5) * 16 : 0;
      const angle = (base + pull).toFixed(2);
      if (fieldRef.current) fieldRef.current.style.setProperty('--wind-deg', `${angle}deg`);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  function onFieldMove(e) {
    const r = fieldRef.current?.getBoundingClientRect();
    if (!r) return;
    const touch = e.touches?.[0];
    const clientX = touch ? touch.clientX : e.clientX;
    mouseRef.current = { x: Math.max(0, Math.min(1, (clientX - r.left) / r.width)), active: true };
  }
  function onFieldLeave() { mouseRef.current = { ...mouseRef.current, active: false }; }

  // Row-based layered sizing + z-index for depth.
  function slotPresentation(slot) {
    const size = 58 + slot.row * 7;   // 58..93
    const zIndex = slot.row + 1;
    // tiny deterministic vertical jitter so rows aren't perfectly straight
    const h = hashStr(slot.id);
    const dy = ((h >> 4) % 7) - 3;    // -3..+3 px
    return { size, zIndex, dy };
  }

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 45,
      background: 'linear-gradient(180deg, #bfe0a5 0%, #e9f1df 100%)',
      display: 'flex', flexDirection: 'column' }}>

      {/* Header */}
      <div style={{ padding: '16px 18px 8px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <button onClick={onClose} style={{ width: 36, height: 36, borderRadius: 12,
          border: '2px solid #23331f', background: '#fff', fontSize: 16, cursor: 'pointer', boxShadow: '0 2px 0 #23331f' }}>←</button>
        <div style={{ flex: 1 }}>
          <div style={{ font: "700 20px 'ZCOOL KuaiLe'" }}>花田</div>
          <div style={{ font: "500 11px 'Noto Sans SC'", color: '#5c6d54' }}>
            已种 {plantings.length} 朵{inPlantMode ? ' · 选个空位种下这朵' : ''}
          </div>
        </div>
        <button onClick={onOpenHistory} title="历史记录" style={{
          padding: '8px 12px', borderRadius: 12, border: '2px solid #23331f',
          background: '#fff', font: "600 12px 'Noto Sans SC'", cursor: 'pointer', boxShadow: '0 2px 0 #23331f',
        }}>📅 历史</button>
      </div>

      {/* Plant-mode preview banner (shown above field) */}
      {inPlantMode && (
        <div style={{ margin: '0 14px 8px', display: 'flex', justifyContent: 'center' }}>
          <RarityFrame rarity={plantFlower.rarity} padding={4} radius={14}>
            <div style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 10, position: 'relative' }}>
              <div style={{ position: 'relative', width: 54, height: 54 }}>
                <FlowerSVG size={54} species={plantFlower.speciesId} quality={plantQuality} animate headOnly />
              </div>
              <div style={{ textAlign: 'left' }}>
                <RarityBadge rarity={plantFlower.rarity} size="sm" />
                <div style={{ font: "700 14px 'ZCOOL KuaiLe'", marginTop: 2 }}>
                  {FLOWERS[plantFlower.speciesId]?.name}
                </div>
              </div>
            </div>
          </RarityFrame>
        </div>
      )}

      {/* Field canvas */}
      <div
        ref={fieldRef}
        onMouseMove={onFieldMove} onMouseLeave={onFieldLeave}
        onTouchMove={onFieldMove} onTouchEnd={onFieldLeave}
        style={{ flex: 1, margin: '4px 14px 14px', position: 'relative',
          background: 'linear-gradient(180deg, #c8e8a8 0%, #8ac260 45%, #d9b88a 100%)',
          borderRadius: 24, border: '3px solid #7c6142',
          boxShadow: 'inset 0 8px 20px rgba(0,0,0,0.12)', overflow: 'hidden',
          // CSS custom property updated at ~60Hz by the rAF tick above.
          '--wind-deg': '0deg',
        }}>

        {/* Decorative grass tufts at top edge */}
        <svg viewBox="0 0 400 40" preserveAspectRatio="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 28, width: '100%', zIndex: 0 }}>
          <path d="M0 40 Q20 10 40 40 Q60 15 80 40 Q100 5 120 40 Q140 18 160 40 Q180 8 200 40 Q220 20 240 40 Q260 10 280 40 Q300 15 320 40 Q340 5 360 40 Q380 18 400 40 Z" fill="#7ab985" opacity="0.85" />
        </svg>

        {/* Soil patches at bottom */}
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '18%',
          background: 'linear-gradient(180deg, transparent, rgba(124, 97, 66, 0.25))', zIndex: 0 }} />

        {/* Slots */}
        {FIELD_SLOTS.map(slot => {
          const p = bySlot[slot.id];
          const { size, zIndex, dy } = slotPresentation(slot);
          const left = `${slot.x}%`;
          const top = `calc(${slot.y}% + ${dy}px)`;

          if (p) {
            const glowing = RARITY_ORDER.indexOf(p.flower.rarity) >= 3;
            return (
              <button key={slot.id}
                onClick={inPlantMode ? undefined : () => setSelected(p)}
                className="sg-flower-card"
                disabled={inPlantMode}
                style={{
                  position: 'absolute', left, top, zIndex,
                  width: size, height: size * 1.4,
                  // All flowers share the same wind-deg CSS var → they lean together.
                  transform: 'translate(-50%, -75%) rotate(var(--wind-deg, 0deg))',
                  transformOrigin: '50% 90%',   // pivot near stem base
                  background: 'transparent', border: 'none',
                  cursor: inPlantMode ? 'default' : 'pointer', padding: 0,
                  pointerEvents: inPlantMode ? 'none' : 'auto',
                  opacity: inPlantMode ? 0.85 : 1,
                  filter: glowing
                    ? `drop-shadow(0 0 10px ${p.flower.rarity === 'UR' ? 'rgba(255,210,74,0.6)' : RARITY_META[p.flower.rarity].colorSoft})`
                    : 'drop-shadow(0 4px 6px rgba(0,0,0,0.18))',
                  transition: 'transform 0.35s cubic-bezier(0.3, 0.7, 0.4, 1), opacity 0.25s',
                }}
              >
                <FlowerSVG size={size} species={p.flower.speciesId} quality={p.quality} animate />
              </button>
            );
          }

          // Empty slot: subtle dot in view mode; pulsing + in plant mode
          return (
            <button key={slot.id}
              disabled={!inPlantMode}
              onClick={() => pickSlot(slot.id)}
              style={{
                position: 'absolute', left, top, zIndex: zIndex - 1,
                width: inPlantMode ? 36 : 16, height: inPlantMode ? 36 : 16,
                transform: 'translate(-50%, -50%)',
                borderRadius: '50%',
                background: inPlantMode ? 'rgba(255, 240, 160, 0.8)' : 'rgba(90, 60, 30, 0.18)',
                border: inPlantMode ? '2px dashed #7c4a1d' : 'none',
                cursor: inPlantMode ? 'pointer' : 'default',
                display: 'grid', placeItems: 'center', padding: 0,
                animation: inPlantMode ? 'sg-pulse-slot 1.8s ease-in-out infinite' : 'none',
                color: '#5a3a20', font: "700 14px 'Noto Sans SC'",
              }}>
              {inPlantMode ? '＋' : null}
            </button>
          );
        })}

        <style>{`
          @keyframes sg-pulse-slot {
            0%,100% { transform: translate(-50%, -50%) scale(1); opacity: 0.7; }
            50%     { transform: translate(-50%, -50%) scale(1.2); opacity: 1; }
          }
        `}</style>
      </div>

      {/* Detail modal (view mode only) */}
      {selected && (
        <div onClick={() => setSelected(null)} style={{
          position: 'absolute', inset: 0, zIndex: 50,
          background: 'rgba(35,51,31,0.55)',
          display: 'grid', placeItems: 'center', padding: 20,
        }}>
          <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 320 }}>
            <RarityFrame rarity={selected.flower.rarity} padding={6} radius={22}>
              <div style={{ padding: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
                <FlowerSVG size={140} species={selected.flower.speciesId} quality={selected.quality} animate />
                <QualityFx quality={selected.quality} rarity={selected.flower.rarity} />
                <div style={{ marginTop: 8 }}><RarityBadge rarity={selected.flower.rarity} size="md" /></div>
                <div style={{ font: "700 20px 'ZCOOL KuaiLe'", marginTop: 6 }}>
                  {FLOWERS[selected.flower.speciesId]?.name}
                </div>
                <div style={{ font: "500 12px 'Noto Sans SC'", color: '#5c6d54', marginTop: 2, textAlign: 'center' }}>
                  {FLOWERS[selected.flower.speciesId]?.desc}
                </div>
                <div style={{ font: "500 11px 'Noto Sans SC'", color: '#8a9a85', marginTop: 10 }}>
                  {(() => { const d = parseYMD(selected.date); return `${d.getMonth() + 1}月${d.getDate()}日 · ${QUALITY_LABEL[selected.quality] || selected.quality}`; })()}
                </div>
                <button onClick={() => setSelected(null)} style={{
                  marginTop: 14, padding: '8px 20px', borderRadius: 14,
                  border: '2px solid #23331f', background: '#fff',
                  font: "600 12px 'Noto Sans SC'", cursor: 'pointer',
                }}>关闭</button>
              </div>
            </RarityFrame>
          </div>
        </div>
      )}
    </div>
  );
}

const QUALITY_LABEL = {
  perfect: '完美', great: '很好', ok: '还行', okish: '勉强', wilted: '蔫了', dead: '枯萎',
};

// ============ WELCOME / CHOICE (new family vs join) ============
function WelcomeScreen({ onChoose }) {
  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 40,
      background: 'linear-gradient(180deg, #e9f1df 0%, #f3f8ee 70%)',
      padding: '48px 24px 24px', display: 'flex', flexDirection: 'column',
    }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', textAlign: 'center' }}>
        <div style={{ display: 'grid', placeItems: 'center', height: 220, marginBottom: 8 }}>
          <FlowerSVG size={180} species="c-daisy" quality="perfect" animate />
        </div>
        <h1 style={{ font: "700 36px/1.1 'ZCOOL KuaiLe'", margin: 0, color: '#23331f' }}>糖糖花园</h1>
        <p style={{ font: "500 14px/1.6 'Noto Sans SC'", color: '#5c6d54', margin: '18px 24px 0' }}>
          每天少吃一点糖，花园就会多一朵花。<br/>温柔地记录，慢慢地看见自己。
        </p>
      </div>
      <button onClick={() => onChoose('new')} style={{
        padding: 16, borderRadius: 22, border: '3px solid #23331f',
        background: '#23331f', color: '#fff', font: "700 17px 'Noto Sans SC'",
        boxShadow: '0 4px 0 #101a0e', cursor: 'pointer', marginBottom: 10,
      }}>🌱 开启新家庭</button>
      <button onClick={() => onChoose('join')} style={{
        padding: 14, borderRadius: 22, border: '3px solid #23331f',
        background: '#fff', color: '#23331f', font: "700 15px 'Noto Sans SC'",
        boxShadow: '0 4px 0 #23331f', cursor: 'pointer',
      }}>🔗 加入家人的花园</button>
      <div style={{ textAlign: 'center', font: "500 11px 'Noto Sans SC'", color: '#5c6d54', marginTop: 10 }}>
        数据同步到云端，家人之间共用一个花园
      </div>
      <div style={{ textAlign: 'center', marginTop: 18, display: 'flex', justifyContent: 'center', gap: 18 }}>
        <a href="./rules.html" style={{
          font: "600 12px 'Noto Sans SC'", color: '#5c6d54',
          textDecoration: 'none', borderBottom: '1px dashed #5c6d54', paddingBottom: 1,
        }}>📖 游戏规则</a>
        <a href="./gallery.html" style={{
          font: "600 12px 'Noto Sans SC'", color: '#5c6d54',
          textDecoration: 'none', borderBottom: '1px dashed #5c6d54', paddingBottom: 1,
        }}>🌻 花朵图鉴</a>
      </div>
    </div>
  );
}

// ============ NEW FAMILY ONBOARDING (Journey 1) ============
// Collects: child name/dob/limit, then parent role name, then Turnstile + register.
function NewFamilyOnboarding({ onDone, onBack, busy, errorMsg }) {
  const [step, setStep] = useState(0);   // 0 name, 1 dob, 2 limit, 3 who-are-you+turnstile
  const [name, setName] = useState('');
  const [dob, setDob] = useState('');
  const age = dob ? ageFromDob(dob) : null;
  const limit = age ? defaultLimitByAge(age) : 19;
  const [customLimit, setCustomLimit] = useState(null);
  const [me, setMe] = useState('');
  const [turnstileToken, setTurnstileToken] = useState(null);
  const tsContainer = useRef(null);

  const finalLimit = customLimit ?? limit;
  const totalSteps = 4;
  const canNext = step === 0 ? name.trim().length > 0 :
                  step === 1 ? !!dob :
                  step === 2 ? true :
                  me.trim().length > 0 && (!!turnstileToken || !SG_CONFIG.turnstileSiteKey);

  useEffect(() => {
    if (step !== 3) return;
    if (!tsContainer.current) return;
    if (!SG_CONFIG.turnstileSiteKey) { setTurnstileToken('__no_turnstile__'); return; }
    tsContainer.current.innerHTML = '';
    renderTurnstile(tsContainer.current).then(t => setTurnstileToken(t));
  }, [step]);

  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 40,
      background: 'linear-gradient(180deg, #e9f1df 0%, #f3f8ee 70%)',
      padding: '48px 24px 24px', display: 'flex', flexDirection: 'column',
    }}>
      <button onClick={onBack} style={{
        alignSelf: 'flex-start', border: 'none', background: 'transparent',
        font: "500 13px 'Noto Sans SC'", color: '#5c6d54', cursor: 'pointer', padding: 0, marginBottom: 4,
      }}>← 返回</button>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        {step === 0 && (
          <div>
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <div style={{ fontSize: 64 }}>🌱</div>
            </div>
            <h2 style={{ font: "700 26px 'ZCOOL KuaiLe'", margin: 0, textAlign: 'center' }}>小朋友叫什么名字？</h2>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="输入名字" maxLength={8}
              style={{ width: '100%', marginTop: 24, padding: '16px 20px', fontSize: 20,
                border: '3px solid #23331f', borderRadius: 18, background: '#fff',
                font: "500 20px 'Noto Sans SC'", textAlign: 'center',
                boxShadow: '0 4px 0 #23331f' }} />
          </div>
        )}
        {step === 1 && (
          <div>
            <div style={{ textAlign: 'center', marginBottom: 18 }}>
              <div style={{ fontSize: 54 }}>🎂</div>
            </div>
            <h2 style={{ font: "700 24px 'ZCOOL KuaiLe'", margin: 0, textAlign: 'center' }}>
              {name} 的生日是？
            </h2>
            <p style={{ font: "500 12px 'Noto Sans SC'", color: '#5c6d54', textAlign: 'center', marginTop: 4 }}>
              我们根据年龄推荐每日上限
            </p>
            <input type="date" value={dob} onChange={e => setDob(e.target.value)} max={ymd(new Date())}
              style={{ width: '100%', marginTop: 20, padding: '14px 18px',
                border: '3px solid #23331f', borderRadius: 18, background: '#fff',
                font: "500 18px 'Noto Sans SC'", boxShadow: '0 4px 0 #23331f' }} />
            {age !== null && (
              <div style={{ marginTop: 20, padding: 14, background: '#fff', border: '2px solid #cfe3be', borderRadius: 16, textAlign: 'center' }}>
                <div style={{ font: "500 12px 'Noto Sans SC'", color: '#5c6d54' }}>{name} 今年</div>
                <div style={{ font: "800 36px 'Baloo 2'", color: '#3b6e2b' }}>{age}<span style={{ fontSize: 16, fontWeight: 600 }}>岁</span></div>
              </div>
            )}
          </div>
        )}
        {step === 2 && (
          <div>
            <div style={{ textAlign: 'center', marginBottom: 18 }}>
              <div style={{ fontSize: 54 }}>🍬</div>
            </div>
            <h2 style={{ font: "700 24px 'ZCOOL KuaiLe'", margin: 0, textAlign: 'center' }}>
              每天最多吃多少糖？
            </h2>
            <p style={{ font: "500 12px/1.6 'Noto Sans SC'", color: '#5c6d54', textAlign: 'center', marginTop: 6 }}>
              WHO 建议 {age} 岁每日游离糖不超过 <b>{limit}g</b>
            </p>
            <div style={{ display: 'flex', gap: 8, marginTop: 20, justifyContent: 'center' }}>
              {[limit - 4, limit, limit + 4].map(v => (
                <button key={v} onClick={() => setCustomLimit(v)}
                  style={{
                    flex: 1, maxWidth: 100, padding: '14px 0', borderRadius: 18,
                    border: '3px solid #23331f', cursor: 'pointer',
                    background: finalLimit === v ? '#6ab04c' : '#fff',
                    color: finalLimit === v ? '#fff' : '#23331f',
                    font: "800 22px 'Baloo 2'", boxShadow: '0 4px 0 #23331f',
                  }}>{v}g</button>
              ))}
            </div>
            <div style={{ marginTop: 12, textAlign: 'center' }}>
              <input type="number" value={customLimit ?? limit} min={5} max={60}
                onChange={e => setCustomLimit(Math.max(5, Math.min(60, Number(e.target.value) || limit)))}
                style={{ width: 120, padding: 10, borderRadius: 12, border: '2px solid #cfe3be',
                  font: "700 18px 'Baloo 2'", textAlign: 'center' }} />
              <span style={{ marginLeft: 6, font: "500 14px 'Noto Sans SC'", color: '#5c6d54' }}>克 / 天</span>
            </div>
          </div>
        )}
        {step === 3 && (
          <div>
            <div style={{ textAlign: 'center', marginBottom: 18 }}>
              <div style={{ fontSize: 54 }}>👤</div>
            </div>
            <h2 style={{ font: "700 24px 'ZCOOL KuaiLe'", margin: 0, textAlign: 'center' }}>
              记录的人是你？
            </h2>
            <p style={{ font: "500 12px 'Noto Sans SC'", color: '#5c6d54', textAlign: 'center', marginTop: 4 }}>
              家人之间区分一下，方便知道是谁录的
            </p>
            <div style={{ display: 'flex', gap: 8, marginTop: 18, justifyContent: 'center', flexWrap: 'wrap' }}>
              {['爸爸', '妈妈', '外婆', '奶奶'].map(v => (
                <button key={v} onClick={() => setMe(v)} style={{
                  padding: '10px 18px', borderRadius: 16, border: '2.5px solid #23331f',
                  background: me === v ? '#6ab04c' : '#fff', color: me === v ? '#fff' : '#23331f',
                  font: "700 14px 'Noto Sans SC'", boxShadow: '0 3px 0 #23331f', cursor: 'pointer',
                }}>{v}</button>
              ))}
            </div>
            <input value={me} onChange={e => setMe(e.target.value)} placeholder="或输入其他称呼" maxLength={16}
              style={{ width: '100%', marginTop: 14, padding: 14, border: '2px solid #cfe3be',
                borderRadius: 14, font: "500 15px 'Noto Sans SC'", textAlign: 'center' }} />
            {SG_CONFIG.turnstileSiteKey && (
              <div style={{ marginTop: 18, display: 'grid', placeItems: 'center' }}>
                <div ref={tsContainer}></div>
              </div>
            )}
            {errorMsg && (
              <div style={{ marginTop: 14, padding: 12, background: '#fff2f0',
                border: '2px solid #c2453c', borderRadius: 12, textAlign: 'center',
                font: "500 12px 'Noto Sans SC'", color: '#c2453c' }}>{errorMsg}</div>
            )}
          </div>
        )}
      </div>

      <button disabled={!canNext || busy}
        onClick={() => {
          if (step < 3) setStep(step + 1);
          else onDone({
            childName: name.trim(), dateOfBirth: dob, dailyLimit: finalLimit,
            memberName: me.trim(), turnstileToken: turnstileToken === '__no_turnstile__' ? null : turnstileToken,
          });
        }}
        style={{
          padding: 16, borderRadius: 22, border: '3px solid #23331f',
          background: canNext && !busy ? '#23331f' : '#8a9a85', color: '#fff',
          font: "700 18px 'Noto Sans SC'", boxShadow: '0 4px 0 #101a0e',
          cursor: canNext && !busy ? 'pointer' : 'not-allowed', opacity: canNext && !busy ? 1 : 0.6,
        }}>
        {busy ? '创建中…' : step === 3 ? '去花园种第一朵花 🌱' : '继续'}
      </button>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 14 }}>
        {Array.from({length: totalSteps}).map((_, i) => (
          <div key={i} style={{
            width: i === step ? 22 : 8, height: 8, borderRadius: 4,
            background: i === step ? '#23331f' : '#c5d3ba', transition: 'width 0.2s',
          }} />
        ))}
      </div>
    </div>
  );
}

// ============ JOIN FAMILY FLOW ============
function JoinFamilyFlow({ inviteFrag, onDone, onBack, busy, errorMsg }) {
  const [me, setMe] = useState('');
  const [paste, setPaste] = useState('');
  const [frag, setFrag] = useState(inviteFrag || null);

  useEffect(() => {
    if (inviteFrag) setFrag(inviteFrag);
  }, [inviteFrag]);

  function tryPaste(v) {
    setPaste(v);
    const m = v.match(/join=([0-9a-f-]+)\.([A-Za-z0-9_-]+)/i);
    if (m) setFrag({ familyId: m[1], token: m[2] });
  }

  const canNext = frag && me.trim().length > 0;

  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 40,
      background: 'linear-gradient(180deg, #e9f1df 0%, #f3f8ee 70%)',
      padding: '48px 24px 24px', display: 'flex', flexDirection: 'column',
    }}>
      <button onClick={onBack} style={{
        alignSelf: 'flex-start', border: 'none', background: 'transparent',
        font: "500 13px 'Noto Sans SC'", color: '#5c6d54', cursor: 'pointer', padding: 0, marginBottom: 4,
      }}>← 返回</button>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', marginBottom: 12 }}>
          <div style={{ fontSize: 56 }}>🔗</div>
          <h2 style={{ font: "700 24px 'ZCOOL KuaiLe'", margin: '10px 0 4px' }}>加入家庭</h2>
          <p style={{ font: "500 12px 'Noto Sans SC'", color: '#5c6d54', margin: 0 }}>
            {frag ? '邀请已识别，告诉我们你是谁' : '粘贴家人发给你的邀请链接'}
          </p>
        </div>
        {!frag && (
          <textarea value={paste} onChange={e => tryPaste(e.target.value)}
            placeholder="粘贴邀请链接，例如 https://…#join=…" rows={3}
            style={{ width: '100%', padding: 12, border: '2px solid #cfe3be',
              borderRadius: 14, font: "500 13px 'Noto Sans SC'", resize: 'none' }} />
        )}
        {frag && (
          <div style={{ padding: 14, background: '#fff', border: '2px solid #cfe3be', borderRadius: 16, marginBottom: 18 }}>
            <div style={{ font: "500 11px 'Noto Sans SC'", color: '#5c6d54' }}>邀请码</div>
            <div style={{ font: "600 12px 'Baloo 2'", color: '#23331f', wordBreak: 'break-all', marginTop: 4 }}>
              {frag.familyId.slice(0,8)}… · {frag.token.slice(0,8)}…
            </div>
          </div>
        )}
        {frag && (
          <>
            <h3 style={{ font: "700 18px 'ZCOOL KuaiLe'", margin: '6px 0 10px', textAlign: 'center' }}>你是？</h3>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
              {['爸爸', '妈妈', '外婆', '奶奶'].map(v => (
                <button key={v} onClick={() => setMe(v)} style={{
                  padding: '10px 18px', borderRadius: 16, border: '2.5px solid #23331f',
                  background: me === v ? '#6ab04c' : '#fff', color: me === v ? '#fff' : '#23331f',
                  font: "700 14px 'Noto Sans SC'", boxShadow: '0 3px 0 #23331f', cursor: 'pointer',
                }}>{v}</button>
              ))}
            </div>
            <input value={me} onChange={e => setMe(e.target.value)} placeholder="或输入其他称呼" maxLength={16}
              style={{ width: '100%', marginTop: 14, padding: 14, border: '2px solid #cfe3be',
                borderRadius: 14, font: "500 15px 'Noto Sans SC'", textAlign: 'center' }} />
          </>
        )}
        {errorMsg && (
          <div style={{ marginTop: 14, padding: 12, background: '#fff2f0',
            border: '2px solid #c2453c', borderRadius: 12, textAlign: 'center',
            font: "500 12px 'Noto Sans SC'", color: '#c2453c' }}>{errorMsg}</div>
        )}
      </div>

      <button disabled={!canNext || busy}
        onClick={() => onDone({ frag, memberName: me.trim() })}
        style={{
          padding: 16, borderRadius: 22, border: '3px solid #23331f',
          background: canNext && !busy ? '#23331f' : '#8a9a85', color: '#fff',
          font: "700 18px 'Noto Sans SC'", boxShadow: '0 4px 0 #101a0e',
          cursor: canNext && !busy ? 'pointer' : 'not-allowed', opacity: canNext && !busy ? 1 : 0.6,
        }}>
        {busy ? '正在加入…' : '进入花园 🌸'}
      </button>
    </div>
  );
}

// PlantingCeremony removed (replaced by SpinWheel + PlantYesterday above).

// ============ TOMORROW PROBABILITY PANEL ============
// Shows tomorrow's rarity distribution + pull count, live-derived from today's
// current quality (sugar vs time pacing). As the kid eats more sugar, the bars
// redistribute to show the real consequence.
function TomorrowProbPanel({ state, now }) {
  const today = ymd(now || new Date());
  const day = state.days[today];
  const total = day ? totalForDay(day) : 0;
  const expected = expectedProgress(now || new Date());
  const liveQuality = qualityFromPacing(total, state.settings.dailyLimit, expected);
  const weights = rarityProbForQuality(liveQuality);
  const pulls = PULLS_FOR_QUALITY[liveQuality] || DEFAULT_PULLS;
  return (
    <div style={{
      padding: '10px 14px', background: '#fff',
      border: '2px solid #23331f', borderRadius: 16, boxShadow: '0 3px 0 #23331f',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
        <div style={{ font: "700 12px 'Noto Sans SC'", color: '#23331f' }}>
          🎲 明天抽卡概率
        </div>
        <div style={{ font: "500 10px 'Noto Sans SC'", color: '#8a9a85' }}>
          今天吃糖影响明天
        </div>
      </div>
      {/* Stacked bar */}
      <div style={{ display: 'flex', height: 16, borderRadius: 8, overflow: 'hidden', border: '1.5px solid #23331f' }}>
        {RARITY_ORDER.map(r => {
          const w = weights[r];
          const m = RARITY_META[r];
          const isRb = r === 'UR';
          return (
            <div key={r} title={`${r} ${(w * 100).toFixed(1)}%`} style={{
              width: `${w * 100}%`,
              background: isRb ? RAINBOW_LINEAR_LOOP : m.color,
              backgroundSize: isRb ? '400% 100%' : undefined,
              animation: isRb ? 'sg-rainbow-slide 8s linear infinite' : null,
              transition: 'width 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
            }} />
          );
        })}
      </div>
      {/* Percentage labels under each tier */}
      <div style={{ display: 'flex', marginTop: 6, gap: 2 }}>
        {RARITY_ORDER.map(r => {
          const w = weights[r];
          return (
            <div key={r} style={{
              flex: w, minWidth: 0, textAlign: 'center',
              font: "700 10px 'Baloo 2'", color: '#23331f', whiteSpace: 'nowrap',
            }}>
              {r}<span style={{ fontWeight: 500, color: '#5c6d54' }}> {Math.round(w * 100)}%</span>
            </div>
          );
        })}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, font: "500 10px 'Noto Sans SC'", color: '#5c6d54' }}>
        <span>当前品质：<b style={{ color: '#23331f' }}>{QUALITY_LABEL[liveQuality] || liveQuality}</b></span>
        <span>明天抽卡：<b style={{ color: '#23331f' }}>{pulls}</b> 次</span>
      </div>
    </div>
  );
}

// ============ TODAY SCREEN ============
function TodayScreen({ state, setState, onOpenPicker, onOpenSchool, onOpenField, onOpenSettings, onOpenTrend, onOpenHistory }) {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(t);
  }, []);

  const date = ymd(now);
  const status = dayStatus(state, date, now);
  const name = state.settings.childName || '小宝贝';
  const day = state.days[date] || { entries: [], schoolSugar: 0 };
  const isSchoolDay = isWeekday(date);
  const kept = keptFlowerFor(state, date);
  const quality = status.quality;
  const healthMsg = quality === 'perfect' ? `${name}今天状态超好！花开得最漂亮` :
                    quality === 'great'  ? `${name}今天吃得刚刚好` :
                    quality === 'ok'     ? '花还挺精神的，小心一点哦' :
                    quality === 'okish'  ? '花头有点歪了，省着点吃' :
                    quality === 'wilted' ? '花蔫了…喝杯水吧' :
                                           '花枯了，明天重来';
  const qualityColor = quality === 'perfect' || quality === 'great' ? '#3b6e2b' :
                       quality === 'ok' ? '#6ab04c' :
                       quality === 'okish' ? '#d68c1f' : '#c2453c';

  return (
    <div style={{ height: '100%', overflowY: 'auto', paddingBottom: 40,
      background: 'linear-gradient(180deg, #f3f8ee 0%, #e9f1df 100%)' }}>
      {/* Sticky header */}
      <div style={{
        padding: '16px 20px 10px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10,
      }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ font: "500 11px 'Noto Sans SC'", color: '#5c6d54' }}>
            {now.toLocaleDateString('zh-CN', { weekday: 'long', month: 'long', day: 'numeric' })}
          </div>
          <div style={{ font: "700 22px 'ZCOOL KuaiLe'", color: '#23331f', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {name}的花园
          </div>
        </div>
        <button onClick={onOpenSettings} style={{
          width: 38, height: 38, borderRadius: 12, border: '2px solid #23331f',
          background: '#fff', fontSize: 16, cursor: 'pointer', boxShadow: '0 2px 0 #23331f',
        }}>⚙</button>
      </div>

      {/* Today's kept flower in rarity frame */}
      {kept ? (
        <div className="sg-flower-card" style={{ margin: '8px 18px 0' }}>
          <RarityFrame rarity={kept.rarity} padding={6} radius={22}>
            <div style={{ padding: '16px 16px 18px', position: 'relative' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                <div style={{ font: "500 11px 'Noto Sans SC'", color: '#5c6d54' }}>🌸 今日抽到</div>
                <RarityBadge rarity={kept.rarity} size="sm" />
              </div>
              <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                <div style={{ position: 'relative', width: 120, height: 140, flexShrink: 0, display: 'grid', placeItems: 'center' }}>
                  <FlowerSVG size={110} species={kept.speciesId} quality={quality} animate />
                  <QualityFx quality={quality} rarity={kept.rarity} />
                  <WindLeaves />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ font: "700 18px 'ZCOOL KuaiLe'", color: '#23331f' }}>
                    {FLOWERS[kept.speciesId]?.name}
                  </div>
                  <div style={{ font: "500 11px/1.5 'Noto Sans SC'", color: '#5c6d54', marginTop: 2 }}>
                    {FLOWERS[kept.speciesId]?.desc}
                  </div>
                  <div style={{ marginTop: 10, display: 'flex', alignItems: 'baseline', gap: 4 }}>
                    <div style={{ font: "800 30px 'Baloo 2'", color: status.ratio >= 1 ? '#c2453c' : '#23331f', lineHeight: 1 }}>
                      {status.total}
                    </div>
                    <div style={{ font: "600 14px 'Baloo 2'", color: '#5c6d54' }}>/{status.limit}g</div>
                  </div>
                  <div style={{ font: "500 11px 'Noto Sans SC'", color: '#5c6d54', marginTop: 2 }}>
                    {status.ratio < 1 ? `还能吃 ${Math.round(status.limit - status.total)}g` : `超出 ${Math.round(status.total - status.limit)}g`}
                  </div>
                </div>
              </div>
              <div style={{ font: "600 13px 'Noto Sans SC'", color: qualityColor, marginTop: 10, textAlign: 'center' }}>
                {healthMsg} · <span style={{ color: '#8a9a85', fontWeight: 500 }}>{QUALITY_LABEL[quality] || quality}</span>
              </div>
            </div>
          </RarityFrame>
        </div>
      ) : (
        <div style={{ margin: '8px 18px 0', padding: 20,
          background: '#fff', border: '2px dashed #cfe3be', borderRadius: 20, textAlign: 'center',
          font: "500 13px 'Noto Sans SC'", color: '#5c6d54' }}>
          还没有今日的花，等会儿会自动开始抽卡 ✨
        </div>
      )}

      {/* Progress bar with 3 segments */}
      <div style={{ margin: '14px 18px 0' }}>
        <SegmentedProgress total={status.total} limit={status.limit} expected={status.expected}
          entries={day.entries} schoolSugar={day.schoolSugar} />
      </div>

      {/* Tomorrow's gacha odds — updates live with today's sugar */}
      <div style={{ margin: '14px 18px 0' }}>
        <TomorrowProbPanel state={state} now={now} />
      </div>

      {/* School (weekday) / free day */}
      <div style={{ margin: '14px 18px 0' }}>
        <SchoolCard date={date} isSchoolDay={isSchoolDay} day={day} onClick={onOpenSchool} />
      </div>

      {/* Quick-add + nav */}
      <div style={{ margin: '14px 18px 0', display: 'flex', gap: 10 }}>
        <button onClick={onOpenPicker} style={{
          flex: 1, padding: '14px 16px', borderRadius: 18,
          border: '2.5px solid #23331f', background: '#6ab04c', color: '#fff',
          font: "700 16px 'Noto Sans SC'", cursor: 'pointer',
          boxShadow: '0 4px 0 #23331f',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        }}>
          <span style={{ fontSize: 20 }}>🍭</span> 记一笔
        </button>
        <button onClick={onOpenField} title="花田" style={{
          width: 56, padding: '14px 0', borderRadius: 18,
          border: '2.5px solid #23331f', background: '#fff',
          fontSize: 22, cursor: 'pointer', boxShadow: '0 4px 0 #23331f',
        }}>🌻</button>
        <button onClick={onOpenTrend} title="趋势" style={{
          width: 56, padding: '14px 0', borderRadius: 18,
          border: '2.5px solid #23331f', background: '#fff',
          fontSize: 22, cursor: 'pointer', boxShadow: '0 4px 0 #23331f',
        }}>📈</button>
      </div>

      {/* Today log */}
      <div style={{ margin: '18px 18px 12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
          <div style={{ font: "700 15px 'ZCOOL KuaiLe'", color: '#23331f' }}>今天的糖糖日记</div>
          <div style={{ font: "500 11px 'Noto Sans SC'", color: '#5c6d54' }}>
            {day.entries.filter(e => !e.deleted).length} 条
          </div>
        </div>
        <EntryList entries={day.entries.filter(e => !e.deleted)} onDelete={(id) => setState(s => removeEntry(s, date, id))} />
      </div>

      {/* Help links — game rules + flower gallery */}
      <div style={{ textAlign: 'center', padding: '18px 18px 24px', display: 'flex', justifyContent: 'center', gap: 20 }}>
        <a href="./rules.html" style={{
          font: "600 12px 'Noto Sans SC'", color: '#5c6d54',
          textDecoration: 'none', borderBottom: '1px dashed #a8b0a0', paddingBottom: 1,
        }}>📖 游戏规则</a>
        <a href="./gallery.html" style={{
          font: "600 12px 'Noto Sans SC'", color: '#5c6d54',
          textDecoration: 'none', borderBottom: '1px dashed #a8b0a0', paddingBottom: 1,
        }}>🌻 花朵图鉴</a>
      </div>
    </div>
  );
}

function SegmentedProgress({ total, limit, expected, entries, schoolSugar }) {
  const ratio = Math.min(1.3, total / Math.max(1, limit));
  const barFill = Math.min(100, (total / limit) * 100);
  const overage = total > limit;
  return (
    <div>
      <div style={{
        position: 'relative', height: 26,
        background: '#fff', border: '2px solid #23331f', borderRadius: 13,
        overflow: 'hidden',
      }}>
        {/* fill */}
        <div style={{
          position: 'absolute', left: 0, top: 0, bottom: 0,
          width: `${barFill}%`,
          background: overage ? '#c2453c' : 'linear-gradient(90deg, #7ad9b5, #6ab04c, #ffd24a)',
          transition: 'width 0.4s',
        }} />
        {/* segment dividers */}
        {SEGMENTS.map((s, i) => i > 0 && (
          <div key={s.id} style={{
            position: 'absolute', top: 0, bottom: 0,
            left: `${((s.start - DAY_START_HOUR) / (DAY_END_HOUR - DAY_START_HOUR)) * 100}%`,
            width: 2, background: '#23331f', opacity: 0.6,
          }} />
        ))}
        {/* expected marker */}
        <div title="此刻应该的进度" style={{
          position: 'absolute', top: -3, bottom: -3,
          left: `${expected * 100}%`,
          width: 3, background: '#b892ff',
          borderRadius: 2,
        }} />
      </div>
      <div style={{ display: 'flex', marginTop: 6 }}>
        {SEGMENTS.map((s, i) => {
          const segTotal = entries
            .filter(e => { const h = new Date(e.ts).getHours(); return h >= s.start && h < s.end; })
            .reduce((a, b) => a + b.sugar, 0);
          return (
            <div key={s.id} style={{
              flex: s.end - s.start, textAlign: 'center',
              borderRight: i < 2 ? '1px dashed #c5d3ba' : 'none',
              padding: '0 4px',
            }}>
              <div style={{ font: "600 11px 'Noto Sans SC'", color: '#5c6d54' }}>{s.emoji} {s.label}</div>
              <div style={{ font: "700 12px 'Baloo 2'", color: segTotal > 0 ? '#23331f' : '#8a9a85' }}>
                {segTotal}g
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SchoolCard({ date, isSchoolDay, day, onClick }) {
  return (
    <button onClick={onClick} style={{
      width: '100%', display: 'flex', gap: 12, alignItems: 'center',
      padding: '12px 14px', background: '#fff',
      border: `2px solid ${day.schoolSugar > 0 ? '#b892ff' : '#cfe3be'}`,
      borderRadius: 16, cursor: 'pointer', textAlign: 'left',
    }}>
      <div style={{ fontSize: 24 }}>{isSchoolDay ? '🎒' : '🏠'}</div>
      <div style={{ flex: 1 }}>
        <div style={{ font: "700 13px 'Noto Sans SC'", color: '#23331f' }}>
          {isSchoolDay ? '工作日 · 今天有上学吗？' : '周末 · 在家度过'}
        </div>
        <div style={{ font: "500 11px 'Noto Sans SC'", color: '#5c6d54', marginTop: 2 }}>
          {day.schoolSugar > 0 ? `在校已吃 ${day.schoolSugar}g，家里还能吃 ${Math.max(0, day.dailyLimit)}g` :
           isSchoolDay ? '点这里填在校糖量' : '今天所有糖都记在这里'}
        </div>
      </div>
      <div style={{ color: '#8a9a85' }}>›</div>
    </button>
  );
}

function EntryList({ entries, onDelete }) {
  if (entries.length === 0) {
    return (
      <div style={{
        padding: 20, textAlign: 'center', color: '#5c6d54',
        font: "500 13px 'Noto Sans SC'",
        background: '#fff', border: '2px dashed #cfe3be', borderRadius: 16,
      }}>
        今天还没吃糖 ✨<br/>
        <span style={{ fontSize: 11 }}>吃的时候点上面按钮记一下</span>
      </div>
    );
  }
  const sorted = [...entries].sort((a, b) => b.ts - a.ts);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {sorted.map(e => {
        const t = new Date(e.ts);
        return (
          <div key={e.id} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px 12px', background: '#fff',
            borderRadius: 14, border: '1.5px solid #e6eadd',
          }}>
            <div style={{ width: 38, height: 38, borderRadius: 12, background: '#f3f8ee',
              display: 'grid', placeItems: 'center', fontSize: 20, border: '1.5px solid #e6eadd' }}>{e.emoji}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ font: "600 13px 'Noto Sans SC'", color: '#23331f', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.name}</div>
              <div style={{ font: "500 11px 'Noto Sans SC'", color: '#5c6d54' }}>
                {String(t.getHours()).padStart(2,'0')}:{String(t.getMinutes()).padStart(2,'0')}
              </div>
            </div>
            <div style={{ font: "800 15px 'Baloo 2'", color: '#6ab04c' }}>{e.sugar}g</div>
            <button onClick={() => onDelete(e.id)} title="删除"
              style={{ width: 26, height: 26, borderRadius: '50%', border: 'none',
                background: '#f0e7da', color: '#5c6d54', fontSize: 14, cursor: 'pointer' }}>×</button>
          </div>
        );
      })}
    </div>
  );
}

// ============ FOOD PICKER (Journey 3) ============
function FoodPicker({ open, onClose, onPick }) {
  const [cat, setCat] = useState('snack');
  const [customOpen, setCustomOpen] = useState(false);
  const [cn, setCn] = useState(''); const [cs, setCs] = useState('');

  useEffect(() => { if (open) { setCustomOpen(false); setCn(''); setCs(''); } }, [open]);
  if (!open) return null;
  const items = FOOD_LIBRARY.filter(f => f.category === cat);

  return (
    <div onClick={onClose} style={{
      position: 'absolute', inset: 0, zIndex: 50, background: 'rgba(35,51,31,0.55)',
      display: 'flex', alignItems: 'flex-end', animation: 'fadein 0.18s',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: '100%', background: '#fff', borderRadius: '28px 28px 0 0',
        paddingBottom: 24, maxHeight: '88%', display: 'flex', flexDirection: 'column',
        animation: 'slideup 0.22s cubic-bezier(.2,.9,.3,1.1)',
      }}>
        <div style={{ display: 'grid', placeItems: 'center', padding: '10px 0 8px' }}>
          <div style={{ width: 44, height: 5, borderRadius: 4, background: '#e0e6d5' }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 20px 10px' }}>
          <div style={{ font: "700 20px 'ZCOOL KuaiLe'", color: '#23331f' }}>吃了点什么？</div>
          <button onClick={onClose} style={{ width: 34, height: 34, borderRadius: '50%',
            border: '2px solid #23331f', background: '#fff', fontSize: 16, cursor: 'pointer', boxShadow: '0 2px 0 #23331f' }}>✕</button>
        </div>
        <div style={{ padding: '0 16px 10px', display: 'flex', gap: 8, overflowX: 'auto' }}>
          {Object.entries(CATEGORY_META).map(([key, meta]) => (
            <button key={key} onClick={() => setCat(key)} style={{
              flexShrink: 0, padding: '10px 16px', borderRadius: 999,
              border: '2px solid #23331f', cursor: 'pointer',
              background: cat === key ? meta.color : '#fff',
              color: cat === key ? '#fff' : '#23331f',
              font: "600 13px 'Noto Sans SC'",
              boxShadow: cat === key ? '0 2px 0 #23331f' : 'none',
            }}>{meta.name}</button>
          ))}
        </div>
        <div style={{ padding: '4px 14px 10px', overflowY: 'auto', flex: 1 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
            {items.map(f => (
              <button key={f.id} onClick={() => onPick({ foodId: f.id, name: f.name, emoji: f.emoji, sugar: f.sugar, category: f.category })}
                style={{ aspectRatio: 1, padding: '8px 6px', background: '#fbf9f0',
                  border: '2px solid #23331f', borderRadius: 16, cursor: 'pointer',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 3px 0 #23331f', textAlign: 'center' }}>
                <div style={{ fontSize: 34, lineHeight: 1 }}>{f.emoji}</div>
                <div style={{ font: "600 11px 'Noto Sans SC'", marginTop: 5, color: '#23331f', lineHeight: 1.15 }}>{f.name}</div>
                <div style={{ font: "700 10px 'Baloo 2'", color: CATEGORY_META[f.category].color, marginTop: 2 }}>{f.sugar}g</div>
              </button>
            ))}
            <button onClick={() => setCustomOpen(true)} style={{
              aspectRatio: 1, padding: '8px 6px', background: '#fff',
              border: '2px dashed #b892ff', borderRadius: 16, cursor: 'pointer',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            }}>
              <div style={{ fontSize: 28 }}>➕</div>
              <div style={{ font: "600 11px 'Noto Sans SC'", marginTop: 4, color: '#5c6d54' }}>自定义</div>
            </button>
          </div>
        </div>
        {customOpen && (
          <div onClick={() => setCustomOpen(false)} style={{ position: 'absolute', inset: 0,
            background: 'rgba(35,51,31,0.55)', display: 'grid', placeItems: 'center', padding: 24 }}>
            <div onClick={e => e.stopPropagation()} style={{ width: '100%', background: '#fff',
              border: '3px solid #23331f', borderRadius: 22, padding: 20, boxShadow: '0 6px 0 #23331f' }}>
              <div style={{ font: "700 18px 'ZCOOL KuaiLe'", marginBottom: 12 }}>自定义食物</div>
              <input value={cn} onChange={e => setCn(e.target.value)} placeholder="名字，例如 生日蛋糕"
                style={{ width: '100%', padding: 12, borderRadius: 12, border: '2px solid #e0e6d5', font: "500 15px 'Noto Sans SC'" }} />
              <input type="number" value={cs} onChange={e => setCs(e.target.value)} placeholder="糖分（克）"
                style={{ width: '100%', marginTop: 10, padding: 12, borderRadius: 12, border: '2px solid #e0e6d5', font: "600 15px 'Baloo 2'" }} />
              <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
                <button onClick={() => setCustomOpen(false)} style={{ flex: 1, padding: 12, borderRadius: 14,
                  border: '2px solid #23331f', background: '#fff', font: "600 14px 'Noto Sans SC'", cursor: 'pointer' }}>取消</button>
                <button onClick={() => {
                  const s = Number(cs);
                  if (!cn.trim() || !s) return;
                  onPick({ foodId: null, name: cn.trim(), emoji: '🍴', sugar: s, category: 'snack' });
                  setCustomOpen(false);
                }} style={{ flex: 1, padding: 12, borderRadius: 14, border: '2px solid #23331f',
                  background: '#6ab04c', color: '#fff', font: "700 14px 'Noto Sans SC'", boxShadow: '0 3px 0 #23331f', cursor: 'pointer' }}>加上去</button>
              </div>
            </div>
          </div>
        )}
      </div>
      <style>{`
        @keyframes slideup { from{transform:translateY(100%);} to{transform:translateY(0);} }
        @keyframes fadein { from{opacity:0;} to{opacity:1;} }
      `}</style>
    </div>
  );
}

// ============ SCHOOL SHEET (Journey 4) ============
function SchoolSheet({ open, onClose, state, setState }) {
  const date = ymd(new Date());
  const day = state.days[date] || { schoolSugar: 0 };
  const [val, setVal] = useState(day.schoolSugar || 0);
  useEffect(() => { if (open) setVal(day.schoolSugar || 0); }, [open]);
  if (!open) return null;
  const save = () => {
    setState(s => setSchoolSugar(s, date, val));
    onClose();
  };
  return (
    <div onClick={onClose} style={{
      position: 'absolute', inset: 0, zIndex: 50, background: 'rgba(35,51,31,0.55)',
      display: 'flex', alignItems: 'flex-end', animation: 'fadein 0.18s',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: '100%', background: '#fff', borderRadius: '28px 28px 0 0', padding: '14px 20px 28px',
        animation: 'slideup 0.22s cubic-bezier(.2,.9,.3,1.1)',
      }}>
        <div style={{ display: 'grid', placeItems: 'center', marginBottom: 8 }}>
          <div style={{ width: 44, height: 5, borderRadius: 4, background: '#e0e6d5' }} />
        </div>
        <div style={{ fontSize: 36, textAlign: 'center' }}>🎒</div>
        <div style={{ font: "700 20px 'ZCOOL KuaiLe'", textAlign: 'center', marginTop: 4 }}>今天在学校吃了多少糖？</div>
        <div style={{ font: "500 12px 'Noto Sans SC'", color: '#5c6d54', textAlign: 'center', marginTop: 4 }}>
          估一下就行，我们会从今天的额度里扣掉
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 6, marginTop: 16 }}>
          {[0, 3, 5, 8, 10, 15].map(v => (
            <button key={v} onClick={() => setVal(v)} style={{
              padding: '12px 0', borderRadius: 12, border: `2px solid ${val === v ? '#6ab04c' : '#e0e6d5'}`,
              background: val === v ? '#6ab04c' : '#fff', color: val === v ? '#fff' : '#23331f',
              font: "700 14px 'Baloo 2'", cursor: 'pointer',
            }}>{v}g</button>
          ))}
        </div>
        <input type="number" value={val} min={0} max={60}
          onChange={e => setVal(Math.max(0, Math.min(60, Number(e.target.value) || 0)))}
          style={{ width: '100%', marginTop: 12, padding: 14, borderRadius: 14,
            border: '2px solid #e0e6d5', font: "700 18px 'Baloo 2'", textAlign: 'center' }} />
        <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
          <button onClick={onClose} style={{ flex: 1, padding: 12, borderRadius: 14,
            border: '2px solid #23331f', background: '#fff', font: "600 14px 'Noto Sans SC'", cursor: 'pointer' }}>取消</button>
          <button onClick={save} style={{ flex: 2, padding: 12, borderRadius: 14,
            border: '2px solid #23331f', background: '#6ab04c', color: '#fff',
            font: "700 14px 'Noto Sans SC'", boxShadow: '0 3px 0 #23331f', cursor: 'pointer' }}>保存</button>
        </div>
      </div>
    </div>
  );
}

// ============ OVERAGE MODAL (Journey 5) ============
function OverageModal({ open, onClose, total, limit, name }) {
  if (!open) return null;
  return (
    <div onClick={onClose} style={{
      position: 'absolute', inset: 0, zIndex: 55, background: 'rgba(35,51,31,0.65)',
      display: 'grid', placeItems: 'center', padding: 24, animation: 'fadein 0.2s',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: '#fffef5', border: '3px solid #23331f', borderRadius: 22,
        padding: '24px 20px', maxWidth: 320, boxShadow: '0 6px 0 #23331f', textAlign: 'center',
      }}>
        <div style={{ display: 'grid', placeItems: 'center' }}>
          <WiltedFlower size={110} petal="#c2453c" />
        </div>
        <div style={{ font: "700 20px 'ZCOOL KuaiLe'", color: '#c2453c', marginTop: 4 }}>花有点蔫了…</div>
        <div style={{ font: "500 13px/1.6 'Noto Sans SC'", color: '#5c6d54', marginTop: 8 }}>
          今天已经吃了 <b style={{ color: '#23331f' }}>{total}g</b> 糖，<br/>
          超过了 {name} 每天的 {limit}g。<br/>
          <span style={{ color: '#23331f', fontWeight: 600 }}>喝杯水休息一下吧～</span><br/>
          <span style={{ fontSize: 11 }}>明天又是新的一天</span>
        </div>
        <button onClick={onClose} style={{
          marginTop: 18, padding: '12px 28px', borderRadius: 14,
          border: '2px solid #23331f', background: '#23331f', color: '#fff',
          font: "700 14px 'Noto Sans SC'", cursor: 'pointer', boxShadow: '0 3px 0 #101a0e',
        }}>好的，我知道了</button>
      </div>
    </div>
  );
}

// ============ CALENDAR (Journey 6) ============
// ============ HISTORY (per-date record, read-only) ============
// Replaces the old CalendarScreen. Month view; each cell shows the kept flower
// (if any) + its rarity border.
function HistoryScreen({ state, onClose, onPickDate }) {
  const [refDate, setRefDate] = useState(new Date());
  const month = monthData(state, refDate);
  const monthNames = ['一','二','三','四','五','六','七','八','九','十','十一','十二'];
  const dows = ['一','二','三','四','五','六','日'];
  const todayKey = ymd(new Date());

  const stats = useMemo(() => {
    const counts = { R: 0, SR: 0, SSR: 0, SSSR: 0, UR: 0 };
    for (const c of month.cells) {
      if (!c || !c.data) continue;
      const kept = keptFlowerFor(state, c.date);
      if (kept) counts[kept.rarity] = (counts[kept.rarity] || 0) + 1;
    }
    return counts;
  }, [month, state]);

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 45,
      background: 'linear-gradient(180deg, #f3f8ee 0%, #e0e9d0 100%)',
      display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '16px 18px 8px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <button onClick={onClose} style={{ width: 36, height: 36, borderRadius: 12,
          border: '2px solid #23331f', background: '#fff', fontSize: 16, cursor: 'pointer', boxShadow: '0 2px 0 #23331f' }}>←</button>
        <div style={{ flex: 1 }}>
          <div style={{ font: "700 20px 'ZCOOL KuaiLe'", color: '#23331f' }}>历史记录</div>
        </div>
        <button onClick={() => setRefDate(d => { const n = new Date(d); n.setMonth(n.getMonth() - 1); return n; })}
          style={{ width: 32, height: 32, borderRadius: 10, border: '2px solid #23331f', background: '#fff', cursor: 'pointer', boxShadow: '0 2px 0 #23331f' }}>‹</button>
        <div style={{ font: "700 14px 'ZCOOL KuaiLe'", minWidth: 60, textAlign: 'center' }}>{month.year}年 {monthNames[month.month]}月</div>
        <button onClick={() => setRefDate(d => { const n = new Date(d); n.setMonth(n.getMonth() + 1); return n; })}
          style={{ width: 32, height: 32, borderRadius: 10, border: '2px solid #23331f', background: '#fff', cursor: 'pointer', boxShadow: '0 2px 0 #23331f' }}>›</button>
      </div>

      {/* Rarity counts */}
      <div style={{ padding: '0 18px', display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
        {RARITY_ORDER.map(r => stats[r] > 0 && (
          <div key={r} style={{
            padding: '4px 10px', borderRadius: 999,
            background: r === 'UR' ? RAINBOW_LINEAR : RARITY_META[r].color,
            backgroundSize: r === 'UR' ? '200% 100%' : undefined,
            animation: r === 'UR' ? 'sg-rainbow-slide 8s linear infinite' : null,
            color: '#fff', font: "700 11px 'Noto Sans SC'",
          }}>{r} × {stats[r]}</div>
        ))}
      </div>

      <div style={{ flex: 1, padding: '8px 14px 20px', overflowY: 'auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 6 }}>
          {dows.map(d => <div key={d} style={{ textAlign: 'center', font: "600 10px 'Noto Sans SC'", color: '#5c6d54' }}>{d}</div>)}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
          {month.cells.map((c, i) => {
            if (!c) return <div key={i} />;
            const isToday = c.date === todayKey;
            const isPast = c.date < todayKey;
            const isFuture = c.date > todayKey;
            const kept = c.data ? keptFlowerFor(state, c.date) : null;
            const total = c.data ? totalForDay(c.data) : 0;
            const q = c.data ? qualityFromPacing(total, state.settings.dailyLimit, isPast || isToday ? 1.0 : 0.05) : null;
            const borderColor = kept ? (kept.rarity === 'UR' ? '#ffd24a' : RARITY_META[kept.rarity].color) :
                                isToday ? '#ffd24a' : '#e0e6d5';
            return (
              <button key={i} onClick={() => (isPast || isToday) && c.data && onPickDate(c.date)}
                style={{
                  position: 'relative', aspectRatio: '0.82', padding: 2,
                  background: isToday ? '#fff9dc' : isPast ? '#fffef5' : '#f3f8ee',
                  border: `${kept ? '2.5px' : '1.5px'} solid ${borderColor}`,
                  borderRadius: 12, cursor: (isPast || isToday) && c.data ? 'pointer' : 'default',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between',
                  paddingTop: 3, paddingBottom: 3,
                  boxShadow: kept && RARITY_ORDER.indexOf(kept.rarity) >= 3
                    ? `0 0 8px ${kept.rarity === 'UR' ? 'rgba(255,210,74,0.6)' : RARITY_META[kept.rarity].colorSoft}`
                    : 'none',
                }}>
                <div style={{ font: "700 10px 'Baloo 2'", color: isToday ? '#c2453c' : isFuture ? '#8a9a85' : '#23331f' }}>{c.day}</div>
                <div style={{ flex: 1, display: 'grid', placeItems: 'center' }}>
                  {isFuture ? <EmptyPot size={28} /> :
                   kept ? <PotFlower species={kept.speciesId} quality={q} size={30} /> :
                   <EmptyPot size={28} />}
                </div>
                {c.data && !isFuture && (
                  <div style={{ font: "600 9px 'Baloo 2'", color: total > state.settings.dailyLimit ? '#c2453c' : '#5c6d54' }}>
                    {total}g
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ============ DAY DETAIL (Journey 6 continued) ============
function DayDetail({ date, state, onClose }) {
  const day = state.days[date];
  if (!day) return null;
  const d = parseYMD(date);
  const kept = keptFlowerFor(state, date);
  const total = totalForDay(day);
  const isPast = date < ymd(new Date());
  const q = qualityFromPacing(total, state.settings.dailyLimit, isPast ? 1.0 : expectedProgress(new Date()));
  const liveEntries = day.entries.filter(e => !e.deleted);

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 48,
      background: 'linear-gradient(180deg, #f3f8ee 0%, #e0e9d0 100%)',
      display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '16px 18px 8px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <button onClick={onClose} style={{ width: 36, height: 36, borderRadius: 12,
          border: '2px solid #23331f', background: '#fff', fontSize: 16, cursor: 'pointer', boxShadow: '0 2px 0 #23331f' }}>←</button>
        <div style={{ font: "700 18px 'ZCOOL KuaiLe'" }}>{d.getMonth()+1}月{d.getDate()}日</div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 18px 24px' }}>
        {kept ? (
          <div className="sg-flower-card">
          <RarityFrame rarity={kept.rarity} padding={6} radius={22}>
            <div style={{ padding: 20, textAlign: 'center', position: 'relative' }}>
              <div style={{ marginBottom: 8 }}><RarityBadge rarity={kept.rarity} size="md" /></div>
              <div style={{ position: 'relative', display: 'inline-block' }}>
                <FlowerSVG size={140} species={kept.speciesId} quality={q} animate />
                <QualityFx quality={q} rarity={kept.rarity} />
                <WindLeaves />
              </div>
              <div style={{ font: "700 22px 'ZCOOL KuaiLe'", marginTop: 4, color: '#23331f' }}>
                {FLOWERS[kept.speciesId]?.name}
              </div>
              <div style={{ font: "500 12px 'Noto Sans SC'", color: '#5c6d54', marginTop: 4 }}>
                {FLOWERS[kept.speciesId]?.desc} · <span style={{ color: '#8a9a85' }}>{QUALITY_LABEL[q] || q}</span>
              </div>
              <div style={{ marginTop: 14, display: 'flex', justifyContent: 'center', gap: 20 }}>
                <Stat label="总糖分" value={`${total}g`} color={total > state.settings.dailyLimit ? '#c2453c' : '#3b6e2b'} />
                <Stat label="上限" value={`${state.settings.dailyLimit}g`} color="#5c6d54" />
                <Stat label="记录" value={`${liveEntries.length} 条`} color="#5c6d54" />
              </div>
            </div>
          </RarityFrame>
          </div>
        ) : (
          <div style={{ background: '#fff', border: '2px dashed #cfe3be', borderRadius: 20, padding: 20, textAlign: 'center',
            font: "500 13px 'Noto Sans SC'", color: '#5c6d54' }}>
            这一天没有抽过花
          </div>
        )}

        <div style={{ marginTop: 16 }}>
          <div style={{ font: "700 14px 'ZCOOL KuaiLe'", marginBottom: 8, color: '#23331f' }}>这一天吃了什么</div>
          {day.schoolSugar > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
              background: '#fff', borderRadius: 14, border: '1.5px solid #e6eadd', marginBottom: 6 }}>
              <div style={{ fontSize: 22 }}>🎒</div>
              <div style={{ flex: 1 }}>
                <div style={{ font: "600 13px 'Noto Sans SC'" }}>在学校吃的糖</div>
                <div style={{ font: "500 11px 'Noto Sans SC'", color: '#5c6d54' }}>估算值</div>
              </div>
              <div style={{ font: "800 15px 'Baloo 2'", color: '#b892ff' }}>{day.schoolSugar}g</div>
            </div>
          )}
          <EntryList entries={liveEntries} onDelete={() => {}} />
        </div>
      </div>
    </div>
  );
}
function Stat({ label, value, color }) {
  return (
    <div>
      <div style={{ font: "500 10px 'Noto Sans SC'", color: '#5c6d54' }}>{label}</div>
      <div style={{ font: `800 18px 'Baloo 2'`, color }}>{value}</div>
    </div>
  );
}

// ============ TREND (Journey 7) ============
function TrendScreen({ state, onClose }) {
  const days = trendData(state, 7);
  const max = Math.max(...days.map(d => Math.max(d.total, d.limit)), 10);
  const dowLabel = ['日','一','二','三','四','五','六'];
  const avg = days.reduce((a, d) => a + d.total, 0) / Math.max(1, days.length);
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 45,
      background: 'linear-gradient(180deg, #f3f8ee 0%, #e0e9d0 100%)',
      display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '16px 18px 8px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <button onClick={onClose} style={{ width: 36, height: 36, borderRadius: 12,
          border: '2px solid #23331f', background: '#fff', fontSize: 16, cursor: 'pointer', boxShadow: '0 2px 0 #23331f' }}>←</button>
        <div style={{ font: "700 20px 'ZCOOL KuaiLe'" }}>最近 7 天</div>
      </div>
      <div style={{ padding: '8px 18px 24px', flex: 1, overflowY: 'auto' }}>
        <div style={{ background: '#fff', border: '2px solid #23331f', borderRadius: 20, padding: 18, boxShadow: '0 4px 0 #23331f' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <div style={{ font: "700 14px 'ZCOOL KuaiLe'" }}>每日糖量</div>
            <div style={{ font: "500 11px 'Noto Sans SC'", color: '#5c6d54' }}>虚线 = 上限 {state.settings.dailyLimit}g</div>
          </div>
          <div style={{ position: 'relative', height: 160, display: 'flex', alignItems: 'flex-end', gap: 6, marginTop: 14 }}>
            {days[0] && (
              <div style={{ position: 'absolute', left: 0, right: 0,
                top: `${(1 - days[0].limit / max) * 100}%`,
                borderTop: '1.5px dashed #b892ff', pointerEvents: 'none' }} />
            )}
            {days.map(d => {
              const over = d.total > d.limit;
              const h = (d.total / max) * 100;
              return (
                <div key={d.date} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%' }}>
                  <div style={{ font: "700 11px 'Baloo 2'", color: over ? '#c2453c' : '#3b6e2b', marginBottom: 'auto' }}>{d.total}</div>
                  <div style={{ width: '100%', height: `${h}%`, minHeight: 4,
                    background: over ? '#c2453c' : 'linear-gradient(180deg, #7ad9b5, #6ab04c)',
                    borderRadius: '6px 6px 0 0', border: '1.5px solid #23331f', borderBottom: 0 }} />
                </div>
              );
            })}
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
            {days.map(d => (
              <div key={d.date} style={{ flex: 1, textAlign: 'center', font: "500 10px 'Noto Sans SC'", color: '#5c6d54' }}>
                {dowLabel[d.dow]}
              </div>
            ))}
          </div>
        </div>

        {/* Summary */}
        <div style={{ marginTop: 14, display: 'flex', gap: 10 }}>
          <SummaryCard label="日均" value={`${Math.round(avg)}g`} color="#3b6e2b" />
          <SummaryCard label="达标天数" value={`${days.filter(d => d.total <= d.limit).length}/7`} color="#6ab04c" />
          <SummaryCard label="完美日" value={`${days.filter(d => d.total <= d.limit * 0.4).length}`} color="#b892ff" />
        </div>
      </div>
    </div>
  );
}
function SummaryCard({ label, value, color }) {
  return (
    <div style={{ flex: 1, background: '#fff', border: '2px solid #23331f', borderRadius: 14, padding: 12, textAlign: 'center', boxShadow: '0 3px 0 #23331f' }}>
      <div style={{ font: "500 10px 'Noto Sans SC'", color: '#5c6d54' }}>{label}</div>
      <div style={{ font: `800 20px 'Baloo 2'`, color, marginTop: 2 }}>{value}</div>
    </div>
  );
}

// ============ SETTINGS (Journey 9) ============
function SettingsScreen({ state, setState, onClose, identity, onRotateToken, onLeaveFamily }) {
  const [name, setName] = useState(state.settings.childName);
  const [dob, setDob] = useState(state.settings.dateOfBirth);
  const [limit, setLimit] = useState(state.settings.dailyLimit);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const age = dob ? ageFromDob(dob) : null;
  const save = () => {
    setState(s => updateSettings(s, { childName: name, dateOfBirth: dob, dailyLimit: Number(limit) }));
    onClose();
  };
  const inviteUrl = identity ? buildInviteUrl(identity.familyId, identity.token) : '';
  const members = state.members || [];

  async function copyInvite() {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // fallback: select the textarea
      const ta = document.getElementById('sg-invite-text');
      if (ta) { ta.select(); document.execCommand('copy'); setCopied(true); setTimeout(() => setCopied(false), 1600); }
    }
  }

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 46,
      background: '#f3f8ee', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '16px 18px 8px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <button onClick={onClose} style={{ width: 36, height: 36, borderRadius: 12,
          border: '2px solid #23331f', background: '#fff', fontSize: 16, cursor: 'pointer', boxShadow: '0 2px 0 #23331f' }}>←</button>
        <div style={{ font: "700 20px 'ZCOOL KuaiLe'" }}>设置</div>
      </div>
      <div style={{ padding: '10px 18px 24px', flex: 1, overflowY: 'auto' }}>
        <div style={{ background: '#fff', border: '2px solid #23331f', borderRadius: 18, padding: 18 }}>
          <Field label="小朋友名字">
            <input value={name} onChange={e => setName(e.target.value)}
              style={fieldInputStyle} />
          </Field>
          <Field label="生日">
            <input type="date" value={dob} max={ymd(new Date())} onChange={e => setDob(e.target.value)}
              style={fieldInputStyle} />
            {age !== null && <div style={{ font: "500 11px 'Noto Sans SC'", color: '#5c6d54', marginTop: 4 }}>今年 {age} 岁</div>}
          </Field>
          <Field label="每日糖分上限 (g)">
            <input type="number" value={limit} min={5} max={60}
              onChange={e => setLimit(Number(e.target.value) || 19)}
              style={fieldInputStyle} />
            <div style={{ font: "500 11px 'Noto Sans SC'", color: '#5c6d54', marginTop: 4 }}>
              WHO 参考：{age ? defaultLimitByAge(age) : 19}g
            </div>
          </Field>
        </div>
        <button onClick={save} style={{
          width: '100%', marginTop: 16, padding: 14, borderRadius: 16,
          border: '2.5px solid #23331f', background: '#6ab04c', color: '#fff',
          font: "700 15px 'Noto Sans SC'", boxShadow: '0 4px 0 #23331f', cursor: 'pointer',
        }}>保存</button>

        {/* Family / members */}
        <div style={{ marginTop: 20, background: '#fff', border: '2px solid #23331f', borderRadius: 18, padding: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <div style={{ font: "700 15px 'ZCOOL KuaiLe'" }}>👨‍👩‍👧 家庭成员</div>
            <div style={{ font: "500 11px 'Noto Sans SC'", color: '#5c6d54' }}>{members.length} 人</div>
          </div>
          <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {members.length === 0 && (
              <div style={{ font: "500 12px 'Noto Sans SC'", color: '#8a9a85' }}>只有你一个人，发个邀请给家人吧 ↓</div>
            )}
            {members.map(m => (
              <div key={m.id} style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px',
                borderRadius: 12, border: '1.5px solid #e6eadd', background: '#fbf9f0',
              }}>
                <div style={{ width: 30, height: 30, borderRadius: '50%', background: '#7ad9b5',
                  display: 'grid', placeItems: 'center', color: '#23331f',
                  font: "700 13px 'Noto Sans SC'" }}>{(m.name || '?').slice(0,1)}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ font: "600 13px 'Noto Sans SC'", color: '#23331f' }}>
                    {m.name}{identity && m.id === identity.memberId ? ' · 你' : ''}
                  </div>
                  <div style={{ font: "500 10px 'Noto Sans SC'", color: '#8a9a85' }}>
                    {m.last_seen_at ? `最近 ${new Date(m.last_seen_at).toLocaleDateString('zh-CN')}` : '刚加入'}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <button onClick={() => setInviteOpen(true)} style={{
            width: '100%', marginTop: 14, padding: 12, borderRadius: 14,
            border: '2.5px solid #23331f', background: '#b892ff', color: '#fff',
            font: "700 14px 'Noto Sans SC'", boxShadow: '0 3px 0 #23331f', cursor: 'pointer',
          }}>🔗 邀请家人</button>
        </div>

        {/* Stats */}
        {(() => {
          const plantedCount = Object.values(state.days).filter(d => d.plantedAt?.slotId).length;
          const spunCount = Object.values(state.days).filter(d => d.spin?.keptIndex != null).length;
          const collected = new Set(Object.values(state.days).map(d => keptFlowerFor(state, d.date)?.speciesId).filter(Boolean));
          const totalSpecies = Object.keys(FLOWERS).length;
          return (
            <div style={{ marginTop: 20, padding: 16, background: '#fff', border: '2px dashed #e0e6d5', borderRadius: 16 }}>
              <div style={{ font: "700 13px 'Noto Sans SC'", color: '#23331f' }}>📊 我的花园</div>
              <div style={{ font: "500 11px 'Noto Sans SC'", color: '#5c6d54', marginTop: 4, lineHeight: 1.6 }}>
                已种 {plantedCount} 朵 · 总共抽过 {spunCount} 次<br/>
                收集花种 {collected.size} / {totalSpecies}
              </div>
            </div>
          );
        })()}

        {/* Danger zone */}
        <div style={{ marginTop: 20, padding: 14, border: '2px dashed #c2453c', borderRadius: 14, background: '#fff9f6' }}>
          <div style={{ font: "700 12px 'Noto Sans SC'", color: '#c2453c' }}>⚠️ 危险操作</div>
          <button onClick={() => {
            if (!confirm('重新生成邀请链接后，之前发出去但未使用的邀请链接都会失效。继续？')) return;
            onRotateToken?.();
          }} style={{
            width: '100%', marginTop: 8, padding: 10, borderRadius: 12,
            border: '2px solid #c2453c', background: '#fff', color: '#c2453c',
            font: "600 12px 'Noto Sans SC'", cursor: 'pointer',
          }}>重新生成邀请链接</button>
          <button onClick={() => {
            if (!confirm('退出家庭会清掉本机数据（云端保留）。确定要退出？')) return;
            onLeaveFamily?.();
          }} style={{
            width: '100%', marginTop: 6, padding: 10, borderRadius: 12,
            border: '2px solid #c2453c', background: '#fff', color: '#c2453c',
            font: "600 12px 'Noto Sans SC'", cursor: 'pointer',
          }}>退出家庭 / 换家庭</button>
        </div>
      </div>

      {inviteOpen && (
        <div onClick={() => setInviteOpen(false)} style={{
          position: 'absolute', inset: 0, zIndex: 60, background: 'rgba(35,51,31,0.6)',
          display: 'grid', placeItems: 'center', padding: 20,
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            width: '100%', maxWidth: 340, background: '#fff', border: '3px solid #23331f',
            borderRadius: 22, padding: 20, boxShadow: '0 6px 0 #23331f',
          }}>
            <div style={{ textAlign: 'center', fontSize: 40 }}>🔗</div>
            <div style={{ font: "700 20px 'ZCOOL KuaiLe'", textAlign: 'center', marginTop: 4 }}>邀请家人加入</div>
            <div style={{ font: "500 12px/1.6 'Noto Sans SC'", color: '#5c6d54', textAlign: 'center', marginTop: 6 }}>
              把这个链接发给家人（微信、短信都行），对方打开后点"加入家人的花园"就能一起记录。
            </div>
            <textarea id="sg-invite-text" readOnly value={inviteUrl} rows={3}
              style={{ width: '100%', marginTop: 12, padding: 10, border: '2px solid #cfe3be',
                borderRadius: 12, font: "500 12px 'Baloo 2'", resize: 'none', wordBreak: 'break-all' }} />
            <button onClick={copyInvite} style={{
              width: '100%', marginTop: 10, padding: 12, borderRadius: 14,
              border: '2.5px solid #23331f', background: copied ? '#6ab04c' : '#23331f',
              color: '#fff', font: "700 14px 'Noto Sans SC'", boxShadow: '0 3px 0 #101a0e', cursor: 'pointer',
            }}>{copied ? '✓ 已复制' : '复制链接'}</button>
            <div style={{ font: "500 11px/1.5 'Noto Sans SC'", color: '#5c6d54', marginTop: 10, padding: 10, background: '#fbf9f0', borderRadius: 10 }}>
              ⚠️ 拿到这个链接的人就能加入家庭。只发给信任的家人，别贴公开群。
            </div>
            <button onClick={() => setInviteOpen(false)} style={{
              width: '100%', marginTop: 10, padding: 10, borderRadius: 12,
              border: '2px solid #23331f', background: '#fff', font: "600 13px 'Noto Sans SC'", cursor: 'pointer',
            }}>关闭</button>
          </div>
        </div>
      )}
    </div>
  );
}
const fieldInputStyle = { width: '100%', padding: 12, border: '1.5px solid #cfe3be', borderRadius: 10, font: "500 15px 'Noto Sans SC'", background: '#fff' };
function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ font: "500 11px 'Noto Sans SC'", color: '#5c6d54', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
      {children}
    </div>
  );
}

// ============ DEBUG PANEL (only shown when URL has ?debug=1) ============
function DebugPanel({ state, identity, onForceRarity, onResetToday, onSeedYesterday, onWipe }) {
  const [open, setOpen] = useState(false);
  const forceRarity = state.debug?.forceRarity;
  const btnStyle = {
    padding: '8px 10px', borderRadius: 10, border: '1.5px solid #23331f',
    background: '#fff', font: "600 12px 'Noto Sans SC'", cursor: 'pointer', textAlign: 'left',
  };
  return (
    <>
      <button onClick={() => setOpen(!open)} style={{
        position: 'fixed', top: 10, left: 10, zIndex: 200,
        width: 40, height: 40, borderRadius: '50%', border: '2px solid #23331f',
        background: '#fff59a', fontSize: 20, cursor: 'pointer', boxShadow: '0 2px 0 #23331f',
      }} title="Debug">🐞</button>
      {open && (
        <div style={{
          position: 'fixed', top: 60, left: 10, zIndex: 200,
          width: 270, background: '#fff', border: '2.5px solid #23331f', borderRadius: 16,
          padding: 14, boxShadow: '0 4px 0 #23331f',
          font: "500 12px 'Noto Sans SC'",
        }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>🐞 Debug Panel</div>
          <div style={{ color: '#8a9a85', fontSize: 10, marginBottom: 10 }}>
            ?debug=1 模式：同步已暂停，改动仅本地
          </div>

          <div style={{ margin: '6px 0 4px', fontWeight: 600, fontSize: 11 }}>强制下次抽卡稀有度：</div>
          <div style={{ display: 'flex', gap: 4 }}>
            {RARITY_ORDER.map(r => (
              <button key={r} onClick={() => onForceRarity(r)} style={{
                flex: 1, padding: '6px 2px', borderRadius: 8,
                border: forceRarity === r ? '2px solid #c2453c' : '1.5px solid #23331f',
                background: forceRarity === r ? '#fff0ee' : '#fff',
                font: "700 11px 'Noto Sans SC'", cursor: 'pointer',
              }}>{r}</button>
            ))}
          </div>
          {forceRarity && (
            <div style={{ color: '#c2453c', fontSize: 10, marginTop: 4 }}>
              ✓ 下次抽卡会强制 {forceRarity}（用后自动清除）
            </div>
          )}

          <div style={{ margin: '14px 0 0', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <button onClick={onResetToday} style={btnStyle}>🎰 重抽今日（清今日 spin）</button>
            <div style={{ fontSize: 11, fontWeight: 600, marginTop: 4 }}>种一朵花到花田：</div>
            <div style={{ display: 'flex', gap: 4 }}>
              {RARITY_ORDER.map(r => {
                const m = RARITY_META[r];
                const isRb = r === 'UR';
                return (
                  <button key={r} onClick={() => onSeedYesterday(r)} style={{
                    flex: 1, padding: '6px 2px', borderRadius: 8,
                    border: '1.5px solid #23331f',
                    background: isRb ? RAINBOW_LINEAR : m.color,
                    backgroundSize: isRb ? '200% 100%' : undefined,
                    animation: isRb ? 'sg-rainbow 4s linear infinite' : null,
                    color: '#fff', font: "700 11px 'Noto Sans SC'", cursor: 'pointer',
                    textShadow: '0 1px 1px rgba(0,0,0,0.2)',
                  }}>{r}</button>
                );
              })}
            </div>
            <div style={{ fontSize: 10, color: '#8a9a85' }}>
              点档次按钮 → 创建一朵该档次的花 → 自动进花田选空位种下
            </div>
            <button onClick={onWipe} style={{...btnStyle, marginTop: 4, borderColor: '#c2453c', color: '#c2453c'}}>
              🗑️ 清空本机（重走欢迎页）
            </button>
          </div>

          {identity && (
            <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px dashed #ddd',
              fontSize: 10, color: '#8a9a85', wordBreak: 'break-all' }}>
              family: <code>{identity.familyId?.slice(0,8)}</code> · member: <code>{identity.memberName}</code>
            </div>
          )}
        </div>
      )}
    </>
  );
}

Object.assign(window, {
  WelcomeScreen, NewFamilyOnboarding, JoinFamilyFlow,
  TodayScreen, FoodPicker,
  SchoolSheet, OverageModal, HistoryScreen, DayDetail, TrendScreen, SettingsScreen,
  SpinWheel, FlowerField,
  RarityFrame, RarityBadge, StarRating, QualityFx, WindLeaves,
  TomorrowProbPanel, DebugPanel,
  QUALITY_LABEL, RAINBOW_BG, RAINBOW_LINEAR, RAINBOW_LINEAR_LOOP,
  EntryList,
});
