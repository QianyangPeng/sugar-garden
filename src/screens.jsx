// Screen components for the Sugar Garden app.
const { useState, useEffect, useRef, useMemo } = React;

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

// ============ PLANTING CEREMONY (Journey 2) ============
function PlantingCeremony({ date, flower, newUnlocks, onDone, childName }) {
  const [phase, setPhase] = useState(0); // 0: intro, 1: hands planting, 2: reveal, 3: unlock if any
  const [totalLabel, setTotalLabel] = useState('');

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 600),
      setTimeout(() => setPhase(2), 2100),
      setTimeout(() => { if (newUnlocks.length > 0) setPhase(3); }, 4200),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  const d = parseYMD(date);
  const dateStr = `${d.getMonth()+1}月${d.getDate()}日`;
  const q = flower.quality;
  const species = flower.speciesId;
  const msg = q === 'dead' ? `${dateStr} 吃得有点多\n不过明天又是新开始` :
              q === 'wilted' ? `${dateStr} 的花蔫了一点点\n没关系的` :
              q === 'okish' ? `${dateStr} 差一点就完美啦` :
              q === 'ok' ? `${dateStr} 的花开得不错` :
              q === 'great' ? `${dateStr} 开出了漂亮的花` :
              `${dateStr} 开出了精神饱满的花！`;

  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 60,
      background: 'linear-gradient(180deg, #d7e6c6 0%, #f3f8ee 55%, #e6dbc5 100%)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: 24, overflow: 'hidden',
    }}>
      {/* Sunlight rays when phase >= 2 */}
      {phase >= 2 && (
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background: 'radial-gradient(ellipse at center, rgba(255,224,138,0.35) 0%, transparent 60%)',
          animation: 'sunPulse 1.4s ease-out',
        }} />
      )}

      <div style={{ font: "500 13px 'Noto Sans SC'", color: '#5c6d54', textAlign: 'center' }}>
        🌤️ 今天是新的一天
      </div>
      <div style={{ font: "700 22px 'ZCOOL KuaiLe'", color: '#23331f', marginTop: 4, textAlign: 'center' }}>
        把昨天的花种进花园
      </div>

      {/* The scene */}
      <div style={{ position: 'relative', width: 280, height: 280, marginTop: 24 }}>
        {/* soil pot */}
        <svg viewBox="0 0 280 280" width="280" height="280" style={{ position: 'absolute', inset: 0 }}>
          <path d="M 70 210 L 210 210 L 195 260 L 85 260 Z" fill="#c98a5b" stroke="#7c6142" strokeWidth="4" strokeLinejoin="round" />
          <rect x="64" y="204" width="152" height="14" rx="2" fill="#a88968" stroke="#7c6142" strokeWidth="3" />
          <ellipse cx="140" cy="212" rx="66" ry="6" fill="#5a3a20" opacity="0.6" />
          {/* sparkles */}
          {phase >= 2 && [[60,80],[220,100],[230,180],[50,160],[180,50]].map(([x,y], i) => (
            <g key={i} style={{ animation: `sparkle 1.8s ${i*0.15}s ease-out infinite` }}>
              <polygon points={`${x},${y-5} ${x+1.5},${y-1.5} ${x+5},${y} ${x+1.5},${y+1.5} ${x},${y+5} ${x-1.5},${y+1.5} ${x-5},${y} ${x-1.5},${y-1.5}`} fill="#ffd24a" />
            </g>
          ))}
        </svg>

        {/* hands lowering the flower */}
        <div style={{
          position: 'absolute', left: '50%', top: phase >= 2 ? 30 : phase === 1 ? 20 : -120,
          transform: 'translateX(-50%)',
          transition: 'top 1.2s cubic-bezier(.4,.2,.2,1), opacity 0.4s',
          opacity: phase >= 2 ? 1 : phase === 1 ? 1 : 0,
        }}>
          <FlowerSVG size={150} species={species} quality={q === 'dead' || q === 'wilted' ? q : q} animate={phase >= 2} />
        </div>
      </div>

      {/* Caption */}
      <div style={{
        marginTop: 10, padding: '14px 20px',
        background: '#fff', border: '2px solid #23331f', borderRadius: 18,
        boxShadow: '0 4px 0 #23331f', maxWidth: 320,
        opacity: phase >= 2 ? 1 : 0, transition: 'opacity 0.5s',
      }}>
        <div style={{ font: "700 14px/1.5 'Noto Sans SC'", color: '#23331f', textAlign: 'center', whiteSpace: 'pre-line' }}>
          {msg}
        </div>
        {species && FLOWERS[species] && (
          <div style={{
            marginTop: 8, font: "700 13px 'ZCOOL KuaiLe'", textAlign: 'center',
            color: FLOWERS[species].rarity === 'common' ? '#3b6e2b' :
                   FLOWERS[species].rarity === 'rare' ? '#b892ff' : '#c2453c',
          }}>
            {FLOWERS[species].rarity === 'rare' ? '✨ 稀有花 · ' : FLOWERS[species].rarity === 'unlock' ? '🎖 解锁花 · ' : ''}
            {FLOWERS[species].name}
          </div>
        )}
      </div>

      {/* Unlock surprise */}
      {phase >= 3 && newUnlocks.length > 0 && (
        <div style={{
          position: 'absolute', inset: 0, background: 'rgba(35,51,31,0.7)',
          display: 'grid', placeItems: 'center', zIndex: 5,
          animation: 'fadeIn 0.4s',
        }}>
          <div style={{
            background: '#fffef5', border: '3px solid #23331f', borderRadius: 24,
            padding: '28px 24px', maxWidth: 300, boxShadow: '0 6px 0 #23331f', textAlign: 'center',
          }}>
            <div style={{ font: "700 14px 'Noto Sans SC'", color: '#c2453c', letterSpacing: 1 }}>🎖 新品种解锁</div>
            <div style={{ margin: '12px 0', display: 'flex', justifyContent: 'center' }}>
              <FlowerSVG size={120} species={newUnlocks[0]} quality="perfect" animate />
            </div>
            <div style={{ font: "700 22px 'ZCOOL KuaiLe'" }}>{FLOWERS[newUnlocks[0]].name}</div>
            <div style={{ font: "500 12px/1.5 'Noto Sans SC'", color: '#5c6d54', marginTop: 4 }}>
              {FLOWERS[newUnlocks[0]].desc}
            </div>
            <button onClick={onDone} style={{
              marginTop: 16, padding: '10px 28px', borderRadius: 14,
              border: '2px solid #23331f', background: '#6ab04c', color: '#fff',
              font: "700 14px 'Noto Sans SC'", cursor: 'pointer', boxShadow: '0 3px 0 #23331f',
            }}>太棒啦！进入花园</button>
          </div>
        </div>
      )}

      {/* Continue */}
      {phase >= 2 && newUnlocks.length === 0 && (
        <button onClick={onDone} style={{
          marginTop: 18, padding: '14px 32px', borderRadius: 22,
          border: '3px solid #23331f', background: '#23331f', color: '#fff',
          font: "700 16px 'Noto Sans SC'", cursor: 'pointer', boxShadow: '0 4px 0 #101a0e',
          opacity: phase >= 2 ? 1 : 0, transition: 'opacity 0.5s 0.5s',
        }}>去看今天的花苞 →</button>
      )}

      <style>{`
        @keyframes sparkle { 0%,100%{opacity:0;transform:scale(0.5);} 50%{opacity:1;transform:scale(1.2);} }
        @keyframes sunPulse { 0%{opacity:0;} 60%{opacity:1;} 100%{opacity:0.6;} }
        @keyframes fadeIn { from{opacity:0;} to{opacity:1;} }
      `}</style>
    </div>
  );
}

