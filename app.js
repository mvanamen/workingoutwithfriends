/* Working Out With Friends — vanilla JS, geen build stap nodig.
   Data staat in localStorage op het toestel. Export/import via Instellingen. */
(function () {
  'use strict';

  const STORAGE_KEY = 'wowf.v1';
  const GROUPS = ['Borst', 'Rug', 'Schouders', 'Biceps', 'Triceps', 'Benen', 'Core', 'Cardio'];
  const DURATIONS = [30, 45, 60, 75, 90];

  // ---------- standaard data ----------
  const DEFAULT_PEOPLE = [
    { id: 'maikel', name: 'Maikel', color: '#2450F5', bio: 'Techneut, houdt van structuur. Wil sterker worden zonder het lijf te slopen.', goal: 'Compound lifts omhoog, elke week net iets meer.' },
    { id: 'sjoerd', name: 'Sjoerd', color: '#E8891D', bio: 'Vul hier een korte omschrijving in via Wij.', goal: 'Doel nog niet ingevuld.' },
    { id: 'rens',   name: 'Rens',   color: '#159E8C', bio: 'Vul hier een korte omschrijving in via Wij.', goal: 'Doel nog niet ingevuld.' },
  ];

  // sets/reps zijn defaults; compound = zwaar samengesteld, komt vooraan in het schema
  const DEFAULT_EXERCISES = [
    // Borst
    { name: 'Bench press (barbell)', group: 'Borst', sets: 4, reps: '6-8', compound: true },
    { name: 'Incline dumbbell press', group: 'Borst', sets: 3, reps: '8-12' },
    { name: 'Chest press machine', group: 'Borst', sets: 3, reps: '10-12' },
    { name: 'Cable fly', group: 'Borst', sets: 3, reps: '12-15' },
    { name: 'Push-ups', group: 'Borst', sets: 3, reps: 'max' },
    // Rug
    { name: 'Deadlift', group: 'Rug', sets: 4, reps: '5', compound: true },
    { name: 'Lat pulldown', group: 'Rug', sets: 3, reps: '8-12' },
    { name: 'Seated cable row', group: 'Rug', sets: 3, reps: '10-12' },
    { name: 'Barbell row', group: 'Rug', sets: 3, reps: '8-10', compound: true },
    { name: 'Pull-ups', group: 'Rug', sets: 3, reps: 'max' },
    { name: 'Single-arm dumbbell row', group: 'Rug', sets: 3, reps: '10-12' },
    // Schouders
    { name: 'Overhead press (barbell)', group: 'Schouders', sets: 4, reps: '6-8', compound: true },
    { name: 'Dumbbell shoulder press', group: 'Schouders', sets: 3, reps: '8-12' },
    { name: 'Lateral raise', group: 'Schouders', sets: 3, reps: '12-15' },
    { name: 'Face pull', group: 'Schouders', sets: 3, reps: '15' },
    { name: 'Rear delt fly', group: 'Schouders', sets: 3, reps: '12-15' },
    // Biceps
    { name: 'Barbell curl', group: 'Biceps', sets: 3, reps: '8-12' },
    { name: 'Dumbbell curl', group: 'Biceps', sets: 3, reps: '10-12' },
    { name: 'Hammer curl', group: 'Biceps', sets: 3, reps: '10-12' },
    { name: 'Cable curl', group: 'Biceps', sets: 3, reps: '12-15' },
    // Triceps
    { name: 'Triceps pushdown', group: 'Triceps', sets: 3, reps: '10-12' },
    { name: 'Skull crushers', group: 'Triceps', sets: 3, reps: '8-12' },
    { name: 'Dips', group: 'Triceps', sets: 3, reps: 'max' },
    { name: 'Overhead triceps extension', group: 'Triceps', sets: 3, reps: '10-12' },
    // Benen
    { name: 'Squat (barbell)', group: 'Benen', sets: 4, reps: '6-8', compound: true },
    { name: 'Leg press', group: 'Benen', sets: 3, reps: '10-12' },
    { name: 'Romanian deadlift', group: 'Benen', sets: 3, reps: '8-10', compound: true },
    { name: 'Walking lunges', group: 'Benen', sets: 3, reps: '12 p/been' },
    { name: 'Leg extension', group: 'Benen', sets: 3, reps: '12-15' },
    { name: 'Leg curl', group: 'Benen', sets: 3, reps: '12-15' },
    { name: 'Calf raise', group: 'Benen', sets: 4, reps: '15' },
    // Core
    { name: 'Plank', group: 'Core', sets: 3, reps: '45 sec' },
    { name: 'Hanging leg raise', group: 'Core', sets: 3, reps: '12' },
    { name: 'Cable crunch', group: 'Core', sets: 3, reps: '15' },
    { name: 'Ab wheel rollout', group: 'Core', sets: 3, reps: '10' },
    // Cardio
    { name: 'Roeien (interval)', group: 'Cardio', sets: 1, reps: '10 min', cardio: true },
    { name: 'Fietsen', group: 'Cardio', sets: 1, reps: '10 min', cardio: true },
    { name: 'Loopband (hellend wandelen)', group: 'Cardio', sets: 1, reps: '10 min', cardio: true },
    { name: 'Assault bike sprints', group: 'Cardio', sets: 1, reps: '8 x 20 sec', cardio: true },
  ];

  const DEFAULT_SETTINGS = { restSeconds: 90, minutesPerExercise: 8, warmupMinutes: 5 };

  // ---------- state ----------
  let state = load();
  let ui = { tab: 'today', progressPerson: null, progressExercise: null, editingEx: null, editingPerson: null, quick: false };
  let tickTimer = null;
  let rest = null; // { endsAt, timer }

  function uid() { return Math.random().toString(36).slice(2, 10); }

  function load() {
    let s = null;
    try { s = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); } catch (e) { s = null; }
    if (!s) {
      s = {
        people: DEFAULT_PEOPLE.map(p => ({ ...p })),
        exercises: DEFAULT_EXERCISES.map(e => ({ id: uid(), compound: false, cardio: false, ...e })),
        settings: { ...DEFAULT_SETTINGS },
        session: null,
        history: [],
        lastSetup: { people: DEFAULT_PEOPLE.map(p => p.id), groups: ['Borst', 'Rug'], duration: 60 },
      };
    }
    s.settings = { ...DEFAULT_SETTINGS, ...(s.settings || {}) };
    return s;
  }
  function save() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }

  // ---------- helpers ----------
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const person = id => state.people.find(p => p.id === id);
  const exercise = id => state.exercises.find(e => e.id === id);
  const initials = name => name.trim().slice(0, 2).toUpperCase();
  const pad = n => String(n).padStart(2, '0');
  function fmtDur(sec) { sec = Math.max(0, Math.round(sec)); return `${pad(Math.floor(sec / 60))}:${pad(sec % 60)}`; }
  function fmtDate(iso) {
    const d = new Date(iso);
    return d.toLocaleDateString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short' });
  }
  function todayLabel() {
    const d = new Date();
    return d.toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' });
  }
  function toast(msg) {
    const t = $('#toast'); t.textContent = msg; t.hidden = false;
    clearTimeout(t._t); t._t = setTimeout(() => (t.hidden = true), 2200);
  }
  function avatar(p, cls) { return `<span class="avatar ${cls || ''}" style="--c:${p.color}">${esc(initials(p.name))}</span>`; }

  // ---------- geschiedenis-analyse ----------
  function lastUsed(exId) {
    for (let i = state.history.length - 1; i >= 0; i--) {
      if (state.history[i].items.some(it => it.exId === exId)) return state.history[i].date;
    }
    return null;
  }
  // beste set (hoogste gewicht, daarna reps) van een persoon voor een oefening
  function bestSet(pid, exId, excludeSessionId) {
    let best = null;
    for (const h of state.history) {
      if (h.id === excludeSessionId) continue;
      for (const it of h.items) {
        if (it.exId !== exId) continue;
        for (const s of (it.logs[pid] || [])) {
          if (!s.w && !s.r) continue;
          if (!best || s.w > best.w || (s.w === best.w && s.r > best.r)) best = { w: s.w || 0, r: s.r || 0, date: h.date };
        }
      }
    }
    return best;
  }
  function lastSets(pid, exId) {
    for (let i = state.history.length - 1; i >= 0; i--) {
      const it = state.history[i].items.find(x => x.exId === exId);
      if (it && it.logs[pid] && it.logs[pid].some(s => s.w || s.r)) return it.logs[pid];
    }
    return null;
  }
  function personStats(pid) {
    const sessions = state.history.filter(h => h.people.includes(pid));
    let volume = 0, sets = 0;
    for (const h of sessions) for (const it of h.items) for (const s of (it.logs[pid] || [])) { if (s.w && s.r) { volume += s.w * s.r; sets++; } }
    // streak: aantal opeenvolgende weken met minstens 1 sessie
    const weeks = new Set(sessions.map(h => weekKey(new Date(h.date))));
    let streak = 0; const d = new Date();
    while (weeks.has(weekKey(d))) { streak++; d.setDate(d.getDate() - 7); }
    return { sessions: sessions.length, volume, sets, streak };
  }
  function weekKey(d) {
    const x = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const day = x.getUTCDay() || 7; x.setUTCDate(x.getUTCDate() + 4 - day);
    const y0 = new Date(Date.UTC(x.getUTCFullYear(), 0, 1));
    return `${x.getUTCFullYear()}-${Math.ceil((((x - y0) / 86400000) + 1) / 7)}`;
  }

  // ---------- schema generator ----------
  function generatePlan(groups, duration) {
    const st = state.settings;
    const n = Math.max(2, Math.floor((duration - st.warmupMinutes) / st.minutesPerExercise));
    const pools = {};
    for (const g of groups) {
      pools[g] = state.exercises.filter(e => e.group === g)
        .map(e => ({ e, last: lastUsed(e.id), rnd: Math.random() }))
        // minst recent gedaan eerst, compound lifts krijgen lichte voorkeur, daarna willekeur
        .sort((a, b) => (a.last || '') < (b.last || '') ? -1 : (a.last || '') > (b.last || '') ? 1 : (b.e.compound - a.e.compound) || (a.rnd - b.rnd))
        .map(x => x.e);
    }
    const chosen = [];
    let guard = 0;
    while (chosen.length < n && guard++ < 100) {
      let any = false;
      for (const g of groups) {
        if (chosen.length >= n) break;
        const next = pools[g].shift();
        if (next) { chosen.push(next); any = true; }
      }
      if (!any) break;
    }
    // groepsvolgorde blijft afgewisseld (compound lifts staan al vooraan binnen hun groep), cardio achteraan
    chosen.sort((a, b) => a.cardio - b.cardio);
    return chosen.map(e => ({
      id: uid(), exId: e.id, name: e.name, group: e.group, sets: e.sets, reps: e.reps, cardio: !!e.cardio,
      done: false, logs: {},
    }));
  }
  function swapExercise(item) {
    const s = state.session;
    const used = new Set(s.items.map(i => i.exId));
    const cands = state.exercises.filter(e => e.group === item.group && !used.has(e.id));
    if (!cands.length) { toast(`Geen andere oefening voor ${item.group} in de bibliotheek`); return; }
    cands.sort((a, b) => ((lastUsed(a.id) || '') < (lastUsed(b.id) || '') ? -1 : 1));
    const pick = cands[Math.floor(Math.random() * Math.min(3, cands.length))];
    Object.assign(item, { exId: pick.id, name: pick.name, sets: pick.sets, reps: pick.reps, cardio: !!pick.cardio, done: false, logs: {} });
    save(); render();
  }

  // ---------- rust-timer ----------
  function startRest(seconds) {
    stopRest(false);
    rest = { endsAt: Date.now() + seconds * 1000, total: seconds };
    renderSheet();
    rest.timer = setInterval(() => {
      renderSheet();
      if (Date.now() >= rest.endsAt) { restDone(); }
    }, 250);
  }
  function restDone() {
    clearInterval(rest.timer); rest.timer = null; rest.finished = true;
    beep(); if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
    renderSheet();
    setTimeout(() => { if (rest && rest.finished) stopRest(true); }, 4000);
  }
  function stopRest(rerender) {
    if (rest && rest.timer) clearInterval(rest.timer);
    rest = null;
    const sh = $('#sheet'); sh.hidden = true; sh.innerHTML = '';
    if (rerender) render();
  }
  function renderSheet() {
    const sh = $('#sheet');
    if (!rest) { sh.hidden = true; return; }
    const left = Math.max(0, (rest.endsAt - Date.now()) / 1000);
    sh.hidden = false;
    sh.innerHTML = `<div class="sheet-inner">
      <div><div class="t ${rest.finished ? 'done' : ''}">${rest.finished ? 'GO' : fmtDur(Math.ceil(left))}</div><div class="small" style="opacity:.7">${rest.finished ? 'Rust voorbij' : 'Rust'}</div></div>
      <div class="grow"></div>
      <button class="btn sm" data-act="rest-add">+30</button>
      <button class="btn sm" data-act="rest-stop">Stop</button>
    </div>`;
  }
  function beep() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination); o.frequency.value = 880; g.gain.value = 0.2;
      o.start(); o.stop(ctx.currentTime + 0.35);
    } catch (e) { /* geen audio, geen probleem */ }
  }

  // ---------- render ----------
  function render() {
    $$('.tab').forEach(t => t.classList.toggle('on', t.dataset.tab === ui.tab));
    const v = $('#view');
    const fn = { today: renderToday, progress: renderProgress, people: renderPeople, settings: renderSettings }[ui.tab];
    v.innerHTML = fn();
    renderTopbar();
    if (ui.tab === 'progress') drawChart();
    if (ui.tab === 'today' && state.session && !tickTimer) tickTimer = setInterval(renderTopbar, 1000);
    if (!state.session && tickTimer) { clearInterval(tickTimer); tickTimer = null; }
  }
  function renderTopbar() {
    const r = $('#topbar-right');
    const s = state.session;
    if (s) {
      r.classList.add('live');
      r.textContent = fmtDur((Date.now() - new Date(s.startedAt)) / 1000);
      const b = $('#session-clock'); if (b) b.textContent = r.textContent;
    } else { r.classList.remove('live'); r.textContent = ''; }
  }

  // ----- Vandaag -----
  function renderToday() {
    return state.session ? renderSession() : renderSetup();
  }
  function renderSetup() {
    const ls = state.lastSetup;
    const last = state.history[state.history.length - 1];
    return `
      <h1 class="hero-title"><span class="date">${esc(todayLabel())}</span>Wat gaan we doen?</h1>
      ${last ? `<p class="muted small" style="margin-top:8px">Vorige keer (${esc(fmtDate(last.date))}): ${esc(last.groups.join(' + '))}, ${last.duration} min.</p>` : ''}

      <div class="section">
        <div class="section-head"><h2>Wie is er?</h2></div>
        <div class="chips" id="setup-people">
          ${state.people.map(p => `<button class="chip person ${ls.people.includes(p.id) ? 'on' : ''}" data-act="toggle-person" data-id="${p.id}" style="--c:${p.color}"><span class="dot"></span>${esc(p.name)}</button>`).join('')}
        </div>
      </div>

      <div class="section">
        <div class="section-head"><h2>Spiergroepen</h2><span class="hint">tik om te kiezen</span></div>
        <div class="chips" id="setup-groups">
          ${GROUPS.map(g => `<button class="chip ${ls.groups.includes(g) ? 'on' : ''}" data-act="toggle-group" data-id="${g}">${g}</button>`).join('')}
        </div>
      </div>

      <div class="section">
        <div class="section-head"><h2>Hoelang?</h2></div>
        <div class="chips" id="setup-duration">
          ${DURATIONS.map(d => `<button class="chip ${ls.duration === d ? 'on' : ''}" data-act="set-duration" data-id="${d}">${d} min</button>`).join('')}
        </div>
      </div>

      <div class="section">
        <button class="btn primary big" data-act="start" ${ls.people.length && ls.groups.length ? '' : 'disabled'}>Maak het schema</button>
        <p class="muted small" style="margin-top:10px;text-align:center">Ongeveer ${Math.max(2, Math.floor((ls.duration - state.settings.warmupMinutes) / state.settings.minutesPerExercise))} oefeningen, afgewisseld per spiergroep. Oefeningen die jullie het langst niet gedaan hebben komen eerst.</p>
      </div>`;
  }
  function renderSession() {
    const s = state.session;
    const people = s.people.map(person).filter(Boolean);
    const done = s.items.filter(i => i.done).length;
    const elapsed = (Date.now() - new Date(s.startedAt)) / 1000;
    return `
      <div class="session-bar">
        <div><div class="big-time" id="session-clock">${fmtDur(elapsed)}</div><div class="lbl">van ${s.duration} min</div></div>
        <div><div style="font-family:var(--display);font-weight:700;font-size:20px">${esc(s.groups.join(' + '))}</div><div class="lbl">${done}/${s.items.length} oefeningen klaar</div></div>
        <div class="people">${people.map(p => avatar(p, 'xs')).join('')}</div>
      </div>
      <div class="progress" style="margin:-4px 0 0;background:var(--line)"><span style="width:${s.items.length ? (done / s.items.length) * 100 : 0}%"></span></div>

      <p class="muted small" style="margin:14px 0 10px">Warming-up ${state.settings.warmupMinutes} min eerst. Tik op een oefening om gewichten in te vullen, vinkje als iedereen klaar is.</p>

      <ol class="plan">
        ${s.items.map((it, idx) => renderPlanItem(it, idx, people)).join('')}
      </ol>

      <div class="btn-row" style="margin-top:6px">
        <button class="btn" data-act="add-exercise">+ Oefening</button>
        <button class="btn" data-act="rest" data-sec="${state.settings.restSeconds}">Rust ${state.settings.restSeconds}s</button>
      </div>
      <div class="section">
        <button class="btn ok big" data-act="finish">Training afronden</button>
        <button class="btn ghost" style="width:100%;margin-top:6px;color:var(--danger)" data-act="cancel">Training weggooien</button>
      </div>`;
  }
  function renderPlanItem(it, idx, people) {
    const open = isOpen(it, idx);
    const setsArr = Array.from({ length: it.sets }, (_, i) => i);
    return `<li class="plan-item ${it.done ? 'done' : ''}" data-item="${it.id}">
      <div class="plan-head" data-act="toggle-open" data-id="${it.id}">
        <span class="plan-no">${idx + 1}</span>
        <div class="grow">
          <div class="plan-name">${esc(it.name)}</div>
          <div class="plan-meta">${esc(it.group)} · ${it.sets} × ${esc(it.reps)}${it.cardio ? '' : ' · ' + state.settings.restSeconds + 's rust'}</div>
        </div>
        <button class="plan-check ${it.done ? 'on' : ''}" data-act="toggle-done" data-id="${it.id}" aria-label="Klaar">
          <svg viewBox="0 0 24 24" width="20" height="20"><path d="M5 12l5 5 9-10"/></svg>
        </button>
      </div>
      ${open ? `<div class="plan-body">
        ${it.cardio ? renderCardioLog(it, people) : renderStrengthLog(it, people, setsArr)}
        <div class="plan-actions">
          <button class="btn sm" data-act="rest" data-sec="${state.settings.restSeconds}">Rust starten</button>
          <button class="btn sm" data-act="copy-last" data-id="${it.id}">Vorige keer overnemen</button>
          <button class="btn sm ghost swap" data-act="swap" data-id="${it.id}">Wissel oefening</button>
          <button class="btn sm ghost" style="color:var(--danger)" data-act="remove-item" data-id="${it.id}">Verwijder</button>
        </div>
      </div>` : ''}
    </li>`;
  }
  function firstOpenIndex() { return state.session.items.findIndex(i => !i.done); }
  function isOpen(it, idx) { return it.open === undefined ? (!it.done && idx === firstOpenIndex()) : it.open; }
  function renderStrengthLog(it, people, setsArr) {
    return `<table class="log-table">
      <thead><tr><th></th>${people.map(p => `<th><span class="row" style="gap:6px">${avatar(p, 'xs')}${esc(p.name)}</span></th>`).join('')}</tr></thead>
      <tbody>
        ${setsArr.map(i => `<tr>
          <td class="set-no">${i + 1}</td>
          ${people.map(p => {
            const s = (it.logs[p.id] || [])[i] || {};
            const best = bestSet(p.id, it.exId, null);
            const isPr = s.w && best && s.w > best.w;
            return `<td><div class="log-cell">
              <input class="num ${isPr ? 'pr' : ''}" type="number" inputmode="decimal" step="0.5" placeholder="kg" value="${s.w != null ? s.w : ''}" data-act="log" data-id="${it.id}" data-pid="${p.id}" data-set="${i}" data-k="w">
              <span class="x">×</span>
              <input class="num" type="number" inputmode="numeric" placeholder="reps" value="${s.r != null ? s.r : ''}" data-act="log" data-id="${it.id}" data-pid="${p.id}" data-set="${i}" data-k="r">
            </div></td>`;
          }).join('')}
        </tr>`).join('')}
      </tbody>
    </table>
    <div class="row" style="margin-top:8px;gap:12px;flex-wrap:wrap">
      ${people.map(p => { const b = bestSet(p.id, it.exId, null); return b ? `<span class="tag" style="border-color:${p.color};color:${p.color}">${esc(p.name)} PR ${b.w} kg × ${b.r}</span>` : ''; }).join('')}
      <button class="btn sm ghost" data-act="add-set" data-id="${it.id}">+ set</button>
    </div>`;
  }
  function renderCardioLog(it, people) {
    return `<table class="log-table">
      <thead><tr>${people.map(p => `<th><span class="row" style="gap:6px">${avatar(p, 'xs')}${esc(p.name)}</span></th>`).join('')}</tr></thead>
      <tbody><tr>${people.map(p => {
        const s = (it.logs[p.id] || [])[0] || {};
        return `<td><div class="log-cell">
          <input class="num" type="number" inputmode="numeric" placeholder="min" value="${s.r != null ? s.r : ''}" data-act="log" data-id="${it.id}" data-pid="${p.id}" data-set="0" data-k="r">
          <span class="x">min</span>
          <input class="num" type="number" inputmode="decimal" step="0.1" placeholder="km" value="${s.w != null ? s.w : ''}" data-act="log" data-id="${it.id}" data-pid="${p.id}" data-set="0" data-k="w">
          <span class="x">km</span>
        </div></td>`;
      }).join('')}</tr></tbody>
    </table>`;
  }

  // ----- Progressie -----
  function renderProgress() {
    if (!ui.progressPerson) ui.progressPerson = state.people[0].id;
    const p = person(ui.progressPerson);
    const st = personStats(p.id);
    const exIds = new Set();
    for (const h of state.history) if (h.people.includes(p.id)) for (const it of h.items) if ((it.logs[p.id] || []).some(s => s.w)) exIds.add(it.exId);
    const exs = Array.from(exIds).map(id => ({ id, name: (exercise(id) || {}).name || historyName(id), best: bestSet(p.id, id, null) })).filter(x => x.best).sort((a, b) => b.best.w - a.best.w);
    if (!ui.progressExercise || !exIds.has(ui.progressExercise)) ui.progressExercise = exs[0] ? exs[0].id : null;
    const hist = state.history.filter(h => h.people.includes(p.id)).slice().reverse();

    return `
      <h1>Progressie</h1>
      <div class="chips" style="margin-top:12px">
        ${state.people.map(x => `<button class="chip person ${x.id === p.id ? 'on' : ''}" data-act="progress-person" data-id="${x.id}" style="--c:${x.color}"><span class="dot"></span>${esc(x.name)}</button>`).join('')}
      </div>
      <div class="stat-grid" style="margin-top:14px">
        <div class="stat"><div class="v">${st.sessions}</div><div class="k">trainingen</div></div>
        <div class="stat"><div class="v">${st.streak}</div><div class="k">weken op rij</div></div>
        <div class="stat"><div class="v">${st.volume >= 1000 ? (st.volume / 1000).toFixed(1) + 'k' : st.volume}</div><div class="k">kg getild</div></div>
      </div>

      ${exs.length ? `
      <div class="section">
        <div class="section-head"><h2>Verloop</h2></div>
        <select class="input" data-act="progress-exercise">
          ${exs.map(x => `<option value="${x.id}" ${x.id === ui.progressExercise ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}
        </select>
        <div class="card" style="margin-top:10px;padding:10px 6px 4px"><canvas class="chart" id="chart"></canvas></div>
        <p class="muted small" style="margin-top:6px">Hoogste gewicht per training.</p>
      </div>
      <div class="section">
        <div class="section-head"><h2>Persoonlijke records</h2></div>
        <div class="card flush"><ul class="pr-list">
          ${exs.map(x => `<li><span>${esc(x.name)}</span><span class="muted small">${esc(fmtDate(x.best.date))}</span><span class="w">${x.best.w} <small>kg × ${x.best.r}</small></span></li>`).join('')}
        </ul></div>
      </div>` : `<div class="empty" style="margin-top:20px"><h3>Nog geen cijfers voor ${esc(p.name)}</h3>Start een training via Vandaag en vul gewichten in. Daarna verschijnen hier records en grafieken.</div>`}

      <div class="section">
        <div class="section-head"><h2>Trainingen</h2><span class="hint">${hist.length}</span></div>
        ${hist.length ? `<div class="card flush">${hist.map(h => renderHistoryItem(h, p.id)).join('')}</div>` : ''}
      </div>`;
  }
  function historyName(exId) {
    for (const h of state.history) { const it = h.items.find(i => i.exId === exId); if (it) return it.name; }
    return '?';
  }
  function renderHistoryItem(h, pid) {
    const mins = Math.round((new Date(h.endedAt) - new Date(h.date)) / 60000) || h.duration;
    return `<div class="history-item">
      <div class="row between">
        <div><div class="t">${esc(h.groups.join(' + '))}</div><div class="muted small">${esc(fmtDate(h.date))} · ${mins} min · met ${esc(h.people.map(id => (person(id) || {}).name || id).join(', '))}</div></div>
        <button class="btn sm ghost" style="color:var(--danger)" data-act="delete-history" data-id="${h.id}">✕</button>
      </div>
      <details><summary>${h.items.length} oefeningen</summary>
        ${h.items.map(it => { const logs = (it.logs[pid] || []).filter(s => s.w || s.r); return `<div class="ex"><b>${esc(it.name)}</b><span class="muted">${logs.length ? logs.map(s => it.cardio ? `${s.r || 0} min${s.w ? ' / ' + s.w + ' km' : ''}` : `${s.w || 0}×${s.r || 0}`).join(', ') : 'niet ingevuld'}</span></div>`; }).join('')}
        ${h.notes ? `<p class="small" style="margin-top:6px">${esc(h.notes)}</p>` : ''}
      </details>
    </div>`;
  }
  function drawChart() {
    const c = $('#chart'); if (!c || !ui.progressExercise) return;
    const pid = ui.progressPerson, exId = ui.progressExercise;
    const pts = [];
    for (const h of state.history) {
      if (!h.people.includes(pid)) continue;
      const it = h.items.find(i => i.exId === exId); if (!it) continue;
      const w = Math.max(0, ...(it.logs[pid] || []).map(s => s.w || 0));
      if (w > 0) pts.push({ d: new Date(h.date), w });
    }
    const dpr = window.devicePixelRatio || 1;
    const W = c.clientWidth, H = c.clientHeight;
    c.width = W * dpr; c.height = H * dpr;
    const ctx = c.getContext('2d'); ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, W, H);
    if (!pts.length) return;
    const pad = { l: 36, r: 12, t: 14, b: 26 };
    const min = Math.min(...pts.map(p => p.w)) * 0.9, max = Math.max(...pts.map(p => p.w)) * 1.08 || 1;
    const x = i => pts.length === 1 ? W / 2 : pad.l + (i / (pts.length - 1)) * (W - pad.l - pad.r);
    const y = w => pad.t + (1 - (w - min) / (max - min || 1)) * (H - pad.t - pad.b);
    const color = person(pid).color;
    ctx.strokeStyle = '#D9DEE8'; ctx.lineWidth = 1;
    for (let g = 0; g <= 3; g++) { const yy = pad.t + (g / 3) * (H - pad.t - pad.b); ctx.beginPath(); ctx.moveTo(pad.l, yy); ctx.lineTo(W - pad.r, yy); ctx.stroke();
      ctx.fillStyle = '#6B7385'; ctx.font = '12px Barlow, sans-serif'; ctx.textAlign = 'right'; ctx.fillText(Math.round(max - (g / 3) * (max - min)), pad.l - 6, yy + 4); }
    ctx.strokeStyle = color; ctx.lineWidth = 3; ctx.lineJoin = 'round'; ctx.beginPath();
    pts.forEach((p, i) => i ? ctx.lineTo(x(i), y(p.w)) : ctx.moveTo(x(i), y(p.w))); ctx.stroke();
    pts.forEach((p, i) => { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x(i), y(p.w), 5, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); });
    ctx.fillStyle = '#14192B'; ctx.font = 'bold 12px Barlow, sans-serif'; ctx.textAlign = 'center';
    pts.forEach((p, i) => ctx.fillText(p.w, x(i), y(p.w) - 10));
    ctx.fillStyle = '#6B7385'; ctx.font = '11px Barlow, sans-serif';
    const step = Math.ceil(pts.length / 6);
    pts.forEach((p, i) => { if (i % step === 0 || i === pts.length - 1) ctx.fillText(p.d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' }), x(i), H - 8); });
  }

  // ----- Wij -----
  function renderPeople() {
    return `
      <h1>Wij</h1>
      <p class="muted" style="margin-top:6px">Drie man, één schema. Tik op een profiel om het aan te passen.</p>
      <div class="stack" style="margin-top:16px">
        ${state.people.map(p => { const st = personStats(p.id); return `
          <div class="card person-card" style="--c:${p.color}" data-act="edit-person" data-id="${p.id}">
            ${avatar(p, 'lg')}
            <div class="grow">
              <h3>${esc(p.name)}</h3>
              <p class="small" style="margin-top:4px">${esc(p.bio)}</p>
              <p class="goal small">Doel: ${esc(p.goal)}</p>
              <p class="muted small" style="margin-top:6px">${st.sessions} trainingen · ${st.streak} weken op rij</p>
            </div>
          </div>`; }).join('')}
      </div>
      <button class="btn" style="width:100%;margin-top:14px" data-act="add-person">+ Iemand toevoegen</button>`;
  }

  // ----- Instellingen -----
  function renderSettings() {
    const st = state.settings;
    const byGroup = {};
    for (const e of state.exercises) (byGroup[e.group] = byGroup[e.group] || []).push(e);
    return `
      <h1>Instellingen</h1>

      <div class="section">
        <div class="section-head"><h2>Schema</h2></div>
        <div class="card form-grid">
          <div class="field"><label>Rust tussen sets (sec)</label><input class="input" type="number" inputmode="numeric" value="${st.restSeconds}" data-act="setting" data-k="restSeconds"></div>
          <div class="field"><label>Minuten per oefening</label><input class="input" type="number" inputmode="numeric" value="${st.minutesPerExercise}" data-act="setting" data-k="minutesPerExercise"></div>
          <div class="field"><label>Warming-up (min)</label><input class="input" type="number" inputmode="numeric" value="${st.warmupMinutes}" data-act="setting" data-k="warmupMinutes"></div>
        </div>
        <p class="muted small" style="margin-top:8px">Aantal oefeningen = (duur − warming-up) ÷ minuten per oefening.</p>
      </div>

      <div class="section">
        <div class="section-head"><h2>Oefeningen</h2><button class="btn sm primary" data-act="add-ex">+ Nieuw</button></div>
        ${GROUPS.map(g => byGroup[g] ? `
          <div class="group-title">${g} <span class="count">${byGroup[g].length}</span></div>
          <div class="card flush"><ul class="ex-list">
            ${byGroup[g].map(e => `<li>
              <div class="grow"><div class="name">${esc(e.name)}</div><div class="meta">${e.sets} × ${esc(e.reps)}${e.compound ? ' · compound' : ''}</div></div>
              <button class="btn sm" data-act="edit-ex" data-id="${e.id}">Bewerk</button>
            </li>`).join('')}
          </ul></div>` : '').join('')}
      </div>

      <div class="section">
        <div class="section-head"><h2>Data</h2></div>
        <p class="muted small" style="margin-bottom:10px">Alles staat op dit toestel. Exporteer regelmatig en deel het bestand met elkaar, of importeer een export van een ander om samen te voegen.</p>
        <div class="btn-row">
          <button class="btn" data-act="export">Exporteren</button>
          <button class="btn" data-act="import">Importeren</button>
        </div>
        <input type="file" id="import-file" accept="application/json" hidden>
        <button class="btn danger" style="width:100%;margin-top:10px" data-act="reset">Alles wissen</button>
      </div>
      <p class="muted small" style="margin-top:24px;text-align:center">WOWF · versie 1.0</p>`;
  }

  // ---------- modals ----------
  function openModal(html) {
    const back = document.createElement('div'); back.className = 'modal-back'; back.id = 'modal';
    back.innerHTML = `<div class="modal">${html}</div>`;
    document.body.appendChild(back);
    back.addEventListener('click', e => { if (e.target === back) closeModal(); });
  }
  function closeModal() { const m = $('#modal'); if (m) m.remove(); }

  function exerciseModal(ex) {
    const e = ex || { name: '', group: 'Borst', sets: 3, reps: '8-12', compound: false, cardio: false };
    openModal(`
      <h2>${ex ? 'Oefening bewerken' : 'Nieuwe oefening'}</h2>
      <div class="form-grid">
        <div class="field full"><label>Naam</label><input class="input" id="ex-name" value="${esc(e.name)}" placeholder="Bijv. Incline bench press"></div>
        <div class="field full"><label>Spiergroep</label><select class="input" id="ex-group">${GROUPS.map(g => `<option ${g === e.group ? 'selected' : ''}>${g}</option>`).join('')}</select></div>
        <div class="field"><label>Sets</label><input class="input" id="ex-sets" type="number" inputmode="numeric" value="${e.sets}"></div>
        <div class="field"><label>Reps</label><input class="input" id="ex-reps" value="${esc(e.reps)}" placeholder="8-12"></div>
        <label class="row full"><input type="checkbox" id="ex-compound" ${e.compound ? 'checked' : ''}> Compound lift (komt vooraan in het schema)</label>
        <label class="row full"><input type="checkbox" id="ex-cardio" ${e.cardio ? 'checked' : ''}> Cardio (minuten/km in plaats van kg/reps)</label>
      </div>
      <div class="btn-row" style="margin-top:14px">
        ${ex ? `<button class="btn danger" data-act="delete-ex" data-id="${ex.id}">Verwijderen</button>` : ''}
        <button class="btn" data-act="close-modal">Annuleren</button>
        <button class="btn primary" data-act="save-ex" data-id="${ex ? ex.id : ''}">Opslaan</button>
      </div>`);
    $('#ex-name').focus();
  }
  function personModal(p) {
    const x = p || { name: '', color: '#7B4DE3', bio: '', goal: '' };
    openModal(`
      <h2>${p ? 'Profiel bewerken' : 'Nieuw profiel'}</h2>
      <div class="form-grid">
        <div class="field"><label>Naam</label><input class="input" id="p-name" value="${esc(x.name)}"></div>
        <div class="field"><label>Kleur</label><input class="input" id="p-color" type="color" value="${x.color}" style="padding:4px;height:44px"></div>
        <div class="field full"><label>Over</label><textarea class="input" id="p-bio" placeholder="Wie ben je, hoe train je, wat vind je leuk?">${esc(x.bio)}</textarea></div>
        <div class="field full"><label>Doel</label><input class="input" id="p-goal" value="${esc(x.goal)}" placeholder="Bijv. 100 kg bench voor de kerst"></div>
      </div>
      <div class="btn-row" style="margin-top:14px">
        ${p && state.people.length > 1 ? `<button class="btn danger" data-act="delete-person" data-id="${p.id}">Verwijderen</button>` : ''}
        <button class="btn" data-act="close-modal">Annuleren</button>
        <button class="btn primary" data-act="save-person" data-id="${p ? p.id : ''}">Opslaan</button>
      </div>`);
  }
  function addExerciseModal() {
    const s = state.session;
    const used = new Set(s.items.map(i => i.exId));
    openModal(`
      <h2>Oefening toevoegen</h2>
      <div class="chips" style="margin-bottom:10px" id="add-ex-groups">
        ${GROUPS.map(g => `<button class="chip ${s.groups.includes(g) ? 'on' : ''}" data-act="add-ex-filter" data-id="${g}">${g}</button>`).join('')}
      </div>
      <div class="card flush"><ul class="ex-list" id="add-ex-list">
        ${state.exercises.filter(e => !used.has(e.id)).map(e => `<li data-group="${e.group}" ${s.groups.includes(e.group) ? '' : 'hidden'}>
          <div class="grow"><div class="name">${esc(e.name)}</div><div class="meta">${e.group} · ${e.sets} × ${esc(e.reps)}</div></div>
          <button class="btn sm primary" data-act="add-ex-pick" data-id="${e.id}">Toevoegen</button>
        </li>`).join('')}
      </ul></div>
      <button class="btn" style="width:100%;margin-top:12px" data-act="close-modal">Sluiten</button>`);
  }
  function finishModal() {
    const s = state.session;
    const empty = s.items.filter(i => !Object.values(i.logs).some(arr => arr.some(x => x.w || x.r))).length;
    openModal(`
      <h2>Training afronden</h2>
      <p class="small muted">${fmtDur((Date.now() - new Date(s.startedAt)) / 1000)} getraind · ${s.items.filter(i => i.done).length}/${s.items.length} oefeningen afgevinkt${empty ? ` · ${empty} zonder gewichten` : ''}</p>
      <div class="field" style="margin-top:12px"><label>Notitie (optioneel)</label><textarea class="input" id="finish-notes" placeholder="Hoe ging het? Iets om volgende keer te onthouden?"></textarea></div>
      <div class="btn-row" style="margin-top:14px">
        <button class="btn" data-act="close-modal">Terug</button>
        <button class="btn ok" data-act="finish-confirm">Opslaan</button>
      </div>`);
  }

  // ---------- export / import ----------
  function exportData() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `wowf-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click(); URL.revokeObjectURL(a.href);
  }
  function importData(file) {
    const rd = new FileReader();
    rd.onload = () => {
      try {
        const inc = JSON.parse(rd.result);
        if (!inc.history || !inc.exercises) throw new Error('bestand herkend, maar geen WOWF-export');
        // samenvoegen: personen op id, oefeningen op naam, geschiedenis op id
        for (const p of inc.people || []) if (!person(p.id)) state.people.push(p);
        const names = new Set(state.exercises.map(e => e.name.toLowerCase()));
        for (const e of inc.exercises) if (!names.has(e.name.toLowerCase())) { state.exercises.push(e); names.add(e.name.toLowerCase()); }
        const ids = new Set(state.history.map(h => h.id));
        let added = 0;
        for (const h of inc.history) if (!ids.has(h.id)) { state.history.push(h); added++; }
        state.history.sort((a, b) => a.date < b.date ? -1 : 1);
        save(); render(); toast(`Geïmporteerd: ${added} trainingen samengevoegd`);
      } catch (err) { toast('Importeren mislukt: ' + err.message); }
    };
    rd.readAsText(file);
  }

  // ---------- events ----------
  document.addEventListener('click', e => {
    const el = e.target.closest('[data-act]'); if (!el) return;
    const act = el.dataset.act, id = el.dataset.id;
    const s = state.session;
    const item = s && s.items.find(i => i.id === id);
    switch (act) {
      case 'toggle-person': { const a = state.lastSetup.people; const i = a.indexOf(id); i >= 0 ? a.splice(i, 1) : a.push(id); save(); render(); break; }
      case 'toggle-group': { const a = state.lastSetup.groups; const i = a.indexOf(id); i >= 0 ? a.splice(i, 1) : a.push(id); save(); render(); break; }
      case 'set-duration': state.lastSetup.duration = Number(id); save(); render(); break;
      case 'start': {
        const ls = state.lastSetup;
        const items = generatePlan(ls.groups, ls.duration);
        if (!items.length) { toast('Geen oefeningen voor deze spiergroepen. Voeg ze toe bij Instellingen.'); break; }
        state.session = { id: uid(), startedAt: new Date().toISOString(), people: ls.people.slice(), groups: ls.groups.slice(), duration: ls.duration, items };
        save(); render(); window.scrollTo(0, 0); break;
      }
      case 'toggle-open': { const was = isOpen(item, s.items.indexOf(item)); s.items.forEach((i, idx) => { i.open = isOpen(i, idx) && i.id !== id ? false : i.open; }); item.open = !was; save(); render(); break; }
      case 'toggle-done': item.done = !item.done; item.open = undefined; save(); render(); if (item.done) toast(`${item.name} klaar`); break;
      case 'swap': swapExercise(item); break;
      case 'remove-item': s.items = s.items.filter(i => i.id !== id); save(); render(); break;
      case 'add-set': item.sets++; save(); render(); break;
      case 'copy-last': {
        let n = 0;
        for (const pid of s.people) { const ls = lastSets(pid, item.exId); if (ls) { item.logs[pid] = ls.map(x => ({ ...x })); n++; } }
        save(); render(); toast(n ? 'Vorige gewichten ingevuld' : 'Nog geen eerdere gegevens voor deze oefening'); break;
      }
      case 'rest': startRest(Number(el.dataset.sec) || state.settings.restSeconds); break;
      case 'rest-add': if (rest) { rest.endsAt += 30000; rest.finished = false; if (!rest.timer) rest.timer = setInterval(() => { renderSheet(); if (Date.now() >= rest.endsAt) restDone(); }, 250); renderSheet(); } break;
      case 'rest-stop': stopRest(false); break;
      case 'add-exercise': addExerciseModal(); break;
      case 'add-ex-filter': { const chip = el; chip.classList.toggle('on'); const on = $$('#add-ex-groups .chip.on').map(c => c.dataset.id); $$('#add-ex-list li').forEach(li => li.hidden = !on.includes(li.dataset.group)); break; }
      case 'add-ex-pick': { const ex = exercise(id); s.items.push({ id: uid(), exId: ex.id, name: ex.name, group: ex.group, sets: ex.sets, reps: ex.reps, cardio: !!ex.cardio, done: false, logs: {} }); save(); closeModal(); render(); break; }
      case 'finish': finishModal(); break;
      case 'finish-confirm': {
        const notes = ($('#finish-notes') || {}).value || '';
        const h = { id: s.id, date: s.startedAt, endedAt: new Date().toISOString(), people: s.people, groups: s.groups, duration: s.duration, notes,
          items: s.items.map(i => ({ exId: i.exId, name: i.name, group: i.group, cardio: i.cardio, sets: i.sets, reps: i.reps, logs: i.logs })) };
        const prs = [];
        for (const it of h.items) for (const pid of h.people) { const b = bestSet(pid, it.exId, null); const top = Math.max(0, ...(it.logs[pid] || []).map(x => x.w || 0)); if (top && (!b || top > b.w)) prs.push(`${(person(pid) || {}).name}: ${it.name} ${top} kg`); }
        state.history.push(h); state.session = null; save(); closeModal(); stopRest(false); ui.tab = 'progress'; render();
        toast(prs.length ? `Opgeslagen. Nieuwe PR's: ${prs.length}` : 'Training opgeslagen');
        break;
      }
      case 'cancel': if (confirm('Training weggooien? Ingevulde gewichten gaan verloren.')) { state.session = null; save(); stopRest(false); render(); } break;
      case 'progress-person': ui.progressPerson = id; ui.progressExercise = null; render(); break;
      case 'delete-history': if (confirm('Deze training verwijderen?')) { state.history = state.history.filter(h => h.id !== id); save(); render(); } break;
      case 'edit-person': personModal(person(id)); break;
      case 'add-person': personModal(null); break;
      case 'save-person': {
        const name = $('#p-name').value.trim(); if (!name) { toast('Naam is verplicht'); break; }
        const data = { name, color: $('#p-color').value, bio: $('#p-bio').value.trim(), goal: $('#p-goal').value.trim() };
        if (id) Object.assign(person(id), data); else { const nid = name.toLowerCase().replace(/[^a-z0-9]/g, '') + '-' + uid().slice(0, 4); state.people.push({ id: nid, ...data }); state.lastSetup.people.push(nid); }
        save(); closeModal(); render(); break;
      }
      case 'delete-person': if (confirm('Profiel verwijderen? De trainingsgeschiedenis blijft bewaard.')) { state.people = state.people.filter(p => p.id !== id); state.lastSetup.people = state.lastSetup.people.filter(x => x !== id); save(); closeModal(); render(); } break;
      case 'add-ex': exerciseModal(null); break;
      case 'edit-ex': exerciseModal(exercise(id)); break;
      case 'save-ex': {
        const name = $('#ex-name').value.trim(); if (!name) { toast('Naam is verplicht'); break; }
        const data = { name, group: $('#ex-group').value, sets: Math.max(1, Number($('#ex-sets').value) || 3), reps: $('#ex-reps').value.trim() || '8-12', compound: $('#ex-compound').checked, cardio: $('#ex-cardio').checked };
        if (id) Object.assign(exercise(id), data); else state.exercises.push({ id: uid(), ...data });
        save(); closeModal(); render(); break;
      }
      case 'delete-ex': if (confirm('Oefening uit de bibliotheek verwijderen?')) { state.exercises = state.exercises.filter(x => x.id !== id); save(); closeModal(); render(); } break;
      case 'close-modal': closeModal(); break;
      case 'export': exportData(); break;
      case 'import': $('#import-file').click(); break;
      case 'reset': if (confirm('Alles wissen, ook de geschiedenis? Exporteer eerst als je twijfelt.')) { localStorage.removeItem(STORAGE_KEY); state = load(); render(); } break;
    }
  });

  document.addEventListener('input', e => {
    const el = e.target; if (!el.dataset) return;
    if (el.dataset.act === 'log') {
      const it = state.session.items.find(i => i.id === el.dataset.id);
      const arr = it.logs[el.dataset.pid] = it.logs[el.dataset.pid] || [];
      const i = Number(el.dataset.set); arr[i] = arr[i] || {};
      const v = el.value === '' ? null : Number(el.value);
      arr[i][el.dataset.k] = v;
      if (el.dataset.k === 'w') { const b = bestSet(el.dataset.pid, it.exId, null); el.classList.toggle('pr', !!(v && b && v > b.w)); }
      save();
    }
    if (el.dataset.act === 'setting') { state.settings[el.dataset.k] = Math.max(0, Number(el.value) || 0); save(); }
  });
  document.addEventListener('change', e => {
    const el = e.target;
    if (el.dataset && el.dataset.act === 'progress-exercise') { ui.progressExercise = el.value; drawChart(); }
    if (el.id === 'import-file' && el.files[0]) { importData(el.files[0]); el.value = ''; }
  });
  $('#tabbar').addEventListener('click', e => {
    const t = e.target.closest('.tab'); if (!t) return;
    ui.tab = t.dataset.tab; render(); window.scrollTo(0, 0);
  });
  window.addEventListener('resize', () => { if (ui.tab === 'progress') drawChart(); });

  // service worker voor offline + beginscherm
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }

  render();
})();
