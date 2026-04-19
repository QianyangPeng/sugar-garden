// Flower rendering (SVG). Each shape takes props: { size, quality, species, animate }.
// quality: 'perfect' | 'great' | 'ok' | 'okish' | 'wilted' | 'dead' | 'bud'
// 'bud' is used for the currently-growing (today's) flower.
//
// Animation layers (applied together when animate=true):
//  1. Petal sway    — inner <g>, ±2° rotate on the flower head, 3.2s cycle
//  2. Whole-flower sway ("wind") — outer <g class="sg-flower-body">,
//     ±1.3° rotate about the stem base (50,140), 5.2s cycle.
//     On `.sg-flower-card:hover .sg-flower-body` the amplitude jumps to ±4° and
//     3 small leaf particles drift across — simulates a gust.

// Inject shared flower CSS exactly once (both app and gallery pages share flowers.jsx).
(function injectSharedFlowerStyles() {
  if (typeof document === 'undefined') return;
  if (document.getElementById('sg-flower-styles')) return;
  const s = document.createElement('style');
  s.id = 'sg-flower-styles';
  s.textContent = `
    @keyframes sg-flower-head-sway { 0%,100%{transform:rotate(-2deg);} 50%{transform:rotate(2deg);} }
    @keyframes sg-flower-head-sway-head { 0%,100%{transform:rotate(-3deg);} 50%{transform:rotate(3deg);} }
    @keyframes sg-flower-wind-ambient {
      0%,100% { transform: rotate(-1.3deg); }
      50%     { transform: rotate(1.3deg); }
    }
    @keyframes sg-flower-wind-gust {
      0%   { transform: rotate(0deg); }
      15%  { transform: rotate(-5.5deg); }
      35%  { transform: rotate(4deg); }
      55%  { transform: rotate(-2.5deg); }
      75%  { transform: rotate(1.5deg); }
      100% { transform: rotate(0deg); }
    }
    .sg-flower-body {
      transform-box: view-box;
      transform-origin: 50px 140px;
      animation: sg-flower-wind-ambient 5.2s ease-in-out infinite;
    }
    .sg-flower-body-head {
      transform-box: fill-box;
      transform-origin: center center;
      animation: sg-flower-wind-ambient 5.2s ease-in-out infinite;
    }
    .sg-flower-card:hover .sg-flower-body,
    .sg-flower-card:hover .sg-flower-body-head {
      animation: sg-flower-wind-gust 1.4s ease-in-out infinite;
    }
    .sg-flower-card:active .sg-flower-body,
    .sg-flower-card:active .sg-flower-body-head {
      animation-duration: 0.8s;
    }

    /* Wind-gust particles (tiny leaves drifting left-to-right). Hidden by default. */
    .sg-wind-leaf {
      position: absolute; top: 0; left: 0;
      width: 14px; height: 10px; opacity: 0; pointer-events: none;
      background: radial-gradient(ellipse at 30% 50%, #7ab985 0%, #5a8f5e 60%, transparent 65%);
      border-radius: 55% 35% 55% 35% / 60% 30% 70% 40%;
      filter: drop-shadow(0 1px 1px rgba(0,0,0,0.15));
    }
    .sg-flower-card:hover .sg-wind-leaf { animation: sg-wind-leaf-drift 1.8s linear infinite; }
    .sg-flower-card:hover .sg-wind-leaf:nth-child(2) { animation-delay: 0.6s; animation-duration: 2.1s; }
    .sg-flower-card:hover .sg-wind-leaf:nth-child(3) { animation-delay: 1.2s; animation-duration: 1.6s; }
    @keyframes sg-wind-leaf-drift {
      0%   { opacity: 0; transform: translate(-10%, 40%) rotate(-20deg); }
      20%  { opacity: 0.85; }
      80%  { opacity: 0.85; }
      100% { opacity: 0; transform: translate(120%, 20%) rotate(40deg); }
    }
  `;
  document.head.appendChild(s);
})();