// ============ TODAY SCREEN ============
function TodayScreen({ state, setState, onOpenPicker, onOpenSchool, onOpenCalendar, onOpenSettings, onOpenTrend, showOverage }) {
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

  // Bud state: predict species using current (mid-day) ratio
  const previewQuality = status.ratio >= 1.3 ? 'dead' :
                         status.ratio >= 1.0 ? 'wilted' :
                         status.health === 'wilting' ? 'okish' :
                         status.health === 'stressed' ? 'ok' :
                         status.health === 'ok' ? 'great' : 'perfect';

  const healthMsg = status.health === 'thriving' ? `${name}今天状态超好！花苞鼓鼓的～` :
                   status.health === 'ok' ? `${name}今天吃得刚好，花苞慢慢长` :
                   status.health === 'stressed' ? '花苞有点担心…稍微省着吃哦' :
                   status.ratio >= 1.3 ? '呜…今天糖糖太多啦，花蔫了' :
                   '糖快超标啦，花有点难过';

  const healthColor = status.health === 'thriving' ? '#3b6e2b' :
                      status.health === 'ok' ? '#6ab04c' :
                      status.health === 'stressed' ? '#d68c1f' : '#c2453c';

  return (
    <div style={{ height: '100%', overflowY: 'auto', paddingBottom: 110,
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

      {/* Today's bud card */}
      <div style={{ margin: '8px 18px 0', padding: 20,
        background: '#fff', border: '2.5px solid #23331f', borderRadius: 24,
        boxShadow: '0 5px 0 #23331f', display: 'flex', gap: 14, alignItems: 'center' }}>
        <div style={{ width: 110, height: 154, flexShrink: 0, display: 'grid', placeItems: 'center' }}>
          <FlowerSVG size={110} species={null} quality="bud" animate />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ font: "700 14px/1.4 'Noto Sans SC'", color: healthColor }}>{healthMsg}</div>
          <div style={{ marginTop: 10, display: 'flex', alignItems: 'baseline', gap: 4 }}>
            <div style={{ font: "800 34px 'Baloo 2'", color: status.ratio >= 1 ? '#c2453c' : '#23331f', lineHeight: 1 }}>
              {status.total}
            </div>
            <div style={{ font: "600 14px 'Baloo 2'", color: '#5c6d54' }}>/{status.limit}g</div>
          </div>
          <div style={{ font: "500 11px 'Noto Sans SC'", color: '#5c6d54', marginTop: 2 }}>
            {status.ratio < 1 ? `还能吃 ${status.limit - status.total}g` : `超出 ${status.total - status.limit}g`}
          </div>
        </div>
      </div>

      {/* Progress bar with 3 segments */}
      <div style={{ margin: '14px 18px 0' }}>
        <SegmentedProgress total={status.total} limit={status.limit} expected={status.expected}
          entries={day.entries} schoolSugar={day.schoolSugar} />
      </div>

      {/* School (weekday) / free day */}
      <div style={{ margin: '14px 18px 0' }}>
        <SchoolCard date={date} isSchoolDay={isSchoolDay} day={day} onClick={onOpenSchool} />
      </div>

      {/* Quick-add */}
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
        <button onClick={onOpenCalendar} style={{
          width: 56, padding: '14px 0', borderRadius: 18,
          border: '2.5px solid #23331f', background: '#fff',
          fontSize: 22, cursor: 'pointer', boxShadow: '0 4px 0 #23331f',
        }}>🌻</button>
        <button onClick={onOpenTrend} style={{
          width: 56, padding: '14px 0', borderRadius: 18,
          border: '2.5px solid #23331f', background: '#fff',
          fontSize: 22, cursor: 'pointer', boxShadow: '0 4px 0 #23331f',
        }}>📈</button>
      </div>

      {/* Today log */}
      <div style={{ margin: '18px 18px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
          <div style={{ font: "700 15px 'ZCOOL KuaiLe'", color: '#23331f' }}>今天的糖糖日记</div>
          <div style={{ font: "500 11px 'Noto Sans SC'", color: '#5c6d54' }}>{day.entries.length} 条</div>
        </div>
        <EntryList entries={day.entries} onDelete={(id) => setState(s => removeEntry(s, date, id))} />
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
function CalendarScreen({ state, setState, onClose, onPickDate }) {
  const [refDate, setRefDate] = useState(new Date());
  const month = monthData(state, refDate);
  const monthNames = ['一','二','三','四','五','六','七','八','九','十','十一','十二'];
  const dows = ['一','二','三','四','五','六','日'];
  const todayKey = ymd(new Date());

  // Count rare & unlocks in this month
  const stats = useMemo(() => {
    let common = 0, rare = 0, unlock = 0, wilted = 0;
    for (const c of month.cells) {
      if (!c || !c.data || !c.data.flower) continue;
      const sp = c.data.flower.speciesId;
      const q = c.data.flower.quality;
      if (q === 'wilted' || q === 'dead') wilted++;
      else if (sp && FLOWERS[sp]) {
        if (FLOWERS[sp].rarity === 'rare') rare++;
        else if (FLOWERS[sp].rarity === 'unlock') unlock++;
        else common++;
      }
    }
    return { common, rare, unlock, wilted };
  }, [month]);

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 45,
      background: 'linear-gradient(180deg, #f3f8ee 0%, #e0e9d0 100%)',
      display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ padding: '16px 18px 8px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <button onClick={onClose} style={{ width: 36, height: 36, borderRadius: 12,
          border: '2px solid #23331f', background: '#fff', fontSize: 16, cursor: 'pointer', boxShadow: '0 2px 0 #23331f' }}>←</button>
        <div style={{ flex: 1 }}>
          <div style={{ font: "700 20px 'ZCOOL KuaiLe'", color: '#23331f' }}>我的花园</div>
        </div>
        <button onClick={() => setRefDate(d => { const n = new Date(d); n.setMonth(n.getMonth() - 1); return n; })}
          style={{ width: 32, height: 32, borderRadius: 10, border: '2px solid #23331f', background: '#fff', cursor: 'pointer', boxShadow: '0 2px 0 #23331f' }}>‹</button>
        <div style={{ font: "700 14px 'ZCOOL KuaiLe'", minWidth: 60, textAlign: 'center' }}>{month.year}年 {monthNames[month.month]}月</div>
        <button onClick={() => setRefDate(d => { const n = new Date(d); n.setMonth(n.getMonth() + 1); return n; })}
          style={{ width: 32, height: 32, borderRadius: 10, border: '2px solid #23331f', background: '#fff', cursor: 'pointer', boxShadow: '0 2px 0 #23331f' }}>›</button>
      </div>

      {/* Legend */}
      <div style={{ padding: '0 18px', display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
        <LegendPill color="#6ab04c" label={`${stats.common} 朵`} />
        {stats.rare > 0 && <LegendPill color="#b892ff" label={`✨${stats.rare}`} />}
        {stats.unlock > 0 && <LegendPill color="#c2453c" label={`🎖${stats.unlock}`} />}
        {stats.wilted > 0 && <LegendPill color="#8a9a85" label={`蔫 ${stats.wilted}`} />}
      </div>

      {/* Calendar grid */}
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
            const flower = c.data?.flower;
            const total = c.data ? totalForDay(c.data) : 0;
            const rare = flower?.speciesId && FLOWERS[flower.speciesId]?.rarity !== 'common';
            return (
              <button key={i} onClick={() => (isPast || isToday) && c.data && onPickDate(c.date)}
                style={{
                  position: 'relative',
                  aspectRatio: '0.82', padding: 2,
                  background: isToday ? '#fff9dc' : isPast ? '#fffef5' : '#f3f8ee',
                  border: isToday ? '2.5px solid #ffd24a' : rare ? '2px solid #b892ff' : '1.5px solid #e0e6d5',
                  borderRadius: 12, cursor: (isPast || isToday) && c.data ? 'pointer' : 'default',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between',
                  paddingTop: 3, paddingBottom: 3,
                }}>
                <div style={{ font: "700 10px 'Baloo 2'", color: isToday ? '#c2453c' : isFuture ? '#8a9a85' : '#23331f' }}>{c.day}</div>
                <div style={{ flex: 1, display: 'grid', placeItems: 'center' }}>
                  {isFuture ? <EmptyPot size={28} /> :
                   isToday ? <BudGrowing size={32} style={{ width: 32, height: 37 }} /> :
                   c.data && flower ? <PotFlower species={flower.speciesId} quality={flower.quality} size={30} /> :
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

        {/* Unlock gallery */}
        {state.unlockedUnlocks.length > 0 && (
          <div style={{ marginTop: 20, padding: 14, background: '#fff', border: '2px solid #cfe3be', borderRadius: 16 }}>
            <div style={{ font: "700 14px 'ZCOOL KuaiLe'", marginBottom: 10 }}>🎖 解锁图鉴</div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {state.unlockedUnlocks.map(k => (
                <div key={k} style={{ textAlign: 'center' }}>
                  <FlowerSVG size={54} species={k} quality="perfect" />
                  <div style={{ font: "600 10px 'Noto Sans SC'", marginTop: 2 }}>{FLOWERS[k].name}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
function LegendPill({ color, label }) {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '4px 10px', background: '#fff', border: `1.5px solid ${color}`,
      borderRadius: 999, font: "600 11px 'Noto Sans SC'", color: '#23331f' }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
      {label}
    </div>
  );
}

// ============ DAY DETAIL (Journey 6 continued) ============
function DayDetail({ date, state, onClose }) {
  const day = state.days[date];
  if (!day) return null;
  const d = parseYMD(date);
  const flower = day.flower;
  const species = flower?.speciesId;
  const q = flower?.quality || 'ok';
  const total = totalForDay(day);
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
        <div style={{
          background: '#fff', border: '2.5px solid #23331f', borderRadius: 22,
          padding: 20, boxShadow: '0 5px 0 #23331f', textAlign: 'center',
        }}>
          <div style={{ display: 'grid', placeItems: 'center' }}>
            <FlowerSVG size={140} species={species} quality={q} animate />
          </div>
          <div style={{ font: "700 22px 'ZCOOL KuaiLe'", marginTop: 4,
            color: q === 'dead' || q === 'wilted' ? '#c2453c' :
                  species && FLOWERS[species]?.rarity === 'rare' ? '#b892ff' :
                  species && FLOWERS[species]?.rarity === 'unlock' ? '#c2453c' : '#3b6e2b' }}>
            {species ? FLOWERS[species].name : q === 'dead' ? '花枯萎了' : '花蔫了'}
          </div>
          {species && FLOWERS[species].desc && (
            <div style={{ font: "500 12px 'Noto Sans SC'", color: '#5c6d54', marginTop: 4 }}>
              {FLOWERS[species].desc}
            </div>
          )}
          <div style={{ marginTop: 14, display: 'flex', justifyContent: 'center', gap: 20 }}>
            <Stat label="总糖分" value={`${total}g`} color={total > state.settings.dailyLimit ? '#c2453c' : '#3b6e2b'} />
            <Stat label="上限" value={`${state.settings.dailyLimit}g`} color="#5c6d54" />
            <Stat label="记录" value={`${day.entries.length} 条`} color="#5c6d54" />
          </div>
        </div>

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
          <EntryList entries={day.entries} onDelete={() => {}} />
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
          <SummaryCard label="连续" value={`${computeStreak(state, ymd(new Date()))} 天`} color="#b892ff" />
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
        <div style={{ marginTop: 20, padding: 16, background: '#fff', border: '2px dashed #e0e6d5', borderRadius: 16 }}>
          <div style={{ font: "700 13px 'Noto Sans SC'", color: '#23331f' }}>📊 我的花园</div>
          <div style={{ font: "500 11px 'Noto Sans SC'", color: '#5c6d54', marginTop: 4, lineHeight: 1.6 }}>
            已种花 {Object.values(state.days).filter(d => d.planted && d.flower && d.flower.speciesId).length} 朵<br/>
            解锁花种 {state.unlockedUnlocks.length} / 3
          </div>
        </div>

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

Object.assign(window, {
  WelcomeScreen, NewFamilyOnboarding, JoinFamilyFlow,
  PlantingCeremony, TodayScreen, FoodPicker,
  SchoolSheet, OverageModal, CalendarScreen, DayDetail, TrendScreen, SettingsScreen,
  EntryList,
});
