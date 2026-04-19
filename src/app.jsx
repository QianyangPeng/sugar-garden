// Main app wiring. Multi-family, cloud-synced.
// React hook bindings (useState, useEffect, useRef, useMemo) are declared at the
// top of screens.jsx and shared via the Realm's global environment. Re-declaring
// them here would clash with that binding under Babel Standalone.

function App() {
  const [identity, setIdentity] = useState(() => loadIdentity());
  const [state, setState] = useState(() => loadState() || defaultState());
  const [route, setRoute] = useState('today');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [schoolOpen, setSchoolOpen] = useState(false);
  const [overageOpen, setOverageOpen] = useState(false);
  const [dayDetailDate, setDayDetailDate] = useState(null);
  const [plantQueue, setPlantQueue] = useState([]);
  const [choice, setChoice] = useState(null);   // 'new' | 'join'
  const [inviteFrag, setInviteFrag] = useState(() => parseInviteFragment());
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [syncStatus, setSyncStatus] = useState('idle'); // idle | syncing | offline | authErr
  const didBootRef = useRef(false);
  const firstSyncRef = useRef(false);

  // ---- Identity gate ----
  const needWelcome = !identity;
  const needOnboard = !!identity && !state.settings.onboarded;

  // ---- Sync on mount + periodic ----
  useEffect(() => {
    if (!identity) return;
    let cancelled = false;
    const tick = async () => {
      if (cancelled) return;
      if (!navigator.onLine) { firstSyncRef.current = true; setSyncStatus('offline'); return; }
      setSyncStatus('syncing');
      try {
        const res = await syncAll(state, identity, { onState: (s) => { if (!cancelled) setState(s); } });
        if (cancelled) return;
        if (res.authError) {
          setSyncStatus('authErr');
          clearIdentity();
          try { localStorage.removeItem(LS_STATE); } catch {}
          setIdentity(null);
          setState(defaultState());
          return;
        }
        setSyncStatus('idle');
      } catch {
        setSyncStatus('offline');
      } finally {
        firstSyncRef.current = true;
      }
    };
    tick();
    const iv = setInterval(tick, 30000);
    const onOnline = () => tick();
    window.addEventListener('online', onOnline);
    return () => { cancelled = true; clearInterval(iv); window.removeEventListener('online', onOnline); };
  }, [identity]);

  // ---- First-open-today: plant past days' flowers ----
  useEffect(() => {
    if (didBootRef.current) return;
    if (needWelcome || needOnboard) return;
    if (!firstSyncRef.current) return;   // wait for initial sync
    didBootRef.current = true;
    const today = ymd(new Date());
    if (state.lastOpenedDate !== today) {
      const pending = unplantedPastDays(state);
      let s = state;
      const q = [];
      for (const d of pending) {
        const res = plantFlowerFor(s, d, identity.familyId);
        s = res.state;
        if (res.newlyPlanted) q.push({ date: d, flower: res.newlyPlanted.flower, newUnlocks: res.newUnlocks });
      }
      s = { ...s, lastOpenedDate: today };
      saveState(s);
      setState(s);
      if (q.length > 0) setPlantQueue([q[q.length - 1]]);
    }
  }, [needWelcome, needOnboard, state, identity, syncStatus]);

  // ---- Overage detection ----
  useEffect(() => {
    if (needWelcome || needOnboard) return;
    const date = ymd(new Date());
    const st = dayStatus(state, date);
    if (st.ratio >= 1.0 && !state.ui.seenOverage[date]) {
      setOverageOpen(true);
      const next = { ...state, ui: { ...state.ui, seenOverage: { ...state.ui.seenOverage, [date]: true } } };
      saveState(next);
      setState(next);
    }
  }, [state.days]);

  // Hide boot splash
  useEffect(() => {
    const el = document.getElementById('boot');
    if (el) el.classList.add('gone');
  }, []);

  // ---- Handlers ----

  async function handleCreateNew({ childName, dateOfBirth, dailyLimit, memberName, turnstileToken }) {
    setBusy(true); setErrorMsg('');
    try {
      const id = await createNewFamily({ turnstileToken, childName, dateOfBirth, dailyLimit, memberName });
      const initial = updateSettings(defaultState(), {
        childName, dateOfBirth, dailyLimit, onboarded: true,
      });
      // Server is already in sync; clear pending flag we just created.
      const cleaned = markSettingsSynced({ ...initial, lastOpenedDate: ymd(new Date()), lastSyncAt: Date.now() });
      saveState(cleaned);
      setState(cleaned);
      setIdentity(id);
      firstSyncRef.current = true;
    } catch (e) {
      const msg = e?.message || String(e);
      if (msg === 'turnstile_failed') setErrorMsg('验证未通过，请再试一次');
      else if (msg === 'too_many_requests') setErrorMsg('请求过多，请稍等一下');
      else if (msg === 'registration_paused') setErrorMsg('今天注册人数较多，暂时关闭，请明天再试');
      else if (msg === 'no_api_url') setErrorMsg('后端尚未配置，请联系部署者');
      else setErrorMsg('创建失败：' + msg);
    } finally { setBusy(false); }
  }

  async function handleJoin({ frag, memberName }) {
    setBusy(true); setErrorMsg('');
    try {
      const { identity: id, payload } = await joinFamily(frag, memberName);
      const base = defaultState();
      const merged = applyServerFamily({ ...base, lastSyncAt: Date.now() }, payload.family, payload.members);
      const cleaned = markSettingsSynced(merged);
      saveState(cleaned);
      setState(cleaned);
      setIdentity(id);
      clearInviteFragment();
      setInviteFrag(null);
      firstSyncRef.current = true;
    } catch (e) {
      const msg = e?.message || String(e);
      if (msg === 'unauthorized') setErrorMsg('邀请链接无效或已过期');
      else if (msg === 'no_api_url') setErrorMsg('后端尚未配置，请联系部署者');
      else setErrorMsg('加入失败：' + msg);
    } finally { setBusy(false); }
  }

  async function handleRotateToken() {
    setBusy(true); setErrorMsg('');
    try {
      const updated = await rotateFamilyToken(identity);
      setIdentity(updated);
      alert('邀请链接已重新生成。之前发的旧链接都失效了。');
    } catch (e) {
      alert('重置失败：' + (e?.message || e));
    } finally { setBusy(false); }
  }

  function handleLeaveFamily() {
    clearIdentity();
    try { localStorage.removeItem(LS_STATE); } catch {}
    setIdentity(null);
    setState(defaultState());
    setRoute('today');
    setPlantQueue([]);
    setChoice(null);
    setInviteFrag(parseInviteFragment());
  }

  // ---- Auto-push pending ops ----
  // Any mutation through addEntry/removeEntry/setSchoolSugar/updateSettings sets a _pending
  // flag; this effect observes state and flushes shortly after (debounced).
  const pushTimerRef = useRef(null);
  useEffect(() => {
    if (!identity) return;
    const hasPending = state.settings._settingsPending ||
      Object.values(state.days).some(d => d._schoolPending || d.entries.some(e => e._pending));
    if (!hasPending) return;
    if (pushTimerRef.current) clearTimeout(pushTimerRef.current);
    pushTimerRef.current = setTimeout(() => {
      flushPending(loadState() || state, identity, { onState: setState }).catch(() => {});
    }, 800);
    return () => { if (pushTimerRef.current) clearTimeout(pushTimerRef.current); };
  }, [state, identity]);

  function handleAddEntry(item) {
    const memberId = identity?.memberId;
    const { state: next } = addEntry(state, { ...item, memberId });
    setState(next);
    setPickerOpen(false);
  }

  // ---- Render gate ----

  if (needWelcome) {
    if (inviteFrag && !choice) {
      return <JoinFamilyFlow
        inviteFrag={inviteFrag}
        onDone={handleJoin}
        onBack={() => { clearInviteFragment(); setInviteFrag(null); setChoice(null); }}
        busy={busy}
        errorMsg={errorMsg} />;
    }
    if (!choice) {
      return <WelcomeScreen onChoose={setChoice} />;
    }
    if (choice === 'new') {
      return <NewFamilyOnboarding
        onDone={handleCreateNew}
        onBack={() => { setChoice(null); setErrorMsg(''); }}
        busy={busy}
        errorMsg={errorMsg} />;
    }
    return <JoinFamilyFlow
      inviteFrag={inviteFrag}
      onDone={handleJoin}
      onBack={() => { setChoice(null); setErrorMsg(''); }}
      busy={busy}
      errorMsg={errorMsg} />;
  }

  if (needOnboard) {
    // This is a safety fallback — normally onboarded flips true in handleCreateNew / handleJoin.
    // Shows a spinner while the first sync completes for joiners.
    return (
      <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center',
        background: '#f3f8ee', font: "600 14px 'Noto Sans SC'", color: '#5c6d54' }}>
        🌱 正在同步家人的花园…
      </div>
    );
  }

  const currentCeremony = plantQueue[0];

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      <TodayScreen
        state={state}
        setState={setState}
        identity={identity}
        onOpenPicker={() => setPickerOpen(true)}
        onOpenSchool={() => setSchoolOpen(true)}
        onOpenCalendar={() => setRoute('calendar')}
        onOpenSettings={() => setRoute('settings')}
        onOpenTrend={() => setRoute('trend')}
        syncStatus={syncStatus}
      />
      {route === 'calendar' && (
        <CalendarScreen
          state={state}
          setState={setState}
          onClose={() => setRoute('today')}
          onPickDate={(d) => { setDayDetailDate(d); setRoute('day-detail'); }}
        />
      )}
      {route === 'day-detail' && dayDetailDate && (
        <DayDetail date={dayDetailDate} state={state} onClose={() => setRoute('calendar')} />
      )}
      {route === 'trend' && (
        <TrendScreen state={state} onClose={() => setRoute('today')} />
      )}
      {route === 'settings' && (
        <SettingsScreen
          state={state}
          setState={setState}
          onClose={() => setRoute('today')}
          identity={identity}
          onRotateToken={handleRotateToken}
          onLeaveFamily={handleLeaveFamily}
        />
      )}
      <FoodPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onPick={handleAddEntry}
      />
      <SchoolSheet
        open={schoolOpen}
        onClose={() => setSchoolOpen(false)}
        state={state}
        setState={setState}
      />
      <OverageModal
        open={overageOpen}
        onClose={() => setOverageOpen(false)}
        total={dayStatus(state, ymd(new Date())).total}
        limit={state.settings.dailyLimit}
        name={state.settings.childName || '小宝贝'}
      />
      {currentCeremony && (
        <PlantingCeremony
          date={currentCeremony.date}
          flower={currentCeremony.flower}
          newUnlocks={currentCeremony.newUnlocks}
          childName={state.settings.childName}
          onDone={() => setPlantQueue(q => q.slice(1))}
        />
      )}
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