function FlowerSVG({ size = 100, species, quality = 'great', animate = false, style, headOnly = false }) {
  const s = size;
  const f = species ? FLOWERS[species] : null;

  if (quality === 'dead') return <DeadSprig size={s} style={style} animate={animate} />;
  if (quality === 'wilted') return <WiltedFlower size={s} style={style} petal={f?.petal || '#a88968'} animate={animate} />;
  if (quality === 'bud') return <BudGrowing size={s} style={style} headOnly={headOnly} />;

  const shape = f?.shape || 'daisy';
  const petal = f?.petal || '#ff9ec4';
  const center = f?.center || '#ffd24a';

  // Inner petal sway (rotate only — quirks described at file top).
  const petalSwayStyle = animate ? {
    transformBox: 'fill-box',
    transformOrigin: 'center',
    animation: `${headOnly ? 'sg-flower-head-sway-head' : 'sg-flower-head-sway'} 3.2s ease-in-out infinite`,
  } : null;

  // Stem tilt displacement: stem top is at x = 50 + tilt * 1.4 (see <Stem> below).
  const tilt = quality === 'okish' ? 12 : quality === 'ok' ? 4 : 0;
  const headX = 50 + tilt * 1.4;

  if (headOnly) {
    return (
      <svg viewBox="-40 -40 80 80" width={s} height={s} style={style}>
        <g className={animate ? 'sg-flower-body-head' : undefined}>
          <g transform={`scale(${quality === 'perfect' ? 1.18 : 1.1}) rotate(${quality === 'okish' ? -8 : 0})`}>
            <g style={petalSwayStyle}>
              {renderFlowerHead(shape, petal, center, quality)}
            </g>
          </g>
        </g>
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 100 140" width={s} height={s * 1.4} style={style}>
      <g className={animate ? 'sg-flower-body' : undefined}>
        <Stem tilt={tilt} />
        <g transform={`translate(${headX} 40) scale(${quality === 'perfect' ? 1.06 : 1}) rotate(${quality === 'okish' ? -8 : 0})`}>
          <g style={petalSwayStyle}>
            {renderFlowerHead(shape, petal, center, quality)}
          </g>
        </g>
      </g>
    </svg>
  );
}

function Stem({ tilt = 0 }) {
  const d = `M 50 140 Q ${50 + tilt} 90 ${50 + tilt * 1.4} 50`;
  return (
    <g>
      <path d={d} stroke="#5a8f5e" strokeWidth="4" fill="none" strokeLinecap="round" />
      <ellipse cx={40 - Math.abs(tilt) * 0.3} cy="100" rx="9" ry="4.5" fill="#7ab985" transform={`rotate(-30 ${40 - Math.abs(tilt) * 0.3} 100)`} stroke="#3b6e2b" strokeWidth="1" />
    </g>
  );
}

function renderFlowerHead(shape, petal, center, quality) {
  const scale = quality === 'perfect' ? 1 : quality === 'great' ? 0.92 : quality === 'ok' ? 0.85 : 0.78;
  const g = (children) => <g transform={`scale(${scale})`}>{children}</g>;

  switch (shape) {
    case 'tulip':
      return g(<>
        <path d="M -14 -4 Q -16 -22 0 -26 Q 16 -22 14 -4 Q 10 8 0 10 Q -10 8 -14 -4 Z" fill={petal} stroke="#2b2033" strokeWidth="2" />
        <path d="M -8 -4 Q -8 -18 0 -20 Q 8 -18 8 -4" stroke="#2b2033" strokeWidth="1.5" fill="none" opacity="0.3" />
      </>);
    case 'daisy':
      return g(<>
        {[0,45,90,135,180,225,270,315].map(a => (
          <ellipse key={a} cx="0" cy="-15" rx="6" ry="11" fill={petal} stroke="#2b2033" strokeWidth="1.8" transform={`rotate(${a})`} />
        ))}
        <circle cx="0" cy="0" r="7" fill={center} stroke="#2b2033" strokeWidth="1.8" />
      </>);
    case 'sunflower':
      return g(<>
        {Array.from({length:12}).map((_, i) => {
          const a = i * 30;
          return <ellipse key={i} cx="0" cy="-17" rx="5" ry="12" fill={petal} stroke="#7c4a1d" strokeWidth="1.2" transform={`rotate(${a})`} />;
        })}
        <circle cx="0" cy="0" r="9" fill={center} stroke="#2b2033" strokeWidth="1.8" />
        <circle cx="-3" cy="-2" r="1.2" fill="#ffd24a" opacity="0.7" />
      </>);
    case 'poppy':
      return g(<>
        {[0,72,144,216,288].map(a => (
          <path key={a} d="M 0 0 Q -12 -8 -10 -20 Q 0 -26 10 -20 Q 12 -8 0 0 Z" fill={petal} stroke="#2b2033" strokeWidth="1.8" transform={`rotate(${a})`} />
        ))}
        <circle cx="0" cy="0" r="5" fill={center} />
      </>);
    case 'cosmos':
      return g(<>
        {[0,60,120,180,240,300].map(a => (
          <path key={a} d="M 0 0 Q -8 -10 -6 -22 Q 0 -24 6 -22 Q 8 -10 0 0 Z" fill={petal} stroke="#2b2033" strokeWidth="1.5" transform={`rotate(${a})`} />
        ))}
        <circle cx="0" cy="0" r="5" fill={center} stroke="#2b2033" strokeWidth="1.5" />
      </>);
    case 'marigold':
      return g(<>
        {Array.from({length:10}).map((_,i) => {
          const a = i * 36;
          return <ellipse key={'o'+i} cx="0" cy="-16" rx="5" ry="10" fill={petal} stroke="#c2453c" strokeWidth="1" transform={`rotate(${a})`} />;
        })}
        {Array.from({length:8}).map((_,i) => {
          const a = i * 45;
          return <ellipse key={'i'+i} cx="0" cy="-9" rx="3.5" ry="7" fill={center} opacity="0.9" transform={`rotate(${a})`} />;
        })}
        <circle cx="0" cy="0" r="3" fill="#ffd24a" />
      </>);
    case 'bluebell':
      return g(<>
        {[-18, 0, 18].map((x, i) => (
          <g key={i} transform={`translate(${x} -14)`}>
            <path d="M -7 0 Q -8 12 0 14 Q 8 12 7 0 Q 7 -8 0 -8 Q -7 -8 -7 0 Z" fill={petal} stroke="#2b2033" strokeWidth="1.5" />
            <path d="M -4 10 L -4 15 M 0 12 L 0 17 M 4 10 L 4 15" stroke="#2b2033" strokeWidth="1" />
          </g>
        ))}
      </>);
    case 'pansy':
      return g(<>
        {/* bottom 2 */}
        <ellipse cx="-9" cy="-2" rx="11" ry="8" fill={petal} stroke="#2b2033" strokeWidth="1.8" />
        <ellipse cx="9" cy="-2" rx="11" ry="8" fill={petal} stroke="#2b2033" strokeWidth="1.8" />
        <ellipse cx="0" cy="-14" rx="12" ry="9" fill="#b892ff" stroke="#2b2033" strokeWidth="1.8" />
        <ellipse cx="-10" cy="-16" rx="8" ry="7" fill="#ffd24a" stroke="#2b2033" strokeWidth="1.8" />
        <ellipse cx="10" cy="-16" rx="8" ry="7" fill="#ffd24a" stroke="#2b2033" strokeWidth="1.8" />
        <circle cx="0" cy="-4" r="3" fill={center} />
      </>);

    // RARE
    case 'moonflower':
      return g(<>
        {[0,45,90,135,180,225,270,315].map(a => (
          <path key={a} d="M 0 0 Q -8 -8 -6 -20 Q 0 -24 6 -20 Q 8 -8 0 0 Z" fill={petal} stroke="#8a7dca" strokeWidth="1.5" transform={`rotate(${a})`} />
        ))}
        <circle cx="0" cy="0" r="6" fill={center} />
        <circle cx="-15" cy="-15" r="1.5" fill="#fff" opacity="0.9"><animate attributeName="opacity" values="0.2;1;0.2" dur="2s" repeatCount="indefinite" /></circle>
        <circle cx="18" cy="-10" r="1" fill="#fff" opacity="0.7"><animate attributeName="opacity" values="0.2;0.9;0.2" dur="2.4s" repeatCount="indefinite" /></circle>
      </>);
    case 'crystalrose':
      return g(<>
        {[0,60,120,180,240,300].map(a => (
          <polygon key={a} points="0,0 -7,-12 0,-22 7,-12" fill={petal} stroke="#5fb7c7" strokeWidth="1.5" opacity="0.85" transform={`rotate(${a})`} />
        ))}
        <polygon points="0,-4 -4,-10 0,-16 4,-10" fill="#ffffff" stroke="#5fb7c7" strokeWidth="1" />
        <circle cx="0" cy="0" r="3" fill="#5fb7c7" />
      </>);
    case 'rainbowlily':
      return g(<>
        {[{a:0,c:'#ff5c6c'},{a:60,c:'#ffb085'},{a:120,c:'#ffd24a'},{a:180,c:'#7ad9b5'},{a:240,c:'#7ec4ff'},{a:300,c:'#b892ff'}].map((p,i) => (
          <ellipse key={i} cx="0" cy="-16" rx="7" ry="14" fill={p.c} stroke="#2b2033" strokeWidth="1.5" transform={`rotate(${p.a})`} />
        ))}
        <circle cx="0" cy="0" r="6" fill={center} stroke="#2b2033" strokeWidth="1.5" />
      </>);
    case 'stardust':
      return g(<>
        {[0,72,144,216,288].map(a => (
          <path key={a} d="M 0 0 Q -10 -10 -8 -22 Q 0 -26 8 -22 Q 10 -10 0 0 Z" fill={petal} stroke="#ffd24a" strokeWidth="1" transform={`rotate(${a})`} />
        ))}
        {[{x:-8,y:-15},{x:6,y:-18},{x:10,y:-8},{x:-4,y:-20}].map((p,i) => (
          <polygon key={i} points={`${p.x},${p.y-3} ${p.x+1},${p.y} ${p.x+3},${p.y+1} ${p.x+1},${p.y+2} ${p.x},${p.y+3} ${p.x-1},${p.y+2} ${p.x-3},${p.y+1} ${p.x-1},${p.y}`} fill="#ffd24a" />
        ))}
        <circle cx="0" cy="0" r="5" fill={center} />
      </>);
    case 'honeybee':
      return g(<>
        {Array.from({length:10}).map((_,i) => {
          const a = i * 36;
          return <ellipse key={i} cx="0" cy="-15" rx="5" ry="11" fill={petal} stroke="#c28c1f" strokeWidth="1.2" transform={`rotate(${a})`} />;
        })}
        <circle cx="0" cy="0" r="6" fill={center} />
        {/* tiny bee */}
        <g transform="translate(18 -18)">
          <ellipse cx="0" cy="0" rx="3.5" ry="2.5" fill="#ffd24a" stroke="#2b2033" strokeWidth="1" />
          <line x1="-1" y1="-2" x2="-1" y2="2" stroke="#2b2033" strokeWidth="1" />
          <line x1="1" y1="-2" x2="1" y2="2" stroke="#2b2033" strokeWidth="1" />
          <ellipse cx="-1" cy="-2" rx="2.5" ry="1.5" fill="#ffffff" opacity="0.7" />
        </g>
      </>);

    // UNLOCK
    case 'emerald':
      return g(<>
        {[0,45,90,135,180,225,270,315].map(a => (
          <path key={a} d="M 0 0 L -7 -10 L 0 -22 L 7 -10 Z" fill={petal} stroke="#2b2033" strokeWidth="1.5" transform={`rotate(${a})`} />
        ))}
        <circle cx="0" cy="0" r="5" fill={center} stroke="#2b2033" strokeWidth="1.5" />
        <circle cx="-2" cy="-2" r="1.5" fill="#fff" opacity="0.8" />
      </>);
    case 'sakura':
      return g(<>
        {[0,72,144,216,288].map(a => (
          <g key={a} transform={`rotate(${a})`}>
            <path d="M 0 0 Q -9 -10 -4 -22 L 4 -22 Q 9 -10 0 0 Z" fill={petal} stroke="#d08aa3" strokeWidth="1.2" />
            <path d="M 0 -4 L 0 -18" stroke="#c96d8a" strokeWidth="0.8" />
            <path d="M 0 -18 L -1 -22 M 0 -18 L 1 -22" stroke="#c96d8a" strokeWidth="0.8" />
          </g>
        ))}
        <circle cx="0" cy="0" r="3.5" fill={center} stroke="#c96d8a" strokeWidth="1" />
      </>);
    case 'phoenix':
      return g(<>
        {[-50,-25,0,25,50].map((a,i) => (
          <path key={a} d="M 0 0 Q -5 -15 0 -28 Q 5 -15 0 0 Z" fill={petal} stroke="#ffd24a" strokeWidth="1.8" transform={`rotate(${a})`} />
        ))}
        {[20,-20].map((a,i) => (
          <path key={'w'+i} d="M 0 0 Q 18 -4 24 4 Q 14 2 0 0 Z" fill="#ffb085" stroke="#c2453c" strokeWidth="1" transform={`rotate(${a})`} />
        ))}
        <circle cx="0" cy="0" r="6" fill={center} />
        <path d="M -4 0 L 0 -6 L 4 0 Z" fill="#c2453c" />
      </>);

    // UR — 星光花：十芒星射线 + 脉动内核
    case 'starlight':
      return g(<>
        {[0,36,72,108,144,180,216,252,288,324].map(a => (
          <path key={'o'+a} d="M 0 0 L -4 -14 L 0 -28 L 4 -14 Z" fill={petal} stroke="#c28c1f" strokeWidth="0.8" transform={`rotate(${a})`} />
        ))}
        {[18,54,90,126,162,198,234,270,306,342].map(a => (
          <path key={'i'+a} d="M 0 0 L -2.5 -8 L 0 -18 L 2.5 -8 Z" fill="#ffffff" opacity="0.85" transform={`rotate(${a})`} />
        ))}
        <circle cx="0" cy="0" r="8" fill={center} stroke="#c28c1f" strokeWidth="1.5" />
        <circle cx="0" cy="0" r="4" fill="#ffffff" opacity="0.9">
          <animate attributeName="r" values="3;5;3" dur="1.8s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.5;1;0.5" dur="1.8s" repeatCount="indefinite" />
        </circle>
      </>);

    // UR — 琉璃花：六棱水晶折射层 + 闪光
    case 'crystal':
      return g(<>
        {[{a:0,c:'#ff5c6c'},{a:60,c:'#ffb085'},{a:120,c:'#ffd24a'},{a:180,c:'#7ad9b5'},{a:240,c:'#7ec4ff'},{a:300,c:'#b892ff'}].map((p,i) => (
          <polygon key={i} points="0,0 -6,-14 0,-26 6,-14" fill={p.c} stroke="#2b2033" strokeWidth="1.2" opacity="0.92" transform={`rotate(${p.a})`} />
        ))}
        {[30,90,150,210,270,330].map(a => (
          <polygon key={'i'+a} points="0,-2 -3,-10 0,-18 3,-10" fill="#ffffff" opacity="0.75" transform={`rotate(${a})`} />
        ))}
        <circle cx="0" cy="0" r="4" fill="#ffd24a" stroke="#2b2033" strokeWidth="1" />
        <circle cx="-1.5" cy="-1.5" r="1.5" fill="#fff" opacity="0.95">
          <animate attributeName="opacity" values="0.3;1;0.3" dur="2.2s" repeatCount="indefinite" />
        </circle>
        <polygon points="-20,-5 -22,-8 -18,-8" fill="#ffffff" opacity="0.7">
          <animate attributeName="opacity" values="0;0.9;0" dur="3s" repeatCount="indefinite" />
        </polygon>
        <polygon points="20,5 18,8 22,8" fill="#ffffff" opacity="0.7">
          <animate attributeName="opacity" values="0;0.9;0" dur="3s" begin="1.5s" repeatCount="indefinite" />
        </polygon>
      </>);

    default:
      return g(<circle cx="0" cy="0" r="14" fill={petal} />);
  }
}

function WiltedFlower({ size = 100, style, petal = '#a88968' }) {
  return (
    <svg viewBox="0 0 100 140" width={size} height={size * 1.4} style={style}>
      <path d="M 50 140 Q 60 90 68 60" stroke="#7a8c5e" strokeWidth="4" fill="none" strokeLinecap="round" />
      <ellipse cx="42" cy="105" rx="8" ry="3.5" fill="#a88968" transform="rotate(-25 42 105)" stroke="#7c6142" strokeWidth="1" />
      <g transform="translate(68 60) rotate(70)">
        <ellipse cx="0" cy="0" rx="10" ry="12" fill={petal} stroke="#2b2033" strokeWidth="1.5" opacity="0.6" />
        <path d="M -6 -4 Q 0 -10 6 -4" stroke="#2b2033" strokeWidth="1.2" fill="none" />
      </g>
    </svg>
  );
}

function DeadSprig({ size = 100, style }) {
  return (
    <svg viewBox="0 0 100 140" width={size} height={size * 1.4} style={style}>
      <path d="M 50 140 L 52 90 L 60 70" stroke="#7c6142" strokeWidth="3" fill="none" strokeLinecap="round" />
      <path d="M 52 100 L 42 95" stroke="#7c6142" strokeWidth="2" strokeLinecap="round" />
      <path d="M 55 85 L 64 82" stroke="#7c6142" strokeWidth="2" strokeLinecap="round" />
      {/* tiny green sprout next to it */}
      <path d="M 38 140 Q 36 130 40 124" stroke="#6ab04c" strokeWidth="2" fill="none" strokeLinecap="round" />
      <ellipse cx="40" cy="124" rx="3" ry="2" fill="#7ad9b5" />
    </svg>
  );
}

function BudGrowing({ size = 100, style, headOnly = false }) {
  if (headOnly) {
    return (
      <svg viewBox="-30 -30 60 60" width={size} height={size} style={style}>
        <g>
          <path d="M -16 10 Q -20 -6 -8 -14 Q 0 -20 8 -14 Q 20 -6 16 10 Z" fill="#7ab985" stroke="#3b6e2b" strokeWidth="2" />
          <path d="M 0 8 Q -10 -2 -6 -12" stroke="#3b6e2b" strokeWidth="1.5" fill="none" />
          <path d="M 0 8 Q 10 -2 6 -12" stroke="#3b6e2b" strokeWidth="1.5" fill="none" />
          <ellipse cx="0" cy="-4" rx="5" ry="7" fill="#ff9ec4" opacity="0.85" />
        </g>
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 100 140" width={size} height={size * 1.4} style={style}>
      <path d="M 50 140 Q 50 90 50 50" stroke="#5a8f5e" strokeWidth="4" fill="none" strokeLinecap="round" />
      <ellipse cx="40" cy="100" rx="9" ry="4.5" fill="#7ab985" transform="rotate(-30 40 100)" stroke="#3b6e2b" strokeWidth="1" />
      <g transform="translate(50 44)">
        {/* sepals */}
        <path d="M -10 6 Q -12 -4 -5 -8 Q 0 -12 5 -8 Q 12 -4 10 6 Z" fill="#7ab985" stroke="#3b6e2b" strokeWidth="1.5" />
        <path d="M 0 4 Q -6 -2 -4 -8" stroke="#3b6e2b" strokeWidth="1" fill="none" />
        <path d="M 0 4 Q 6 -2 4 -8" stroke="#3b6e2b" strokeWidth="1" fill="none" />
        {/* peek of color */}
        <ellipse cx="0" cy="-2" rx="3" ry="4" fill="#ff9ec4" opacity="0.8" />
      </g>
    </svg>
  );
}

// Tiny pot icon for calendar grid
function PotFlower({ species, quality, size = 36 }) {
  return (
    <div style={{ position: 'relative', width: size, height: size * 1.15 }}>
      <svg viewBox="0 0 60 70" width={size} height={size * 1.15}>
        {/* flower head + stem */}
        {quality === 'dead' ? (
          <g>
            <path d="M 30 56 L 32 42 L 38 34" stroke="#7c6142" strokeWidth="2" fill="none" strokeLinecap="round" />
            <path d="M 32 46 L 24 42" stroke="#7c6142" strokeWidth="1.5" strokeLinecap="round" />
          </g>
        ) : quality === 'wilted' ? (
          <g>
            <path d="M 30 56 Q 36 42 42 32" stroke="#7a8c5e" strokeWidth="2" fill="none" strokeLinecap="round" />
            <g transform="translate(42 32) rotate(70)">
              <ellipse cx="0" cy="0" rx="5" ry="6" fill={(FLOWERS[species]?.petal) || '#a88968'} opacity="0.6" stroke="#2b2033" strokeWidth="0.8" />
            </g>
          </g>
        ) : quality === 'bud' ? (
          <g>
            <path d="M 30 56 L 30 34" stroke="#5a8f5e" strokeWidth="2" fill="none" strokeLinecap="round" />
            <path d="M 24 40 Q 22 34 27 32" stroke="#7ab985" strokeWidth="2" fill="none" strokeLinecap="round" />
            <ellipse cx="30" cy="30" rx="5" ry="6" fill="#7ab985" stroke="#3b6e2b" strokeWidth="1" />
            <ellipse cx="30" cy="28" rx="1.5" ry="2" fill="#ff9ec4" opacity="0.9" />
          </g>
        ) : species ? (
          <g>
            <path d="M 30 56 L 30 36" stroke="#5a8f5e" strokeWidth="2" fill="none" strokeLinecap="round" />
            <path d="M 24 42 Q 22 38 26 36" stroke="#7ab985" strokeWidth="1.5" fill="none" />
            <g transform="translate(30 30) scale(0.55)">
              {renderFlowerHead(FLOWERS[species]?.shape || 'daisy', FLOWERS[species]?.petal || '#ff9ec4', FLOWERS[species]?.center || '#ffd24a', 'perfect')}
            </g>
          </g>
        ) : null}
        {/* pot */}
        <path d="M 14 56 L 46 56 L 42 68 L 18 68 Z" fill="#c98a5b" stroke="#7c6142" strokeWidth="2" strokeLinejoin="round" />
        <rect x="12" y="54" width="36" height="4" rx="1" fill="#a88968" stroke="#7c6142" strokeWidth="1.5" />
      </svg>
    </div>
  );
}

// Empty pot (future days)
function EmptyPot({ size = 36 }) {
  return (
    <svg viewBox="0 0 60 70" width={size} height={size * 1.15} style={{ opacity: 0.28 }}>
      <path d="M 14 56 L 46 56 L 42 68 L 18 68 Z" fill="#c98a5b" stroke="#7c6142" strokeWidth="1.5" strokeLinejoin="round" />
      <rect x="12" y="54" width="36" height="4" rx="1" fill="#a88968" stroke="#7c6142" strokeWidth="1" />
    </svg>
  );
}

Object.assign(window, { FlowerSVG, WiltedFlower, DeadSprig, BudGrowing, PotFlower, EmptyPot, renderFlowerHead });
