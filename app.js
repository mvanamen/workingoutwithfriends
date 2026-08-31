/* Working Out With Friends — vanilla JS, geen build stap nodig.
   Data staat in localStorage op het toestel en wordt, als het groepswachtwoord is
   ingevuld, gedeeld via Supabase (zie supabase.sql). Export/import via Instellingen. */
(function () {
  'use strict';

  const STORAGE_KEY = 'wowf.v1';
  const PASS_KEY = 'wowf.pass';        // het groepswachtwoord, alleen op dit toestel
  const groepswachtwoord = () => { try { return localStorage.getItem(PASS_KEY) || ''; } catch (e) { return ''; } };
  const GROUPS = ['Borst', 'Rug', 'Schouders', 'Biceps', 'Triceps', 'Benen', 'Core', 'Cardio'];
  const DURATIONS = [30, 45, 60, 75, 90];

  // Push / pull / legs is de indeling waarin we trainen: je kiest er één per keer.
  // De spiergroep blijft eronder bestaan — daarmee wisselt het schema af binnen de dag
  // en blijft de progressie per spiergroep leesbaar.
  const DAYS = [
    { id: 'push', name: 'Push', groups: ['Borst', 'Schouders', 'Triceps'], hint: 'borst · schouders · triceps' },
    { id: 'pull', name: 'Pull', groups: ['Rug', 'Biceps'],                 hint: 'rug · biceps' },
    { id: 'legs', name: 'Legs', groups: ['Benen'],                         hint: 'benen' },
  ];
  // Core en cardio horen bij geen van drieën; die zet je er los bij aan.
  const EXTRAS = [
    { id: 'core',   name: '+ core',   short: 'core',   group: 'Core' },
    { id: 'cardio', name: '+ cardio', short: 'cardio', group: 'Cardio' },
  ];
  const DAY_OF = {};
  for (const d of DAYS) for (const g of d.groups) DAY_OF[g] = d.id;

  const dayById   = id => DAYS.find(d => d.id === id) || null;
  const dayName   = id => (dayById(id) || {}).name || id;
  // Label voor een sessie of een regel uit de geschiedenis. Trainingen van vóór de
  // PPL-indeling hebben alleen `groups`; die tonen we gewoon zoals ze waren.
  function dayLabel(x) {
    if (!x) return '';
    if (!x.day) return (x.groups || []).join(' + ');
    const ex = (x.extras || []).map(id => (EXTRAS.find(e => e.id === id) || {}).short).filter(Boolean);
    return [dayName(x.day)].concat(ex).join(' + ');
  }
  // Volgende dag in de rotatie, afgeleid van de laatste training die een dag had.
  // Null zolang er nog niets getraind is — dan valt er niets voor te stellen.
  function nextDay() {
    for (let i = state.history.length - 1; i >= 0; i--) {
      const idx = DAYS.findIndex(d => d.id === state.history[i].day);
      if (idx >= 0) return DAYS[(idx + 1) % DAYS.length].id;
    }
    return null;
  }

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
  let ui = { tab: 'today', progressPerson: null, progressExercise: null, editingEx: null, editingPerson: null, quick: false,
             busy: null, chat: [], chatBusy: false };
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
        lastSetup: { people: DEFAULT_PEOPLE.map(p => p.id), day: 'push', extras: [], duration: 60 },
      };
    }
    s.settings = { ...DEFAULT_SETTINGS, ...(s.settings || {}) };
    s.lastSetup = migrateSetup(s.lastSetup);
    s.tomb = s.tomb || {};       // verwijderde ids, zodat wissen niet terugkomt via sync
    s.updatedAt = s.updatedAt || 0;
    return s;
  }
  // Van de oude spiergroep-keuze naar push/pull/legs: de dag waar de meeste gekozen
  // groepen onder vallen wint, core en cardio worden extra's. Draait één keer per toestel.
  function migrateSetup(ls) {
    const out = { people: [], duration: 60, extras: [], ...(ls || {}) };
    if (!out.day) {
      const old = Array.isArray(ls && ls.groups) ? ls.groups : [];
      const score = {};
      for (const g of old) if (DAY_OF[g]) score[DAY_OF[g]] = (score[DAY_OF[g]] || 0) + 1;
      out.day = DAYS.map(d => d.id).sort((a, b) => (score[b] || 0) - (score[a] || 0))[0];
      if (!(score[out.day] > 0)) out.day = 'push';
      out.extras = EXTRAS.filter(x => old.includes(x.group)).map(x => x.id);
    }
    if (!Array.isArray(out.extras)) out.extras = [];
    delete out.groups;
    return out;
  }

  function saveLocal() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) { /* vol of privémodus */ }
  }
  // urgent = structurele wijziging (training gestart, oefening afgevinkt, afgerond):
  // die gaat meteen de deur uit in plaats van na de debounce.
  function save(urgent) {
    state.updatedAt = Date.now();
    if (state.session) state.session.updatedAt = state.updatedAt;
    saveLocal();
    sync.queuePush(urgent);
  }
  // Een bewerkt object krijgt een tijdstempel; daarmee bepaalt de merge wie wint.
  function touch(o) { if (o) o.updatedAt = Date.now(); return o; }
  function tombstone(key) { (state.tomb = state.tomb || {})[key] = Date.now(); }

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
  // Minst recent gedaan eerst, compound lifts krijgen lichte voorkeur, daarna willekeur.
  function poolFor(group) {
    return state.exercises.filter(e => e.group === group)
      .map(e => ({ e, last: lastUsed(e.id), rnd: Math.random() }))
      .sort((a, b) => (a.last || '') < (b.last || '') ? -1 : (a.last || '') > (b.last || '') ? 1 : (b.e.compound - a.e.compound) || (a.rnd - b.rnd))
      .map(x => x.e);
  }
  function generatePlan(dayId, extras, duration) {
    const st = state.settings;
    const day = dayById(dayId) || DAYS[0];
    const n = Math.max(2, Math.floor((duration - st.warmupMinutes) / st.minutesPerExercise));

    // Elke gekozen extra krijgt één vaste plek; de rest van de tijd is voor de dag zelf.
    const tail = [];
    for (const x of EXTRAS) {
      if (!(extras || []).includes(x.id)) continue;
      const first = poolFor(x.group)[0];
      if (first) tail.push(first);
    }
    const room = Math.max(2, n - tail.length);

    const pools = {};
    for (const g of day.groups) pools[g] = poolFor(g);
    const chosen = [];
    let guard = 0;
    while (chosen.length < room && guard++ < 100) {
      let any = false;
      for (const g of day.groups) {
        if (chosen.length >= room) break;
        const next = pools[g].shift();
        if (next) { chosen.push(next); any = true; }
      }
      if (!any) break;
    }
    // binnen de dag blijft de spiergroep afgewisseld, core en cardio sluiten af
    const all = chosen.concat(tail);
    all.sort((a, b) => a.cardio - b.cardio);
    return all.map(e => ({
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
    save(true); render();
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
    const fn = { today: renderToday, progress: renderProgress, coach: renderCoach, people: renderPeople, settings: renderSettings }[ui.tab];
    v.innerHTML = fn();
    renderTopbar();
    if (ui.tab === 'progress') drawChart();
    if (ui.tab === 'today' && state.session && !tickTimer) tickTimer = setInterval(renderTopbar, 1000);
    if (!state.session && tickTimer) { clearInterval(tickTimer); tickTimer = null; }
  }
  function renderTopbar() {
    const r = $('#topbar-clock');
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
    const suggest = nextDay();
    return `
      <h1 class="hero-title"><span class="date">${esc(todayLabel())}</span>Wat gaan we doen?</h1>
      ${last ? `<p class="muted small" style="margin-top:8px">Vorige keer (${esc(fmtDate(last.date))}): ${esc(dayLabel(last))}, ${last.duration} min.</p>` : ''}

      <div class="section">
        <div class="section-head"><h2>Wie is er?</h2></div>
        <div class="chips" id="setup-people">
          ${state.people.map(p => `<button class="chip person ${ls.people.includes(p.id) ? 'on' : ''}" data-act="toggle-person" data-id="${p.id}" style="--c:${p.color}"><span class="dot"></span>${esc(p.name)}</button>`).join('')}
        </div>
      </div>

      <div class="section">
        <div class="section-head"><h2>Welke dag?</h2><span class="hint">push · pull · legs</span></div>
        <div class="chips" id="setup-day">
          ${DAYS.map(d => `<button class="chip day ${ls.day === d.id ? 'on' : ''}" data-act="set-day" data-id="${d.id}">
            <span class="day-name">${d.name}</span><span class="day-hint">${esc(d.hint)}</span>
          </button>`).join('')}
        </div>
        ${suggest && suggest !== ls.day ? `<p class="muted small" style="margin-top:10px">Volgens de rotatie is <button class="linky" data-act="set-day" data-id="${suggest}">${esc(dayName(suggest))}</button> aan de beurt.</p>` : ''}
        <div class="chips" style="margin-top:12px" id="setup-extras">
          ${EXTRAS.map(x => `<button class="chip ${ls.extras.includes(x.id) ? 'on' : ''}" data-act="toggle-extra" data-id="${x.id}">${x.name}</button>`).join('')}
        </div>
      </div>

      <div class="section">
        <div class="section-head"><h2>Hoelang?</h2></div>
        <div class="chips" id="setup-duration">
          ${DURATIONS.map(d => `<button class="chip ${ls.duration === d ? 'on' : ''}" data-act="set-duration" data-id="${d}">${d} min</button>`).join('')}
        </div>
      </div>

      <div class="section">
        <button class="btn primary big" data-act="start" ${ls.people.length && ls.day ? '' : 'disabled'}>Maak het schema</button>
        ${coach.ready() ? `<button class="btn ghost" style="width:100%;margin-top:8px" data-act="start-coach" ${ls.people.length && ls.day && !ui.busy ? '' : 'disabled'}>${ui.busy === 'plan' ? 'De coach denkt na…' : 'Laat de coach het samenstellen'}</button>` : ''}
        <p class="muted small" style="margin-top:10px;text-align:center">Ongeveer ${Math.max(2, Math.floor((ls.duration - state.settings.warmupMinutes) / state.settings.minutesPerExercise))} oefeningen uit je ${esc(dayName(ls.day))}-dag, afgewisseld per spiergroep. Oefeningen die jullie het langst niet gedaan hebben komen eerst.</p>
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
        <div><div style="font-family:var(--display);font-weight:700;font-size:20px">${esc(dayLabel(s))}</div><div class="lbl">${done}/${s.items.length} oefeningen klaar</div></div>
        <div class="people">${people.map(p => avatar(p, 'xs')).join('')}</div>
      </div>
      <div class="progress" style="margin:-4px 0 0;background:var(--line)"><span style="width:${s.items.length ? (done / s.items.length) * 100 : 0}%"></span></div>

      <p class="muted small" style="margin:14px 0 10px">Warming-up ${state.settings.warmupMinutes} min eerst. Tik op een oefening om gewichten in te vullen, vinkje als iedereen klaar is.</p>

      <ol class="plan">
        ${s.items.map((it, idx) => renderPlanItem(it, idx, people)).join('')}
      </ol>

      ${s.coachNote ? `<p class="coach-note">${esc(s.coachNote)}</p>` : ''}

      <div class="btn-row" style="margin-top:6px">
        <button class="btn" data-act="add-exercise">+ Oefening</button>
        <button class="btn" data-act="rest" data-sec="${state.settings.restSeconds}">Rust ${state.settings.restSeconds}s</button>
        ${coach.ready() ? `<button class="btn" data-act="suggest" ${ui.busy ? 'disabled' : ''}>${ui.busy === 'suggest' ? 'De coach denkt na…' : 'Gewichten voorstellen'}</button>` : ''}
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
    </div>
    ${renderTips(it, people)}`;
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
    </table>
    ${renderTips(it, people)}`;
  }
  // Wat de coach voorstelde. Staat in de sessie, dus alle drie zien hetzelfde.
  function renderTips(it, people) {
    const tips = people.map(p => (it.tip || {})[p.id] ? `<li style="--c:${p.color}"><b>${esc(p.name)}</b> ${esc(it.tip[p.id])}</li>` : '').join('');
    return tips ? `<ul class="tips">${tips}</ul>` : '';
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
        <div><div class="t">${esc(dayLabel(h))}</div><div class="muted small">${esc(fmtDate(h.date))} · ${mins} min · met ${esc(h.people.map(id => (person(id) || {}).name || id).join(', '))}</div></div>
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

  // ----- Coach -----
  const VOORBEELDEN = [
    'Gaat mijn bench vooruit?',
    'Waar loop ik achter?',
    'Wie tilt het meest op squat?',
    'Wat moet ik volgende keer zwaarder doen?',
  ];
  function renderCoach() {
    if (!coach.ready()) {
      return `<h1>Coach</h1>
        <div class="section"><div class="card">
          <p>De coach heeft het groepswachtwoord nodig — daarmee haalt hij jullie cijfers op.</p>
          <button class="btn" style="margin-top:12px" data-act="goto-sync">Naar Instellingen</button>
        </div></div>`;
    }
    return `<h1>Coach</h1>
      <p class="muted small" style="margin:6px 0 14px">Vraag wat je wilt over jullie eigen cijfers. Hij ziet de trainingen, de gewichten en de PR's — verder niets.</p>
      <div class="chat" id="chat">
        ${ui.chat.length
          ? ui.chat.map(m => `<div class="msg ${m.role}">${esc(m.content) || '<span class="dots">···</span>'}</div>`).join('')
          : `<div class="chat-empty">
              <p class="muted small">Bijvoorbeeld:</p>
              <div class="chips" style="margin-top:8px">${VOORBEELDEN.map(v => `<button class="chip" data-act="coach-voorbeeld" data-id="${esc(v)}">${esc(v)}</button>`).join('')}</div>
             </div>`}
      </div>
      <div class="chat-bar">
        <input class="input" id="chat-input" placeholder="Stel je vraag" ${ui.chatBusy ? 'disabled' : ''} autocomplete="off">
        <button class="btn primary" data-act="coach-send" ${ui.chatBusy ? 'disabled' : ''}>Vraag</button>
      </div>
      ${ui.chat.length ? `<button class="btn ghost sm" style="margin-top:10px" data-act="coach-wis">Gesprek wissen</button>` : ''}`;
  }

  async function coachVraag(tekst) {
    const vraag = String(tekst || '').trim();
    if (!vraag || ui.chatBusy) return;
    ui.chat.push({ role: 'user', content: vraag });
    ui.chat.push({ role: 'assistant', content: '' });
    ui.chatBusy = true;
    render();
    const bubbel = $('#chat .msg.assistant:last-child');
    const laatste = ui.chat[ui.chat.length - 1];
    try {
      await coach.ask(ui.chat.slice(0, -1), stukje => {
        laatste.content += stukje;
        if (bubbel) { bubbel.textContent = laatste.content; bubbel.scrollIntoView({ block: 'end', behavior: 'smooth' }); }
      });
      if (!laatste.content) laatste.content = 'Daar kwam niets uit. Probeer het nog eens.';
    } catch (e) {
      laatste.content = 'Ging mis: ' + e.message;
    }
    ui.chatBusy = false;
    render();
    const inp = $('#chat-input'); if (inp) inp.focus();
  }

  // De coach stelt het schema samen in plaats van de round-robin.
  async function coachSchema() {
    const ls = state.lastSetup;
    const dag = dayById(ls.day) || DAYS[0];
    const groups = dag.groups.concat(EXTRAS.filter(x => ls.extras.includes(x.id)).map(x => x.group));
    const count = Math.max(2, Math.floor((ls.duration - state.settings.warmupMinutes) / state.settings.minutesPerExercise));
    ui.busy = 'plan'; render();
    try {
      const out = await coach.post({ mode: 'plan', day: dayName(ls.day), groups, count, people: ls.people });
      const items = [];
      for (const x of out.items || []) {
        const e = state.exercises.find(y => y.id === x.exId);
        if (!e) continue;   // de functie filtert al, maar vertrouw niets blind
        items.push({
          id: uid(), exId: e.id, name: e.name, group: e.group,
          sets: Math.max(1, Math.min(12, Number(x.sets) || e.sets)),
          reps: String(x.reps || e.reps).slice(0, 20),
          cardio: !!e.cardio, done: false, logs: {},
        });
      }
      if (!items.length) throw new Error('De coach gaf geen bruikbaar schema.');
      state.session = {
        id: uid(), startedAt: new Date().toISOString(), people: ls.people.slice(),
        day: ls.day, extras: ls.extras.slice(), groups: Array.from(new Set(items.map(i => i.group))),
        duration: ls.duration, items, coachNote: String(out.note || ''), updatedAt: Date.now(),
      };
      ui.busy = null; save(true); render(); window.scrollTo(0, 0);
    } catch (e) {
      ui.busy = null; render(); toast(e.message);
    }
  }

  // Voorstel voor het startgewicht per oefening per persoon.
  async function coachGewichten() {
    const s = state.session;
    if (!s) return;
    ui.busy = 'suggest'; render();
    try {
      const items = s.items.map(i => ({ id: i.id, exId: i.exId, name: i.name, cardio: !!i.cardio, sets: i.sets, reps: i.reps }));
      const out = await coach.post({ mode: 'suggest', items, people: s.people });
      let n = 0;
      for (const sug of out.suggestions || []) {
        const it = s.items.find(i => i.id === sug.item);
        if (!it || !s.people.includes(sug.person)) continue;
        const w = Number(sug.weight) || 0, r = Number(sug.reps) || 0;
        const kop = it.cardio ? (r ? `${r} min` : '') : (w ? `${w} kg × ${r}` : '');
        const why = String(sug.why || '').slice(0, 80);
        if (!kop && !why) continue;
        it.tip = it.tip || {};
        it.tip[sug.person] = [kop, why].filter(Boolean).join(' — ');
        n++;
      }
      ui.busy = null;
      if (!n) { render(); toast('De coach had geen voorstel.'); return; }
      save(true); render();
    } catch (e) {
      ui.busy = null; render(); toast(e.message);
    }
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
    const LIBRARY = DAYS.map(d => ({ title: d.name, groups: d.groups }))
      .concat([{ title: 'Los erbij', groups: EXTRAS.map(x => x.group) }]);
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
        ${LIBRARY.map(sec => `
          <div class="day-title">${esc(sec.title)}</div>
          ${sec.groups.map(g => byGroup[g] ? `
            <div class="group-title">${g} <span class="count">${byGroup[g].length}</span></div>
            <div class="card flush"><ul class="ex-list">
              ${byGroup[g].map(e => `<li>
                <div class="grow"><div class="name">${esc(e.name)}</div><div class="meta">${e.sets} × ${esc(e.reps)}${e.compound ? ' · compound' : ''}</div></div>
                <button class="btn sm" data-act="edit-ex" data-id="${e.id}">Bewerk</button>
              </li>`).join('')}
            </ul></div>` : '').join('')}`).join('')}
      </div>

      <div class="section">
        <div class="section-head"><h2>Coach</h2><span class="hint">${coach.ready() ? 'aan' : 'uit'}</span></div>
        <div class="card">
          <p class="muted small">${coach.ready()
            ? 'De coach draait op een Supabase Edge Function; de Anthropic-key staat daar als secret en komt nooit in de app. Je vindt hem bij <b>Coach</b> onderin, en tijdens een training onder <b>Gewichten voorstellen</b>.'
            : 'De coach heeft het groepswachtwoord nodig. Vul dat hieronder in bij <b>Samen</b>.'}</p>
        </div>
      </div>

      <div class="section">
        <div class="section-head"><h2>Samen</h2><span class="hint" id="sync-line">${esc(sync.label())}</span></div>
        <div class="card">
          ${sync.configured() ? `
            <p class="muted small">Met het groepswachtwoord landt alles bij Maikel, Sjoerd en Rens tegelijk: een lopende training en de gewichten die iemand invult zie je meteen. Eén keer invullen, daarna onthoudt dit toestel het.</p>
            <div class="field" style="margin-top:12px">
              <label>Groepswachtwoord</label>
              <input class="input" type="password" id="sync-pass" autocomplete="current-password" placeholder="${sync.hasPass() ? 'ingevuld — typ om te wijzigen' : 'groepswachtwoord'}">
            </div>
            <div class="btn-row" style="margin-top:10px">
              <button class="btn primary" data-act="sync-connect">Verbinden</button>
              ${sync.hasPass() ? `<button class="btn" data-act="sync-now">Nu synchroniseren</button>
              <button class="btn ghost" style="color:var(--danger)" data-act="sync-forget">Loskoppelen</button>` : ''}
            </div>
            <p class="muted small" style="margin-top:10px">Zonder verbinding werkt alles gewoon door op dit toestel; zodra er weer net is gaat het vanzelf mee.</p>
          ` : `
            <p class="muted small">Nog geen Supabase-project ingesteld. Vul <code>supabase-config.js</code> in en draai <code>supabase.sql</code> in de SQL-editor.</p>
          `}
        </div>
      </div>

      <div class="section">
        <div class="section-head"><h2>Data</h2></div>
        <p class="muted small" style="margin-bottom:10px">Exporteren geeft een JSON-bestand met alles wat op dit toestel staat. Importeren voegt een export van iemand anders samen met wat je al hebt — handig als back-up of om zonder Supabase te delen.</p>
        <div class="btn-row">
          <button class="btn" data-act="export">Exporteren</button>
          <button class="btn" data-act="import">Importeren</button>
        </div>
        <input type="file" id="import-file" accept="application/json" hidden>
        <button class="btn danger" style="width:100%;margin-top:10px" data-act="reset">Alles wissen</button>
      </div>
      <p class="muted small" style="margin-top:24px;text-align:center">WOWF · versie 2.0</p>`;
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
        <div class="field full"><label>Spiergroep</label><select class="input" id="ex-group">${
          DAYS.map(d => `<optgroup label="${d.name}">${d.groups.map(g => `<option ${g === e.group ? 'selected' : ''}>${g}</option>`).join('')}</optgroup>`).join('') +
          `<optgroup label="Los erbij">${EXTRAS.map(x => `<option ${x.group === e.group ? 'selected' : ''}>${x.group}</option>`).join('')}</optgroup>`
        }</select></div>
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
  // Alle spiergroepen die bij deze training horen: de dag plus de gekozen extra's.
  // Voor trainingen van vóór de PPL-indeling vallen we terug op wat er in het schema zat.
  function sessionGroups(s) {
    const d = dayById(s.day);
    if (!d) return s.groups || [];
    return d.groups.concat(EXTRAS.filter(x => (s.extras || []).includes(x.id)).map(x => x.group));
  }
  function addExerciseModal() {
    const s = state.session;
    const on = sessionGroups(s);
    const used = new Set(s.items.map(i => i.exId));
    openModal(`
      <h2>Oefening toevoegen</h2>
      <div class="chips" style="margin-bottom:10px" id="add-ex-groups">
        ${GROUPS.map(g => `<button class="chip ${on.includes(g) ? 'on' : ''}" data-act="add-ex-filter" data-id="${g}">${g}</button>`).join('')}
      </div>
      <div class="card flush"><ul class="ex-list" id="add-ex-list">
        ${state.exercises.filter(e => !used.has(e.id)).map(e => `<li data-group="${e.group}" ${on.includes(e.group) ? '' : 'hidden'}>
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

  // ---------- samenvoegen van lokaal en remote ----------
  /* Regels: people op id, exercises op naam, history op id, en session, lastSetup en
     settings op updatedAt — de nieuwste wint. Bij gelijkspel wint remote, zodat een vers
     toestel de ids van de groep overneemt in plaats van zijn eigen standaardlijst.
     Ingevulde sets gaan een niveau dieper: per cel wint de laatste toetsaanslag (veld t),
     zodat twee mensen tegelijk in dezelfde oefening kunnen typen zonder elkaar te wissen. */
  const stamp = o => (o && o.updatedAt) || 0;
  function newest(loc, rem) {
    if (!rem) return loc;
    if (!loc) return rem;
    return stamp(rem) >= stamp(loc) ? rem : loc;
  }
  function mergeList(locArr, remArr, keyOf, prefix, tomb) {
    const out = new Map();
    for (const it of locArr || []) out.set(keyOf(it), it);
    for (const it of remArr || []) {
      const k = keyOf(it);
      out.set(k, out.has(k) ? newest(out.get(k), it) : it);
    }
    for (const [k, it] of Array.from(out)) {
      const ts = tomb[prefix + k];
      if (ts && stamp(it) <= ts) out.delete(k);   // hier verwijderd, niet opnieuw binnenhalen
    }
    return Array.from(out.values());
  }
  function mergeLogs(a, b) {
    const n = Math.max(a ? a.length : 0, b ? b.length : 0);
    const out = [];
    for (let i = 0; i < n; i++) {
      const x = (a || [])[i], y = (b || [])[i];
      out[i] = !x ? (y || {}) : !y ? x : ((y.t || 0) > (x.t || 0) ? y : x);
    }
    return out;
  }
  function mergeSession(loc, rem) {
    if (!loc || !rem) return loc || rem || null;
    if (loc.id !== rem.id) return newest(loc, rem);
    const base = newest(loc, rem), other = base === loc ? rem : loc;
    const otherItems = new Map((other.items || []).map(i => [i.id, i]));
    const localOpen = new Map((loc.items || []).map(i => [i.id, i.open]));
    const items = (base.items || []).map(i => {
      const o = otherItems.get(i.id);
      const logs = { ...(i.logs || {}) };
      if (o) for (const pid of Object.keys(o.logs || {})) logs[pid] = mergeLogs(logs[pid], o.logs[pid]);
      // open/dicht is per toestel: het paneel van een ander mag het mijne niet dichtklappen
      return { ...i, logs, open: localOpen.has(i.id) ? localOpen.get(i.id) : i.open };
    });
    return { ...base, items };
  }
  function mergeDocs(loc, rem) {
    if (!rem || !rem.people || !rem.exercises) return loc;
    const tomb = { ...(rem.tomb || {}) };
    for (const k of Object.keys(loc.tomb || {})) tomb[k] = Math.max(tomb[k] || 0, loc.tomb[k]);
    return {
      people:    mergeList(loc.people, rem.people, p => p.id, 'p:', tomb),
      exercises: mergeList(loc.exercises, rem.exercises, e => String(e.name).trim().toLowerCase(), 'e:', tomb),
      history:   mergeList(loc.history, rem.history, h => h.id, 'h:', tomb).sort((a, b) => (a.date < b.date ? -1 : 1)),
      settings:  { ...DEFAULT_SETTINGS, ...newest(loc.settings, rem.settings) },
      lastSetup: migrateSetup(newest(loc.lastSetup, rem.lastSetup)),
      session:   mergeSession(loc.session, rem.session),
      tomb,
      updatedAt: Math.max(loc.updatedAt || 0, rem.updatedAt || 0),
    };
  }
  // Wat er de deur uit gaat: zonder open/dicht (dat is per toestel) en zonder afzender.
  const OMIT = { open: 1, _client: 1 };
  const docJson = d => JSON.stringify(d, (k, v) => (OMIT[k] ? undefined : v));
  const docOf = () => JSON.parse(docJson(state));

  // Opnieuw tekenen zonder het veld af te pakken waar iemand op dat moment in typt.
  function redraw() {
    const a = document.activeElement;
    const live = a && a.tagName === 'INPUT' && a.dataset && a.dataset.act === 'log' ? a.dataset : null;
    const typed = live ? a.value : null;
    const y = window.scrollY;
    render();
    if (live) {
      const el = $(`input[data-act="log"][data-id="${live.id}"][data-pid="${live.pid}"][data-set="${live.set}"][data-k="${live.k}"]`);
      if (el) {
        if (el.value !== typed) el.value = typed;   // wat ik net intikte blijft staan
        try { el.focus({ preventScroll: true }); } catch (e) { el.focus(); }
      }
    }
    window.scrollTo(0, y);
  }

  // ---------- sync met Supabase ----------
  const SYNC_LABEL = {
    off:     { txt: 'lokaal',     hint: 'Alleen op dit toestel — vul het groepswachtwoord in bij Instellingen' },
    busy:    { txt: 'bezig',      hint: 'Bezig met synchroniseren' },
    synced:  { txt: 'gesynced',   hint: 'Alles staat gedeeld' },
    offline: { txt: 'offline',    hint: 'Geen verbinding — alles blijft lokaal en gaat mee zodra er weer net is' },
    badpass: { txt: 'wachtwoord', hint: 'Het groepswachtwoord klopt niet' },
  };

  const sync = (function () {
    const cfg = window.WOWF_SUPABASE || {};
    const DOC_ID = cfg.docId || 'wowf';
    const clientId = uid() + uid();          // om onze eigen wijziging te herkennen
    let client = null, channel = null;
    let status = 'off';
    let pushTimer = null, pullTimer = null, retryTimer = null, pollTimer = null;
    let dirty = false, pushing = false, pulling = false;

    // Vangnet naast realtime. Een telefoon in je broekzak bevriest de websocket zonder
    // dat supabase-js dat meldt; dan komt er niets meer binnen tot je de app herstart.
    // Daarom pollen we er los doorheen — snel tijdens een training, rustig daarbuiten —
    // en haken we opnieuw aan zodra blijkt dat het kanaal niet meer leeft.
    const POLL_ACTIVE = 4000, POLL_IDLE = 20000;
    const alive = () => !!channel && channel.state === 'joined';
    function poll() {
      clearTimeout(pollTimer);
      if (!client || document.hidden) return;
      pollTimer = setTimeout(() => {
        if (!alive()) subscribe();
        pull(true);
        poll();
      }, state.session ? POLL_ACTIVE : POLL_IDLE);
    }
    function stopPoll() { clearTimeout(pollTimer); pollTimer = null; }

    const configured = () => !!(cfg.url && cfg.key);
    const pass = groepswachtwoord;

    function setStatus(s) {
      if (status === s) return;
      status = s;
      paint();
    }
    function paint() {
      const l = SYNC_LABEL[status] || SYNC_LABEL.off;
      const el = $('#sync-status');
      if (el) { el.textContent = l.txt; el.className = 'sync ' + status; el.title = l.hint; }
      const line = $('#sync-line');
      if (line) line.textContent = l.txt;
    }
    function offline() { setStatus('offline'); retryLater(); }
    function retryLater() {
      clearTimeout(retryTimer);
      retryTimer = setTimeout(() => { if (configured() && pass()) connect(); }, 15000);
    }
    function fail(err) {
      if (err && (err.code === '28000' || /groepswachtwoord/i.test(String(err.message || '')))) { setStatus('badpass'); return; }
      offline();
    }

    async function connect() {
      if (!configured() || !pass()) { setStatus('off'); return; }
      const mod = window.WOWF_SUPABASE_LIB;
      if (!mod || !mod.createClient) { offline(); return; }
      if (!client) {
        try {
          client = mod.createClient(cfg.url, cfg.key, {
            auth: { persistSession: false, autoRefreshToken: false },
            realtime: { params: { eventsPerSecond: 5 } },
          });
        } catch (e) { client = null; offline(); return; }
      }
      await pull();
      if (status !== 'badpass') { subscribe(); poll(); }
    }

    async function pull(quiet) {
      if (!client || pulling) return;
      pulling = true;
      if (!quiet) setStatus('busy');
      let res;
      try { res = await client.rpc('wowf_pull', { p_id: DOC_ID, p_pass: pass() }); }
      catch (e) { pulling = false; offline(); return; }
      pulling = false;
      if (res.error) { fail(res.error); return; }
      const row = Array.isArray(res.data) ? res.data[0] : res.data;
      const remote = row && row.doc;
      if (remote && remote.people) {
        const before = docJson(state);
        Object.assign(state, mergeDocs(state, remote));
        if (docJson(state) !== before) { saveLocal(); redraw(); }
      }
      setStatus('synced');
      // Hebben wij iets dat daar niet staat (of net samengevoegd)? Dan meteen terug.
      if (!remote || docJson(state) !== docJson(remote)) queuePush();
    }

    function queuePush(now) {
      dirty = true;
      clearTimeout(pushTimer);
      pushTimer = setTimeout(flush, now ? 0 : 1000);   // ~1 s debounce, of meteen
    }
    async function flush() {
      if (!dirty || pushing) return;
      if (!client) { if (configured() && pass()) connect(); return; }
      pushing = true; dirty = false;
      const doc = docOf();
      doc._client = clientId;
      setStatus('busy');
      let res;
      try { res = await client.rpc('wowf_push', { p_id: DOC_ID, p_pass: pass(), p_doc: doc }); }
      catch (e) { pushing = false; dirty = true; offline(); return; }
      pushing = false;
      if (res.error) { dirty = true; fail(res.error); return; }
      setStatus('synced');
      if (dirty) queuePush();
    }

    function drop() {
      if (client && channel) { try { client.removeChannel(channel); } catch (e) { /* al weg */ } }
      channel = null;
    }
    function subscribe() {
      if (!client) return;
      drop();
      channel = client
        .channel('wowf-pulse-' + DOC_ID)
        .on('postgres_changes',
            { event: '*', schema: 'public', table: 'wowf_pulse', filter: 'id=eq.' + DOC_ID },
            payload => {
              if (payload && payload.new && payload.new.by_client === clientId) return;  // onze eigen push
              clearTimeout(pullTimer);
              pullTimer = setTimeout(pull, 150);
            })
        .subscribe(st => {
          if (st === 'SUBSCRIBED') { setStatus('synced'); poll(); if (dirty) queuePush(); }
          else if (st === 'CHANNEL_ERROR' || st === 'TIMED_OUT') offline();
        });
    }

    return {
      queuePush,
      pull,
      configured,
      status: () => status,
      label: () => (SYNC_LABEL[status] || SYNC_LABEL.off).txt,
      hasPass: () => !!pass(),
      setPass(v) {
        try { localStorage.setItem(PASS_KEY, String(v || '').trim()); } catch (e) { /* privémodus */ }
        drop();
        setStatus('busy');
        connect();
      },
      forget() {
        try { localStorage.removeItem(PASS_KEY); } catch (e) { /* privémodus */ }
        drop();
        stopPoll();
        client = null;
        clearTimeout(retryTimer);
        setStatus('off');
      },
      start() {
        window.addEventListener('online', () => { if (configured() && pass()) connect(); });
        window.addEventListener('offline', () => { if (client) setStatus('offline'); });
        document.addEventListener('visibilitychange', () => {
          if (document.hidden) { stopPoll(); return; }
          if (!client) { if (configured() && pass()) connect(); return; }
          if (!alive()) subscribe();   // kanaal overleefde de slaapstand niet
          pull();
          poll();
        });
        paint();
        if (!configured() || !pass()) { setStatus('off'); return; }
        setStatus('busy');
        // supabase-js komt via een module-script in index.html en is er dus nét nog niet.
        if (window.WOWF_SUPABASE_LIB !== undefined) connect();
        else window.addEventListener('wowf-supabase-ready', () => connect(), { once: true });
      },
    };
  })();

  // ---------- de coach ----------
  // Praat met de Edge Function, nooit rechtstreeks met Anthropic: de API-key hoort
  // niet in een statische site thuis (zie supabase/functions/coach/index.ts).
  // Het groepswachtwoord gaat mee als sleutel; zonder dat komt er geen data uit.
  const coach = (function () {
    const cfg = window.WOWF_SUPABASE || {};
    const endpoint = () => (cfg.url ? cfg.url.replace(/\/+$/, '') + '/functions/v1/coach' : '');
    const ready = () => !!(endpoint() && groepswachtwoord());

    async function post(payload) {
      const r = await fetch(endpoint(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pass: groepswachtwoord(), ...payload }),
      });
      let data = {};
      try { data = await r.json(); } catch (e) { /* geen json terug */ }
      if (!r.ok) throw new Error(data.error || 'De coach is niet bereikbaar.');
      return data;
    }

    // Het gesprek komt als server-sent events binnen, zodat het antwoord meeloopt
    // met het typen in plaats van er na een halve minuut in één klap te staan.
    async function ask(messages, onDelta) {
      const r = await fetch(endpoint(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pass: groepswachtwoord(), mode: 'ask', messages }),
      });
      if (!r.ok || !r.body) {
        let data = {};
        try { data = await r.json(); } catch (e) { /* geen json terug */ }
        throw new Error(data.error || 'De coach is niet bereikbaar.');
      }
      const reader = r.body.getReader();
      const dec = new TextDecoder();
      let buf = '';
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const blokken = buf.split('\n\n');
        buf = blokken.pop();
        for (const blok of blokken) {
          const regel = blok.split('\n').find(l => l.startsWith('data: '));
          if (!regel) continue;
          const rest = regel.slice(6);
          if (rest === '[DONE]') return;
          let d = null;
          try { d = JSON.parse(rest); } catch (e) { continue; }
          if (d.error) throw new Error(d.error);
          if (d.text) onDelta(d.text);
        }
      }
    }

    return { ready, post, ask };
  })();

  // ---------- events ----------
  document.addEventListener('click', e => {
    const el = e.target.closest('[data-act]'); if (!el) return;
    const act = el.dataset.act, id = el.dataset.id;
    const s = state.session;
    const item = s && s.items.find(i => i.id === id);
    switch (act) {
      case 'toggle-person': { const a = state.lastSetup.people; const i = a.indexOf(id); i >= 0 ? a.splice(i, 1) : a.push(id); touch(state.lastSetup); save(); render(); break; }
      case 'set-day': state.lastSetup.day = id; touch(state.lastSetup); save(); render(); break;
      case 'toggle-extra': { const a = state.lastSetup.extras; const i = a.indexOf(id); i >= 0 ? a.splice(i, 1) : a.push(id); touch(state.lastSetup); save(); render(); break; }
      case 'set-duration': state.lastSetup.duration = Number(id); touch(state.lastSetup); save(); render(); break;
      case 'start': {
        const ls = state.lastSetup;
        const items = generatePlan(ls.day, ls.extras, ls.duration);
        if (!items.length) { toast(`Geen oefeningen voor je ${dayName(ls.day)}-dag. Voeg ze toe bij Instellingen.`); break; }
        state.session = {
          id: uid(), startedAt: new Date().toISOString(), people: ls.people.slice(),
          day: ls.day, extras: ls.extras.slice(),
          groups: Array.from(new Set(items.map(i => i.group))),   // voor de terugblik
          duration: ls.duration, items, updatedAt: Date.now(),
        };
        save(true); render(); window.scrollTo(0, 0); break;
      }
      case 'toggle-open': { const was = isOpen(item, s.items.indexOf(item)); s.items.forEach((i, idx) => { i.open = isOpen(i, idx) && i.id !== id ? false : i.open; }); item.open = !was; save(); render(); break; }
      case 'toggle-done': item.done = !item.done; item.open = undefined; save(true); render(); if (item.done) toast(`${item.name} klaar`); break;
      case 'swap': swapExercise(item); break;
      case 'remove-item': s.items = s.items.filter(i => i.id !== id); save(); render(); break;
      case 'add-set': item.sets++; save(); render(); break;
      case 'copy-last': {
        let n = 0;
        for (const pid of s.people) { const ls = lastSets(pid, item.exId); if (ls) { item.logs[pid] = ls.map(x => ({ ...x, t: Date.now() })); n++; } }
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
        const h = { id: s.id, date: s.startedAt, endedAt: new Date().toISOString(), updatedAt: Date.now(), people: s.people, day: s.day, extras: s.extras || [], groups: s.groups, duration: s.duration, notes,
          items: s.items.map(i => ({ exId: i.exId, name: i.name, group: i.group, cardio: i.cardio, sets: i.sets, reps: i.reps, logs: i.logs })) };
        const prs = [];
        for (const it of h.items) for (const pid of h.people) { const b = bestSet(pid, it.exId, null); const top = Math.max(0, ...(it.logs[pid] || []).map(x => x.w || 0)); if (top && (!b || top > b.w)) prs.push(`${(person(pid) || {}).name}: ${it.name} ${top} kg`); }
        state.history.push(h); state.session = null; save(true); closeModal(); stopRest(false); ui.tab = 'progress'; render();
        toast(prs.length ? `Opgeslagen. Nieuwe PR's: ${prs.length}` : 'Training opgeslagen');
        break;
      }
      case 'cancel': if (confirm('Training weggooien? Ingevulde gewichten gaan verloren.')) { state.session = null; save(); stopRest(false); render(); } break;
      case 'progress-person': ui.progressPerson = id; ui.progressExercise = null; render(); break;
      case 'delete-history': if (confirm('Deze training verwijderen?')) { state.history = state.history.filter(h => h.id !== id); tombstone('h:' + id); save(); render(); } break;
      case 'edit-person': personModal(person(id)); break;
      case 'add-person': personModal(null); break;
      case 'save-person': {
        const name = $('#p-name').value.trim(); if (!name) { toast('Naam is verplicht'); break; }
        const data = { name, color: $('#p-color').value, bio: $('#p-bio').value.trim(), goal: $('#p-goal').value.trim() };
        if (id) touch(Object.assign(person(id), data)); else { const nid = name.toLowerCase().replace(/[^a-z0-9]/g, '') + '-' + uid().slice(0, 4); state.people.push({ id: nid, ...data, updatedAt: Date.now() }); touch(state.lastSetup).people.push(nid); }
        save(); closeModal(); render(); break;
      }
      case 'delete-person': if (confirm('Profiel verwijderen? De trainingsgeschiedenis blijft bewaard.')) { state.people = state.people.filter(p => p.id !== id); state.lastSetup.people = touch(state.lastSetup).people.filter(x => x !== id); tombstone('p:' + id); save(); closeModal(); render(); } break;
      case 'add-ex': exerciseModal(null); break;
      case 'edit-ex': exerciseModal(exercise(id)); break;
      case 'save-ex': {
        const name = $('#ex-name').value.trim(); if (!name) { toast('Naam is verplicht'); break; }
        const data = { name, group: $('#ex-group').value, sets: Math.max(1, Number($('#ex-sets').value) || 3), reps: $('#ex-reps').value.trim() || '8-12', compound: $('#ex-compound').checked, cardio: $('#ex-cardio').checked };
        if (id) touch(Object.assign(exercise(id), data)); else state.exercises.push({ id: uid(), ...data, updatedAt: Date.now() });
        save(); closeModal(); render(); break;
      }
      case 'delete-ex': if (confirm('Oefening uit de bibliotheek verwijderen?')) { const gone = exercise(id); if (gone) tombstone('e:' + String(gone.name).trim().toLowerCase()); state.exercises = state.exercises.filter(x => x.id !== id); save(); closeModal(); render(); } break;
      case 'close-modal': closeModal(); break;
      case 'sync-connect': {
        const v = (($('#sync-pass') || {}).value || '').trim();
        if (!v) { toast('Vul het groepswachtwoord in'); break; }
        sync.setPass(v); render(); toast('Verbinden…'); break;
      }
      case 'sync-now': sync.pull(); toast('Synchroniseren…'); break;
      case 'sync-forget': if (confirm('Loskoppelen van de groep? De gegevens blijven op dit toestel staan.')) { sync.forget(); render(); } break;
      case 'goto-sync': ui.tab = 'settings'; render(); break;
      case 'start-coach': coachSchema(); break;
      case 'suggest': coachGewichten(); break;
      case 'coach-send': { const inp = $('#chat-input'); if (inp) { const v = inp.value; inp.value = ''; coachVraag(v); } break; }
      case 'coach-voorbeeld': coachVraag(id); break;
      case 'coach-wis': ui.chat = []; render(); break;
      case 'export': exportData(); break;
      case 'import': $('#import-file').click(); break;
      case 'reset': if (confirm('Alles wissen, ook de geschiedenis? Dit toestel wordt ook losgekoppeld van de groep, zodat de anderen hun gegevens houden. Exporteer eerst als je twijfelt.')) { sync.forget(); localStorage.removeItem(STORAGE_KEY); state = load(); render(); } break;
    }
  });

  document.addEventListener('keydown', e => {
    if (e.key !== 'Enter' || e.target.id !== 'chat-input') return;
    e.preventDefault();
    const v = e.target.value; e.target.value = ''; coachVraag(v);
  });

  document.addEventListener('input', e => {
    const el = e.target; if (!el.dataset) return;
    if (el.dataset.act === 'log') {
      const it = state.session.items.find(i => i.id === el.dataset.id);
      const arr = it.logs[el.dataset.pid] = it.logs[el.dataset.pid] || [];
      const i = Number(el.dataset.set); arr[i] = arr[i] || {};
      const v = el.value === '' ? null : Number(el.value);
      arr[i][el.dataset.k] = v;
      arr[i].t = Date.now();   // wie het laatst typte wint bij het samenvoegen
      if (el.dataset.k === 'w') { const b = bestSet(el.dataset.pid, it.exId, null); el.classList.toggle('pr', !!(v && b && v > b.w)); }
      save();
    }
    if (el.dataset.act === 'setting') { state.settings[el.dataset.k] = Math.max(0, Number(el.value) || 0); touch(state.settings); save(); }
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
  sync.start();
})();
