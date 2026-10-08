import { load, save as persist, uid, blank } from './store.js';
import * as L from './logic.js';
import * as Sync from './sync.js';

let S = load();
const ui = { day: null, sheet: null, runForm: null, np: null, archiveTab: 'exercises', archiveQ: '', liftQ: '', range: '1m', open: {} };
const $app = document.getElementById('app');
const $sheet = document.getElementById('sheet');

const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const DAY_LONG = { mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday', fri: 'Friday', sat: 'Saturday', sun: 'Sunday' };
const RUN = { threshold: 'Threshold run', long: 'Long run', easy: 'Easy run' };
const RUN_SHORT = { threshold: 'Threshold', long: 'Long', easy: 'Easy' };
const RUN_TYPES = ['threshold', 'long', 'easy'];
const NUDGE = 0.5; // kg per tap on the weight +/- buttons when logging or editing
const LIME = '#C6F432', BLUE = '#6CBCFF', ORANGE = '#FF8A3D', GREY = '#9A9DA3';

// ---------- small helpers ----------

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const today = () => L.isoDate();
const todayKey = () => DAYS[(new Date().getDay() + 6) % 7];
const fmtW = (w) => (w ? String(w) : 'BW');
const kgUnit = (w) => (w ? '<span class="unit"> kg</span>' : '');
const int = (v, min, max, def) => {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? L.clamp(n, min, max) : def;
};
const num = (v) => {
  const n = parseFloat(String(v ?? '').replace(',', '.'));
  return Number.isFinite(n) && n >= 0 ? L.round(n) : null;
};

function save() {
  S.savedAt = Date.now();
  if (!persist(S)) toast('Could not save — phone storage may be full');
  if (!S.demo && Sync.getSession()) {
    Sync.setDirty(true);
    schedulePush();
  }
}

// ---------- Google Sheet sync ----------
// The phone keeps its own copy (fast, works offline); changes go to the person's sheet in the
// background, and the sheet's copy is loaded when the app opens if it's newer.

let pushTimer = 0;
let pushing = false;
function schedulePush(delay = 1500) {
  clearTimeout(pushTimer);
  pushTimer = setTimeout(pushNow, delay);
}

async function pushNow() {
  const sess = Sync.getSession();
  if (!sess || S.demo || !Sync.isDirty()) return;
  if (pushing) return schedulePush(2000);
  if (!navigator.onLine) return setSync('offline');
  pushing = true;
  const sentAt = S.savedAt;
  try {
    const r = await Sync.pushRemote(sess.code, S, sentAt);
    if (!r.ok) throw new Error(r.error);
    if (S.savedAt === sentAt) Sync.setDirty(false);
    setSync('ok');
  } catch (e) {
    setSync('error');
    schedulePush(30000);
  } finally {
    pushing = false;
  }
}

async function pullRemote() {
  const sess = Sync.getSession();
  if (!sess || S.demo) return;
  if (Sync.isDirty()) return pushNow();
  try {
    const r = await Sync.loadRemote(sess.code);
    if (!r.ok) return;
    if (r.url && r.url !== sess.url) Sync.setSession({ ...sess, url: r.url });
    if (r.state && (r.savedAt || 0) > (S.savedAt || 0) && !Sync.isDirty()) {
      S = { ...blank(), ...r.state };
      persist(S);
      render();
    }
    setSync('ok');
  } catch (e) { /* offline: keep the phone's copy */ }
}

function setSync(state) {
  ui.sync = state;
  syncNote();
}

// A one-line note at the top of the page when something isn't in the sheet.
function syncNote() {
  const el = document.getElementById('syncnote');
  if (!el) return;
  let msg = '';
  if (Sync.getSession() && S.demo) msg = 'Demo data: nothing here is saved to your Google Sheet.';
  else if (Sync.getSession() && Sync.isDirty() && (ui.sync === 'error' || ui.sync === 'offline')) msg = 'Not saved to your Google Sheet yet. It’ll retry when you’re online.';
  el.textContent = msg;
  el.hidden = !msg;
}

window.addEventListener('online', () => pushNow());

let toastTimer = 0;
function toast(msg) {
  document.querySelector('.toast')?.remove();
  const el = document.createElement('div');
  el.className = 'toast';
  el.setAttribute('role', 'status');
  el.textContent = msg;
  document.body.appendChild(el);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.remove(), 2600);
}

const svg = (d, size = 22, sw = 2) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const I = {
  back: svg('<path d="M15 6l-6 6 6 6"/>'),
  close: svg('<path d="M6 6l12 12M18 6L6 18"/>'),
  list: svg('<path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01"/>'),
  bin: svg('<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>', 20),
  check: svg('<path d="M5 12.5l4.5 4.5L19 7.5"/>', 30, 3),
  chevron: svg('<path d="M9 6l6 6-6 6"/>', 18),
  plus: svg('<path d="M12 5v14M5 12h14"/>', 24, 3),
  today: svg('<path d="M6 7v10M18 7v10M3 10v4M21 10v4M6 12h12"/>', 24),
  week: svg('<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/>', 24),
  run: svg('<circle cx="14" cy="4.5" r="1.5"/><path d="M8 21l3-6 3 2v4M7 12l3-4h4l2 3 3 1M10 8l1 7"/>', 24),
  chart: svg('<path d="M4 19h16M5 15l4-4 4 3 6-7"/>', 24),
  search: svg('<circle cx="11" cy="11" r="6"/><path d="M20 20l-4.5-4.5"/>', 18),
  grip: svg('<circle cx="9" cy="6" r="1.4"/><circle cx="15" cy="6" r="1.4"/><circle cx="9" cy="12" r="1.4"/><circle cx="15" cy="12" r="1.4"/><circle cx="9" cy="18" r="1.4"/><circle cx="15" cy="18" r="1.4"/>', 22),
};

function arrow(dir) {
  if (dir === 'up') return `<span style="color:${LIME}" role="img" aria-label="Better">${svg('<path d="M12 19V5M6 11l6-6 6 6"/>', 20, 2.5)}</span>`;
  if (dir === 'down') return `<span style="color:${ORANGE}" role="img" aria-label="Worse">${svg('<path d="M12 5v14M6 13l6 6 6-6"/>', 20, 2.5)}</span>`;
  return `<span style="color:${GREY}" role="img" aria-label="Same">${svg('<path d="M5 12h14"/>', 20, 2.5)}</span>`;
}

// ---------- data helpers ----------

const cur = () => S.programs.find((p) => p.id === S.currentId && !p.archived) || null;
const prog = (id) => S.programs.find((p) => p.id === id);
const exName = (id) => S.exercises[id]?.name || 'Exercise';
const exStep = (id) => S.exercises[id]?.step ?? 2.5;

// Next target for an exercise in a workout: weight plus a rep target per set.
function targetFor(exId, item) {
  const t = S.targets[exId] || { weight: 0, reps: item.min };
  const sets = L.setTargets(t, item);
  return { weight: t.weight, sets, reps: sets[0] };
}
const setReps = (t, i) => t.sets[Math.min(i, t.sets.length - 1)];
// '12' or '12·11·10' for a stored target
const tReps = (t) => L.repsText(t.sets && t.sets.length ? t.sets : [t.reps]);

function findExByName(name) {
  const n = name.trim().toLowerCase();
  return n ? Object.values(S.exercises).find((e) => e.name.toLowerCase() === n) : null;
}

// Every logged session of one exercise, oldest first.
function exSessions(exId) {
  const out = [];
  for (const s of S.sessions) for (const e of s.entries) if (e.exId === exId) out.push({ id: s.id, date: s.date, programId: s.programId, sets: e.sets });
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

// Most recent sets/rep-range used for an exercise in any program.
function lastConfig(exId) {
  const list = [cur(), ...S.programs.slice().reverse()].filter(Boolean);
  for (const p of list) for (const w of Object.values(p.workouts)) {
    const it = w.items.find((i) => i.exId === exId);
    if (it) return it;
  }
  return null;
}

const runsOf = (type) => S.runs.filter((r) => r.type === type).sort((a, b) => a.date.localeCompare(b.date));
const lastRun = (type) => runsOf(type).at(-1) || null;

function setsText(sets) {
  const ws = new Set(sets.map((s) => s.weight));
  if (ws.size === 1) {
    const w = sets[0].weight;
    return `${sets.map((s) => s.reps).join(' / ')} × ${fmtW(w)}${w ? ' kg' : ''}`;
  }
  return sets.map((s) => `${s.reps}×${fmtW(s.weight)}`).join(', ');
}

function weekLabel(p) {
  const w = L.weekOf(p.startDate, today());
  if (w < 1) return `Starts ${L.fmtDate(p.startDate)}`;
  if (w > p.weeks) return 'Finished';
  return `Week ${w} of ${p.weeks}`;
}

// Every run type is judged on pace (faster = better); within 2 s/km counts as the same.
function runDir(a, b) {
  if (!a || !b) return 'same';
  const d = L.paceOf(a) - L.paceOf(b);
  return Math.abs(d) < 2 ? 'same' : d < 0 ? 'up' : 'down';
}

// ---------- router ----------

function route() {
  const h = location.hash.slice(2) || 'today';
  const [name, q] = h.split('?');
  return { name, params: Object.fromEntries(new URLSearchParams(q || '')) };
}

function go(name, params) {
  const q = params && Object.keys(params).length ? '?' + new URLSearchParams(params) : '';
  const h = '#/' + name + q;
  if (location.hash === h) render(true);
  else location.hash = h;
}

window.addEventListener('hashchange', () => {
  ui.sheet = null;
  ui.showAll = false;
  render(true);
});

const VIEWS = {
  today: vToday, train: vTrain, summary: vSummary, week: vWeek, workout: vWorkout, run: vRun,
  progress: vProgress, exercise: vExercise, runtype: vRunType, programs: vPrograms,
  newprogram: vNewProgram, archive: vArchive, program: vProgramDetail,
};
const TAB_OF = {
  today: 'today', summary: 'today', week: 'week', workout: 'week', programs: 'week', newprogram: 'week',
  program: 'progress', run: 'run', progress: 'progress', exercise: 'progress', runtype: 'progress', archive: 'progress',
};

function render(toTop) {
  const r = route();
  // #/demo is a shortcut that reloads fresh demo data (asks first if there's data already).
  if (r.name === 'demo') {
    history.replaceState(null, '', '#/today');
    A.loadDemo().finally(() => render(true));
    return;
  }
  let view = VIEWS[r.name] || vToday;
  if (r.name === 'train' && !S.active) view = vToday;
  if (!Sync.getSession()) {
    $app.className = 'full';
    $app.innerHTML = vLogin();
    renderSheet();
    return;
  }
  const full = view === vTrain;
  $app.className = full ? 'full' : '';
  $app.innerHTML = '<div id="syncnote" class="small missc" hidden></div>' + view(r.params) + (full ? '' : nav(TAB_OF[r.name] || 'today'));
  syncNote();
  if (toTop) window.scrollTo(0, 0);
  renderSheet();
}

function nav(active) {
  const tabs = [['today', 'Today', I.today], ['week', 'Program', I.week], ['run', 'Run', I.run], ['progress', 'Progress', I.chart]];
  return `<nav class="nav" aria-label="Main"><div class="nav-inner">${tabs
    .map(([k, l, ic]) => `<a href="#/${k}" data-act="tab" data-to="${k}" class="${k === 'run' ? 'runtab' : ''}" ${active === k ? 'aria-current="page"' : ''}>${ic}${l}</a>`)
    .join('')}</div></nav>`;
}

// ---------- sheet ----------

function openSheet(fn) {
  ui.sheet = fn;
  renderSheet();
}
function closeSheet() {
  ui.sheet = null;
  renderSheet();
}
function renderSheet() {
  $sheet.innerHTML = ui.sheet
    ? `<div class="backdrop" data-act="closeSheet"></div><div class="sheet" role="dialog" aria-modal="true"><div class="grab"></div>${ui.sheet()}</div>`
    : '';
}

// The number in the middle is a real input, so any value can be typed as well as nudged.
// `obj` names the ui object it writes to (ui.miss, ui.tgt).
const stepper = (act, field, val, label, cls, obj) => `
  <div class="stepper">
    <button type="button" data-act="${act}" data-f="${field}" data-d="-1" aria-label="Less ${label}">−</button>
    <input class="val ${cls || ''}" value="${val}" inputmode="${field === 'reps' ? 'numeric' : 'decimal'}" data-input="typed" data-obj="${obj}" data-f="${field}" aria-label="${label}">
    <button type="button" data-act="${act}" data-f="${field}" data-d="1" aria-label="More ${label}">+</button>
  </div>`;

const backBtn = (to) => `<button class="iconbtn" data-act="${to ? 'go' : 'back'}" ${to ? `data-to="${to}"` : ''} aria-label="Back">${I.back}</button>`;

// =====================================================================
// Views
// =====================================================================

function vLogin() {
  return `
    <div class="grow"></div>
    <div class="stack4"><div class="eyebrow">Sort It Out</div><h1>Sign in</h1>
      <div class="sub">Enter your code. You’ll stay signed in on this phone.</div></div>
    <form class="stack" data-submit="login" autocomplete="off" style="gap:12px">
      <input class="input num" name="code" type="password" inputmode="numeric" pattern="[0-9]*" required aria-label="Your code" style="height:68px;font-size:34px;letter-spacing:.25em">
      <div class="small missc" id="loginerr" hidden></div>
      <button class="btn btn-primary" type="submit">Sign in</button>
    </form>
    <div class="grow" style="flex-grow:2"></div>`;
}

function vToday() {
  const p = cur();
  if (!p) {
    const had = S.programs.length > 0;
    return `
      <div class="stack4"><div class="eyebrow">${DAY_LONG[todayKey()]}</div><h1>${had ? 'No program running' : 'Welcome'}</h1></div>
      <p class="sub">${had
        ? 'Your last program is in the Archive. Start the next one when you’re ready.'
        : 'Set up your week once: which workout or run goes on which day. Then just open the app and tap Start.'}</p>
      <button class="btn btn-primary" data-act="go" data-to="newprogram">${had ? 'Start next program' : 'Set up my program'}</button>
      ${had ? '<button class="btn btn-ghost" data-act="go" data-to="archive">Open Archive</button>' : '<button class="btn btn-ghost" data-act="loadDemo">Try it with demo data first</button>'}`;
  }

  const key = ui.day || todayKey();
  const d = planDays(p)[key];
  const w = d.workout ? p.workouts[d.workout] : null;
  const finished = L.weekOf(p.startDate, today()) > p.weeks;
  const notToday = ui.day && ui.day !== todayKey();

  let h = `${notToday ? (ui.dayFrom === 'week' ? `<button class="backtoday" data-act="backWeek">${I.back} My week</button>` : `<button class="backtoday" data-act="cancelDay">${I.close} Cancel</button>`) : ''}
    <div class="stack4">
      <div class="eyebrow">${DAY_LONG[key]}${notToday ? ' (picked)' : ''} · ${esc(weekLabel(p))}</div>
      <h1>${esc(w ? w.name : d.run ? RUN[d.run] : 'Rest day')}</h1>
    </div>`;

  if (finished) {
    h += `<div class="card">
        <div class="eyebrow lift">Program complete</div>
        <div class="sub">${esc(p.name)} has finished its ${p.weeks} weeks. Start the next one and this one moves to the Archive.</div>
        <button class="btn btn-primary" data-act="go" data-to="newprogram">Start next program</button>
      </div>`;
  }
  if (S.active) h += `<button class="btn btn-primary" data-act="go" data-to="train">Resume workout</button>`;

  const ws = weekStatus(p);
  const liftDone = ws.slots.find((s) => s.day === key && s.kind === 'lift' && s.doneOn);
  const runDone = ws.slots.find((s) => s.day === key && s.kind === 'run' && s.doneOn);
  // Everything finished today stays on screen, whichever day it was planned for,
  // so doing another day's workout or a run adds to the list instead of replacing it.
  h += S.sessions.filter((s) => s.date === today()).map(sessionCard).join('');
  h += S.runs.filter((r) => r.date === today()).map(runCard).join('');

  const repeatNote = (s) => `<div class="hrow small lift" style="gap:6px;margin-top:-4px">${svg('<path d="M5 12.5l4.5 4.5L19 7.5"/>', 16, 3)}
    Done ${s.doneOn === today() ? 'today' : DAY_LONG[DAYS[(L.parseDate(s.doneOn).getDay() + 6) % 7]]} · doing it again adds another session</div>`;

  if (w && liftDone && !notToday) {
    // Today's own workout already done this week (today's are shown above): no targets or Start.
    if (liftDone.ref.date !== today()) h += sessionCard(liftDone.ref);
  } else if (w) {
    // A picked day can always be done, even if it was done earlier this week.
    if (liftDone) h += repeatNote(liftDone);
    if (!w.items.length) {
      h += `<div class="empty">No exercises in ${esc(w.name)} yet.</div>
        <button class="btn btn-ghost" data-act="go" data-to="workout" data-id="${w.id}">Add exercises</button>`;
    } else {
      h += `<div class="stack">${w.items
        .map((it) => {
          const t = targetFor(it.exId, it);
          return `<div class="row exrow"><div><div class="name">${esc(exName(it.exId))}</div><div class="meta">${it.sets} sets · ${it.min}–${it.max} reps</div></div>
            <div class="big">${L.repsText(t.sets)} × ${fmtW(t.weight)}${kgUnit(t.weight)}</div></div>`;
        })
        .join('')}</div>`;
      if (!S.active) h += `<button class="btn btn-primary" data-act="start" data-id="${w.id}">Start workout</button>`;
      if (!S.active && notToday) h += `<button class="btn btn-ghost" data-act="cancelDay">Cancel</button>`;
      if (!S.active && !notToday) h += `<button class="linkbtn skipbtn" data-act="askSkip" data-kind="lift">Skip ${esc(w.name)} today</button>`;
    }
  }

  if (d.run && runDone && !notToday) {
    if (runDone.ref.date !== today()) h += runCard(runDone.ref);
  } else if (d.run) {
    if (runDone) h += repeatNote(runDone);
    const last = lastRun(d.run);
    h += `<div class="card">
        <div class="spread" style="align-items:center"><span class="tag run">${RUN[d.run]}</span>
        ${last ? `<span class="small">Last: ${L.fmtKm(last.distKm)} km · ${L.fmtDuration(L.paceOf(last))}/km</span>` : ''}</div>
        <button class="btn btn-run" data-act="logRun" data-type="${d.run}">Log run</button>
        ${notToday ? '' : `<button class="linkbtn skipbtn" data-act="askSkip" data-kind="run" style="margin:-4px 0 -8px">Skip ${RUN[d.run].toLowerCase()} today</button>`}
      </div>`;
  }

  if (!w && !d.run) {
    h += `<p class="sub">Nothing planned${notToday ? '' : ' today'}.</p>
      <button class="btn btn-ghost" data-act="daySheet" data-day="${key}">Plan ${DAY_LONG[key]}</button>`;
  }
  // What's still to do this week, for reference only (change days on Program → This week).
  const left = ws.slots.filter((s) => !s.doneOn && s.day !== key);
  if (left.length && !finished) {
    h += `<div class="stack4" style="margin-top:4px"><div class="eyebrow">Left this week</div>
      <div class="tags" style="gap:8px">${left.map((s) => `<span class="tag ${s.kind === 'run' ? 'run' : 'lift'} todo">${esc(s.name)} <span style="font-weight:500;opacity:.75">${DAY_LONG[s.day].slice(0, 3)}</span></span>`).join('')}</div></div>`;
  }
  h += `<button class="btn btn-ghost" data-act="pickDay">Do a different day</button>`;
  return h;
}

const doneWhen = (iso) => (iso === today() ? 'today' : `on ${DAY_LONG[DAYS[(L.parseDate(iso).getDay() + 6) % 7]]}`);
const tickIcon = () => svg('<path d="M5 12.5l4.5 4.5L19 7.5"/>', 22, 3);

// A finished workout: what was done on each exercise.
function sessionCard(s) {
  const sets = s.entries.reduce((n, e) => n + e.sets.length, 0);
  return `<div class="card done">
      <div class="hrow lift" style="gap:8px"><span>${tickIcon()}</span><span class="cond grow" style="font-size:26px">${esc(s.workoutName)} complete</span>
        <button class="iconbtn delbtn" data-act="askDelSession" data-id="${s.id}" aria-label="Delete ${esc(s.workoutName)}">${I.bin}</button></div>
      <div class="small">Done ${doneWhen(s.date)} · ${sets} sets · ${s.minutes} min</div>
      <div class="stack4">${s.entries.map((e) => `<div class="line-item" style="padding:9px 0;min-height:0"><span>${esc(exName(e.exId))}</span><span class="muted">${esc(setsText(e.sets))}</span></div>`).join('')}</div>
    </div>`;
}

function runCard(r) {
  return `<div class="card done">
      <div class="hrow runc" style="gap:8px"><span>${tickIcon()}</span><span class="cond grow" style="font-size:24px">${RUN[r.type]} logged</span>
        <button class="iconbtn delbtn" data-act="askDelRun" data-id="${r.id}" aria-label="Delete ${RUN[r.type].toLowerCase()}">${I.bin}</button></div>
      <div class="small">Done ${doneWhen(r.date)} · ${L.fmtKm(r.distKm)} km in ${L.fmtDuration(r.timeSec)} · ${L.fmtDuration(L.paceOf(r))}/km</div>
    </div>`;
}

// Confirmation panel: ui.ask = { title, body, yes, act, id }
function sAsk() {
  const a = ui.ask;
  return `
    <div class="stack4"><h2>${esc(a.title)}</h2><div class="sub">${esc(a.body)}</div></div>
    <div class="grid2">
      <button class="btn btn-ghost" data-act="closeSheet">Cancel</button>
      <button class="btn btn-delete" data-act="${a.act}" data-id="${a.id}">${esc(a.yes)}</button>
    </div>`;
}

// Remove a logged workout. Exercises it moved on get their previous target back,
// as long as nothing newer has been logged for them since.
function deleteSession(id) {
  const s = S.sessions.find((x) => x.id === id);
  if (!s) return;
  S.sessions = S.sessions.filter((x) => x !== s);
  for (const e of s.entries) {
    const newer = S.sessions.some((x) => x.date >= s.date && x.entries.some((y) => y.exId === e.exId));
    if (!newer && e.target) S.targets[e.exId] = { weight: e.target.weight, reps: e.target.reps, sets: e.target.sets, miss: 0 };
  }
}

function sPickDay() {
  const p = cur();
  return `<h2>Which day?</h2><div class="stack">${DAYS.map((k) => {
    const d = planDays(p)[k];
    const w = d.workout && p.workouts[d.workout];
    const label = [w && w.name, d.run && RUN[d.run]].filter(Boolean).join(' + ') || 'Rest';
    return `<button class="row ${k === todayKey() ? 'today' : ''}" data-act="setDay" data-day="${k}"><span class="name">${DAY_LONG[k]}</span><span class="small">${esc(label)}</span></button>`;
  }).join('')}</div>`;
}

// ---------- active workout ----------

function vTrain() {
  const a = S.active;
  const it = a.items[a.ex];
  const t = targetFor(it.exId, it);
  const logs = a.logs[it.k] || [];
  const prev = exSessions(it.exId).at(-1);
  const bars = Array.from({ length: Math.max(it.sets, logs.length) }, (_, i) =>
    i < logs.length ? (logs[i].hit ? 'hit' : 'missed') : i === logs.length ? 'now' : '');

  return `
    <div class="spread" style="align-items:center">
      <button class="iconbtn" data-act="endWorkout" aria-label="End workout">${I.close}</button>
      <button class="linkbtn" data-act="pickEx" style="color:var(--muted);font-weight:500">Exercise ${a.ex + 1} of ${a.items.length}</button>
      <button class="iconbtn" data-act="pickEx" aria-label="Choose which exercise to do next">${I.list}</button>
    </div>
    <div class="stack4">
      <h1>${esc(exName(it.exId))}</h1>
      <div class="sub">Range ${it.min}–${it.max} reps · ${prev ? `last time ${esc(setsText(prev.sets))}` : 'first time'}</div>
    </div>
    <div class="setbars" aria-hidden="true">${bars.map((c) => `<span class="${c}"></span>`).join('')}</div>
    <div class="setcard">
      <div class="eyebrow">Set ${logs.length + 1} of ${it.sets}</div>
      <div class="setnum"><span class="n">${setReps(t, logs.length)}</span><span class="x">×</span><span class="n">${fmtW(t.weight)}</span></div>
      <div class="setlabels"><span>reps</span><span>${t.weight ? 'kg' : 'bodyweight'}</span></div>
      ${logs.length ? `<button class="linkbtn" data-act="editActive" data-k="${it.k}" style="margin-top:8px;color:var(--muted);font-weight:500">Done: ${esc(setsText(logs))} · <span class="lift">&nbsp;Edit</span></button>` : ''}
    </div>
    <div class="actions">
      <button class="btn-miss" data-act="missed">Different</button>
      <button class="btn-done" data-act="done">${I.check}Done</button>
    </div>
    ${a.hist.length ? '<button class="linkbtn" data-act="undo">Undo last set</button>' : ''}`;
}

// Logs are keyed by each item's `k` (not its position) so skipped exercises can move to the end.
function sQueue() {
  const a = S.active;
  return `
    <div class="stack4"><h2>What's next?</h2><div class="sub">Tap any exercise to do it now. Sets you've done are kept.</div></div>
    <div class="stack">${a.items.map((it, i) => {
      const done = (a.logs[it.k] || []).length;
      const status = `${done}/${it.sets} sets`;
      if (i < a.ex) {
        return `<button class="row" data-act="editActive" data-k="${it.k}"><span class="name muted">${esc(exName(it.exId))}</span><span class="hrow small" style="gap:6px"><span class="lift">${svg('<path d="M5 12.5l4.5 4.5L19 7.5"/>', 18, 3)}</span>Done · edit</span></button>`;
      }
      if (i === a.ex) {
        return `<div class="row" style="box-shadow: inset 0 0 0 2px ${LIME}"><span class="name">${esc(exName(it.exId))}</span><span class="small lift">Now · ${status}</span></div>`;
      }
      return `<button class="row" data-act="jumpEx" data-i="${i}"><span class="name">${esc(exName(it.exId))}</span><span class="small">${status}</span></button>`;
    }).join('')}</div>
    <button class="btn btn-ghost" data-act="closeSheet">Keep going with ${esc(exName(a.items[a.ex].exId))}</button>`;
}

// Edit logged sets: used during a workout and for past sessions.
// ui.es = { title, sub, sets: [{reps, weight}], step, save(sets) }
function sEditSets() {
  const es = ui.es;
  const mini = (i, f, v) => `
    <div class="mini">
      <button type="button" data-act="esStep" data-i="${i}" data-f="${f}" data-d="-1" aria-label="Less ${f}">−</button>
      <input value="${v}" inputmode="${f === 'reps' ? 'numeric' : 'decimal'}" data-input="typed" data-obj="es" data-i="${i}" data-f="${f}" aria-label="Set ${i + 1} ${f}">
      <button type="button" data-act="esStep" data-i="${i}" data-f="${f}" data-d="1" aria-label="More ${f}">+</button>
    </div>`;
  return `
    <div class="stack4"><h2>${esc(es.title)}</h2><div class="sub">${esc(es.sub)}</div></div>
    <div class="setedit small"><span></span><span class="center">Reps</span><span class="center">kg</span><span></span></div>
    <div class="stack">${es.sets.map((s, i) => `
      <div class="setedit"><span class="small">${i + 1}</span>${mini(i, 'reps', s.reps)}${mini(i, 'weight', s.weight)}
        <button class="iconbtn" data-act="esDel" data-i="${i}" aria-label="Delete set ${i + 1}">${I.close}</button></div>`).join('')}
      ${es.sets.length ? '' : '<div class="empty">No sets. Saving removes this exercise from the session.</div>'}
    </div>
    <button class="btn btn-ghost btn-small" data-act="esAdd">+ Add a set</button>
    <button class="btn btn-primary" data-act="esSave">Save changes</button>`;
}

function openSetEditor(title, sub, sets, step, onSave) {
  ui.es = { title, sub, sets: sets.map((s) => ({ ...s })), step, save: onSave };
  openSheet(sEditSets);
}

function logSet(set) {
  const a = S.active;
  const it = a.items[a.ex];
  (a.logs[it.k] = a.logs[it.k] || []).push(set);
  a.hist.push(it.k);
  if (a.logs[it.k].length >= it.sets) a.ex++;
  if (a.ex >= a.items.length) return finishWorkout();
  save();
  render(true);
}

const vsCls = (v, target) => (v > target ? 'lift' : v < target ? 'missc' : '');

function sMissed() {
  const m = ui.miss;
  return `
    <div class="stack4"><h2>What did you get?</h2><div class="sub">Target was ${m.t.reps} × ${fmtW(m.t.weight)}${m.t.weight ? ' kg' : ''}</div></div>
    <div class="stack"><div class="eyebrow">Reps</div>${stepper('mstep', 'reps', m.reps, 'reps', vsCls(m.reps, m.t.reps), 'miss')}</div>
    <div class="stack"><div class="eyebrow">Weight (kg)</div>${stepper('mstep', 'weight', m.weight, 'weight', vsCls(m.weight, m.t.weight), 'miss')}</div>
    <div class="small">More or less than the target — next time's target is built from what you actually did.</div>
    <button class="btn btn-primary" data-act="saveMissed">Save set</button>`;
}

function finishWorkout() {
  const a = S.active;
  const entries = [];
  a.items.forEach((it) => {
    const sets = a.logs[it.k];
    if (sets && sets.length) entries.push({ exId: it.exId, cfg: { sets: it.sets, min: it.min, max: it.max }, target: targetFor(it.exId, it), sets });
  });
  S.active = null;
  wake(false);
  if (!entries.length) {
    save();
    toast('Nothing logged');
    go('today');
    return;
  }
  const items = entries.map((e) => {
    const prev = S.targets[e.exId] || {};
    const nx = L.nextTarget(e.cfg, exStep(e.exId), e.target, e.sets, prev.miss || 0);
    S.targets[e.exId] = { weight: nx.weight, reps: nx.reps, sets: nx.sets, miss: nx.miss };
    return { exId: e.exId, dir: nx.dir, why: nx.why };
  });
  const minutes = Math.max(1, Math.round((Date.now() - a.started) / 60000));
  S.sessions.push({ id: uid(), date: a.date, programId: a.programId, workoutId: a.workoutId, workoutName: a.workoutName, minutes, entries });
  ui.day = null; // back on Today, everything done today is listed together
  S.lastSummary = { name: a.workoutName, sets: entries.reduce((n, e) => n + e.sets.length, 0), minutes, items };
  save();
  go('summary');
}

function vSummary() {
  const s = S.lastSummary;
  if (!s) return vToday();
  return `
    <div class="stack4">
      <div style="width:56px;height:56px;border-radius:16px;background:${LIME};color:#0E0F11;display:flex;align-items:center;justify-content:center">${I.check}</div>
      <h1 style="margin-top:12px">${esc(s.name)} done</h1>
      <div class="sub">${s.sets} sets · ${s.minutes} min</div>
    </div>
    <div class="eyebrow">Next time</div>
    <div class="stack">${s.items
      .map((x) => {
        const t = S.targets[x.exId] || { reps: 0, weight: 0 };
        const cls = dirCls(x.dir); // progress green, setbacks orange, holds grey
        return `<button class="row" data-act="editTarget" data-ex="${x.exId}">
          <div><div class="name">${esc(exName(x.exId))}</div><div class="meta ${cls}">${esc(x.why)}</div></div>
          <div class="hrow"><span class="big">${tReps(t)} × ${fmtW(t.weight)}</span>${arrow(x.dir)}</div></button>`;
      })
      .join('')}</div>
    <div class="small">Tap a row to change next time's target.</div>
    <div class="grow"></div>
    <button class="btn btn-primary" data-act="go" data-to="today">Finish</button>`;
}

function sTarget() {
  const t = ui.tgt;
  return `
    <div class="stack4"><h2>${esc(exName(t.exId))}</h2><div class="sub">Next target</div></div>
    <div class="stack"><div class="eyebrow">Reps</div>${stepper('tstep', 'reps', t.reps, 'reps', '', 'tgt')}<div class="small">Applies to every set.</div></div>
    <div class="stack"><div class="eyebrow">Weight (kg)</div>${stepper('tstep', 'weight', t.weight, 'weight', '', 'tgt')}</div>
    <button class="btn btn-primary" data-act="saveTarget">Save</button>`;
}

// ---------- weekly program ----------

// ---------- this week's changes ----------
// p.thisWeek = { mon: '<monday iso>', days: { mon: { workout, run }, ... } } holds this week's own
// copy of the days once you swap or change one. A new week ignores it, so the plan is untouched.

const weekMonday = () => L.addDays(today(), -((new Date().getDay() + 6) % 7));

function weekDays(p) {
  const t = p.thisWeek;
  if (!t || t.mon !== weekMonday()) return null;
  if (t.map && !t.days) { // older format: a day-to-day mapping
    t.days = Object.fromEntries(DAYS.map((k) => [k, { ...(p.days[t.map[k]] || {}) }]));
    delete t.map;
  }
  return t.days;
}

// This week's days, creating the copy on first change.
function ensureWeek(p) {
  if (!weekDays(p)) p.thisWeek = { mon: weekMonday(), days: Object.fromEntries(DAYS.map((k) => [k, { ...(p.days[k] || {}) }])) };
  return p.thisWeek.days;
}

function planDays(p) {
  const o = weekDays(p);
  return Object.fromEntries(DAYS.map((k) => [k, (o ? o[k] : p.days[k]) || {}]));
}

const weekChanged = (p) => {
  const o = weekDays(p);
  const same = (a = {}, b = {}) => (a.workout || null) === (b.workout || null) && (a.run || null) === (b.run || null);
  return !!o && DAYS.some((k) => !same(o[k], p.days[k]));
};

// This week's plan matched against what was actually logged. A planned workout or run
// counts as done when it was logged on ANY day this week, so swapping days is no problem.
function weekStatus(p) {
  const mon = L.addDays(today(), -((new Date().getDay() + 6) % 7));
  const sun = L.addDays(mon, 6);
  const inWeek = (x) => x.date >= mon && x.date <= sun;
  const sessions = S.sessions.filter(inWeek);
  const runs = S.runs.filter(inWeek);
  const usedS = new Set(), usedR = new Set();
  const slots = [];
  const days = planDays(p);
  DAYS.forEach((k, i) => {
    const d = days[k];
    const date = L.addDays(mon, i);
    if (d.workout && p.workouts[d.workout]) {
      const s = sessions.find((x) => x.workoutId === d.workout && !usedS.has(x.id));
      if (s) usedS.add(s.id);
      slots.push({ day: k, date, kind: 'lift', key: d.workout, name: p.workouts[d.workout].name, doneOn: s ? s.date : null, ref: s || null });
    }
    if (d.run) {
      const r = runs.find((x) => x.type === d.run && !usedR.has(x.id));
      if (r) usedR.add(r.id);
      slots.push({ day: k, date, kind: 'run', key: d.run, name: RUN[d.run], doneOn: r ? r.date : null, ref: r || null });
    }
  });
  const extras = [
    ...sessions.filter((s) => !usedS.has(s.id)).map((s) => ({ kind: 'lift', name: s.workoutName, date: s.date })),
    ...runs.filter((r) => !usedR.has(r.id)).map((r) => ({ kind: 'run', name: RUN[r.type], date: r.date })),
  ];
  return { mon, sun, slots, extras };
}

const dayShort = (iso) => DAY_LONG[DAYS[(L.parseDate(iso).getDay() + 6) % 7]].slice(0, 3);

function slotTag(s) {
  const kind = s.kind === 'run' ? 'run' : 'lift';
  if (s.doneOn) {
    const moved = s.doneOn !== s.date ? ` <span style="font-weight:500;opacity:.8">(${dayShort(s.doneOn)})</span>` : '';
    return `<span class="tag ${kind}">${svg('<path d="M5 12.5l4.5 4.5L19 7.5"/>', 14, 3)} ${esc(s.name)}${moved}</span>`;
  }
  if (s.date < today()) return `<span class="tag missed">${esc(s.name)} · missed</span>`;
  return `<span class="tag ${kind} todo">${esc(s.name)}</span>`;
}

function vThisWeek(p) {
  const ws = weekStatus(p);
  const done = ws.slots.filter((s) => s.doneOn).length;
  const left = ws.slots.filter((s) => !s.doneOn && s.date >= today());
  return `
    <div class="sub">${esc(L.fmtDate(ws.mon))} – ${esc(L.fmtDate(ws.sun))} · <span class="${done === ws.slots.length && done ? 'lift' : ''}">${done} of ${ws.slots.length} done</span></div>
    ${left.length ? `<div class="small" style="margin-top:-10px">Left: ${left.map((s) => esc(s.name)).join(', ')}</div>` : ''}
    ${weekChanged(p) ? `<div class="hrow small" style="margin-top:-10px;gap:6px">Changed for this week <button class="linkbtn" data-act="resetWeek" style="padding:6px 0">Reset to plan</button></div>` : ''}
    <div class="stack" data-sortable="thisweek" data-mode="swap">${DAYS.map((k, i) => {
      const date = L.addDays(ws.mon, i);
      const past = date < today();
      const tags = ws.slots.filter((s) => s.day === k).map(slotTag).join('')
        + ws.extras.filter((x) => x.date === date).map((x) => `<span class="tag ${x.kind === 'run' ? 'run' : 'lift'}">${svg('<path d="M5 12.5l4.5 4.5L19 7.5"/>', 14, 3)} ${esc(x.name)} <span style="font-weight:500;opacity:.8">(extra)</span></span>`).join('');
      return `<button class="row ${k === todayKey() ? 'today' : ''} ${tags ? '' : 'dashed'}" data-idx="${i}" ${past ? 'data-locked' : ''} data-act="weekDay" data-day="${k}" style="justify-content:flex-start">
        <span class="stack4" style="gap:0;width:40px;flex-shrink:0"><span class="dayname">${k.toUpperCase()}</span><span class="small">${L.parseDate(date).getDate()}</span></span>
        ${tags ? `<span class="tags">${tags}</span>` : '<span class="small grow">Rest</span>'}
        ${past ? '' : `<span class="handle" data-handle aria-label="Drag onto another day to swap them this week">${I.grip}</span>`}</button>`;
    }).join('')}</div>
    <div class="small">Tap a coming day to change it, or drag ⠿ onto another day to swap — this week only, your plan stays the same. Any workout done on any day still ticks off its slot.</div>`;
}

// Change one coming day for this week only.
function sWeekDay() {
  const p = cur();
  const k = ui.wkDay;
  const d = planDays(p)[k];
  const date = L.addDays(weekMonday(), DAYS.indexOf(k));
  const opt = (id, name, meta) => {
    const on = (d.workout || '') === id;
    return `<button class="row" data-act="setWkWorkout" data-id="${id}" aria-pressed="${on}" style="${on ? `box-shadow: inset 0 0 0 2px ${LIME}` : ''}">
      <span><span class="name">${esc(name)}</span>${meta ? `<span class="meta" style="display:block">${esc(meta)}</span>` : ''}</span>
      ${on ? `<span class="lift">${svg('<path d="M5 12.5l4.5 4.5L19 7.5"/>', 22, 3)}</span>` : ''}</button>`;
  };
  return `
    <div class="stack4"><h2>${DAY_LONG[k]} ${L.parseDate(date).getDate()}</h2><div class="sub">This week only. Your plan stays the same.</div></div>
    <div class="stack"><div class="eyebrow">Workout</div>
      ${opt('', 'No workout')}
      ${Object.values(p.workouts).map((w) => opt(w.id, w.name, `${w.items.length} exercise${w.items.length === 1 ? '' : 's'}`)).join('')}
    </div>
    <div class="stack"><div class="eyebrow">Run</div>
      <div class="seg run">${[['', 'None'], ...RUN_TYPES.map((t) => [t, RUN_SHORT[t]])]
        .map(([v, l]) => `<button data-act="setWkRun" data-v="${v}" aria-pressed="${(d.run || '') === v}">${l}</button>`).join('')}</div>
    </div>
    <div class="grid2">
      <button class="btn btn-ghost" data-act="doDay" data-day="${k}" ${d.workout || d.run ? '' : 'disabled'}>Do it now</button>
      <button class="btn btn-primary" data-act="closeSheet" style="height:52px;font-size:22px">Done</button>
    </div>`;
}

function vWeek() {
  const p = cur();
  if (!p) {
    return `<h1>My week</h1><div class="empty">No program running.</div>
      <button class="btn btn-primary" data-act="go" data-to="newprogram">New program</button>
      <button class="btn btn-ghost" data-act="go" data-to="programs">Programs & Archive</button>`;
  }
  const tab = ui.weekTab || 'this';
  const head = `<div class="stack4"><h1>My week</h1><div class="small">${esc(p.name)} · ${esc(weekLabel(p))}</div></div>
    <div class="seg" role="tablist">
      <button role="tab" data-act="weekTab" data-v="this" aria-pressed="${tab === 'this'}" aria-selected="${tab === 'this'}">This week</button>
      <button role="tab" data-act="weekTab" data-v="plan" aria-pressed="${tab === 'plan'}" aria-selected="${tab === 'plan'}">Plan</button>
    </div>`;
  const foot = `<div class="grid2">
      <button class="btn btn-ghost" data-act="go" data-to="programs">Programs</button>
      <button class="btn btn-ghost" data-act="backup">Account</button>
    </div>`;
  if (tab === 'this') return head + vThisWeek(p) + foot;
  return head + `
    <div class="sub" style="margin-top:-8px">Your repeating week. Tap a day to change it, drag ⠿ onto another day to swap them for good.</div>
    <div class="stack" data-sortable="days" data-mode="swap">${DAYS.map((k, i) => {
      const d = p.days[k] || {};
      const w = d.workout && p.workouts[d.workout];
      const tags = (w ? `<span class="tag lift">${esc(w.name)}</span>` : '') + (d.run ? `<span class="tag run">${RUN[d.run]}</span>` : '');
      return `<button class="row ${tags ? '' : 'dashed'} ${k === todayKey() ? 'today' : ''}" data-idx="${i}" data-act="daySheet" data-day="${k}" style="justify-content:flex-start">
        <span class="dayname">${k.toUpperCase()}</span>${tags ? `<span class="tags">${tags}</span>` : '<span class="small grow">Rest · tap to add</span>'}
        <span class="handle" data-handle aria-label="Drag onto another day to swap">${I.grip}</span></button>`;
    }).join('')}</div>
    ${foot}`;
}

function sDay() {
  const p = cur();
  const k = ui.dayEdit;
  const d = p.days[k] || {};
  const ws = Object.values(p.workouts);
  const usedOn = (id) => DAYS.filter((x) => x !== k && p.days[x]?.workout === id).map((x) => DAY_LONG[x].slice(0, 3));
  const opt = (id, name, meta) => `
    <button class="row" data-act="setDayWorkout" data-id="${id}" aria-pressed="${(d.workout || '') === id}" style="${(d.workout || '') === id ? `box-shadow: inset 0 0 0 2px ${LIME}` : ''}">
      <span><span class="name">${esc(name)}</span>${meta ? `<span class="meta" style="display:block">${esc(meta)}</span>` : ''}</span>
      ${(d.workout || '') === id ? `<span class="lift">${svg('<path d="M5 12.5l4.5 4.5L19 7.5"/>', 22, 3)}</span>` : ''}
    </button>`;
  return `
    <h2>${DAY_LONG[k]}</h2>
    <div class="stack"><div class="eyebrow">Workout</div>
      ${opt('', 'No workout')}
      ${ws.map((w) => {
        const also = usedOn(w.id);
        return opt(w.id, w.name, `${w.items.length} exercise${w.items.length === 1 ? '' : 's'}${also.length ? ' · also ' + also.join(', ') : ''}`);
      }).join('')}
      <button class="row dashed" data-act="newWorkout">+ New workout</button>
    </div>
    <div class="stack"><div class="eyebrow">Run</div>
      <div class="seg run">${[['', 'None'], ...RUN_TYPES.map((t) => [t, RUN_SHORT[t]])]
        .map(([v, l]) => `<button data-act="setDayRun" data-v="${v}" aria-pressed="${(d.run || '') === v}">${l}</button>`).join('')}</div>
    </div>
    ${d.workout ? `<button class="btn btn-ghost" data-act="go" data-to="workout" data-id="${d.workout}">Edit ${esc(p.workouts[d.workout].name)}</button>` : ''}
    <button class="btn btn-primary" data-act="closeSheet" style="height:60px;font-size:24px">Done</button>`;
}

// ---------- edit workout ----------

function vWorkout(params) {
  const p = cur();
  const w = p && p.workouts[params.id];
  if (!w) return vWeek();
  const used = DAYS.filter((k) => p.days[k]?.workout === w.id).map((k) => DAY_LONG[k]).join(', ') || 'Not on any day yet';
  const names = Object.values(S.exercises).map((e) => e.name).sort((a, b) => a.localeCompare(b));
  return `
    <div class="hrow">${backBtn('week')}<div class="small">${esc(used)}</div></div>
    <label class="field">Workout name<input class="input" data-change="wname" data-id="${w.id}" value="${esc(w.name)}" style="font-family:var(--cond);font-size:26px;font-weight:700"></label>
    ${w.items.length > 1 ? '<div class="small" style="margin-bottom:-8px">Drag ⠿ to reorder · tap to edit</div>' : ''}
    <div class="stack" data-sortable="ex" data-wid="${w.id}">${w.items.length
      ? w.items.map((it, i) => {
          const t = targetFor(it.exId, it);
          return `<button class="row" data-idx="${i}" data-act="itemSheet" data-wid="${w.id}" data-i="${i}">
            ${w.items.length > 1 ? `<span class="handle" data-handle aria-label="Drag to reorder">${I.grip}</span>` : ''}
            <span class="name grow">${esc(exName(it.exId))}</span>
            <span class="small" style="white-space:nowrap">${it.sets} × ${it.min}–${it.max} · ${fmtW(t.weight)}${t.weight ? ' kg' : ''}</span></button>`;
        }).join('')
      : '<div class="empty">No exercises yet. Add the first one below.</div>'}</div>
    <form class="addform" data-submit="addEx" data-id="${w.id}" autocomplete="off">
      <div class="eyebrow">Add exercise</div>
      <label class="field">Name<input class="input" name="exname" list="exlist" data-input="exname" required placeholder="e.g. Machine fly" autocapitalize="sentences"></label>
      <datalist id="exlist">${names.map((n) => `<option value="${esc(n)}"></option>`).join('')}</datalist>
      <div class="grid4">
        <label class="field">Sets<input class="input num" name="sets" type="number" inputmode="numeric" min="1" max="20" value="3" required></label>
        <label class="field">Min reps<input class="input num" name="min" type="number" inputmode="numeric" min="1" max="100" value="10" required></label>
        <label class="field">Max reps<input class="input num" name="max" type="number" inputmode="numeric" min="1" max="100" value="15" required></label>
        <label class="field">kg<input class="input num" name="kg" type="text" inputmode="decimal" placeholder="0"></label>
      </div>
      <label class="hrow small" style="justify-content:space-between">When you hit the top of the range, add
        <span class="hrow" style="gap:8px"><input class="input num" name="step" type="text" inputmode="decimal" value="2.5" style="width:84px;height:46px" aria-label="Weight jump in kg">kg</span></label>
      <div class="small" id="exhint"></div>
      <button class="btn btn-primary" type="submit" style="height:58px;font-size:24px">Add</button>
    </form>
    <button class="btn btn-danger btn-small" data-act="delWorkout" data-id="${w.id}">Delete this workout</button>`;
}

function sItem() {
  const p = cur();
  const w = p.workouts[ui.item.wid];
  const it = w.items[ui.item.i];
  const ex = S.exercises[it.exId];
  const t = targetFor(it.exId, it);
  const last = ui.item.i === w.items.length - 1;
  return `
    <h2>${esc(ex.name)}</h2>
    <form class="stack" data-submit="saveItem" style="gap:14px" autocomplete="off">
      <label class="field">Name (changes it everywhere)<input class="input" name="exname" value="${esc(ex.name)}" required></label>
      <div class="grid3">
        <label class="field">Sets<input class="input num" name="sets" type="number" inputmode="numeric" min="1" max="20" value="${it.sets}" required></label>
        <label class="field">Min reps<input class="input num" name="min" type="number" inputmode="numeric" min="1" max="100" value="${it.min}" required></label>
        <label class="field">Max reps<input class="input num" name="max" type="number" inputmode="numeric" min="1" max="100" value="${it.max}" required></label>
      </div>
      <div class="grid3">
        <label class="field">Next kg<input class="input num" name="kg" type="text" inputmode="decimal" value="${t.weight}"></label>
        <label class="field">Next reps<input class="input num" name="reps" type="number" inputmode="numeric" min="1" max="100" value="${t.reps}"></label>
        <label class="field">Weekly jump (kg)<input class="input num" name="step" type="text" inputmode="decimal" value="${ex.step}"></label>
      </div>
      <button class="btn btn-primary" type="submit" style="height:58px;font-size:24px">Save</button>
    </form>
    <div class="grid2">
      <button class="btn btn-ghost btn-small" data-act="moveItem" data-d="-1" ${ui.item.i === 0 ? 'disabled' : ''}>Move up</button>
      <button class="btn btn-ghost btn-small" data-act="moveItem" data-d="1" ${last ? 'disabled' : ''}>Move down</button>
    </div>
    <button class="btn btn-danger btn-small" data-act="removeItem">Remove from this workout</button>`;
}

// ---------- runs ----------

function vRun(params) {
  if (!ui.runForm) {
    const planned = cur()?.days[todayKey()]?.run;
    ui.runForm = { type: params.type || planned || 'easy', date: today(), dist: '', time: '', pace: '', order: [] };
  }
  const f = ui.runForm;
  const recent = S.runs.slice().sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
  return `
    <div class="stack4"><div class="eyebrow">${f.date === today() ? 'Today' : esc(L.fmtDate(f.date, { weekday: 'long' }))}</div><h1>Log a run</h1></div>
    <div class="seg run" role="group" aria-label="Run type">${RUN_TYPES
      .map((t) => `<button data-act="runType" data-v="${t}" aria-pressed="${f.type === t}">${RUN_SHORT[t]}</button>`).join('')}</div>
    <div class="grid2">
      <label class="bigfield">Distance (km)<input data-input="runf" data-f="dist" inputmode="decimal" placeholder="0.0" value="${esc(f.dist)}"></label>
      <label class="bigfield">Time<input data-input="runf" data-f="time" inputmode="decimal" placeholder="mm:ss" value="${esc(f.time)}"></label>
    </div>
    <label class="bigfield pace" style="flex-direction:row;align-items:center;justify-content:space-between">Pace /km
      <input data-input="runf" data-f="pace" inputmode="decimal" placeholder="m:ss" value="${esc(f.pace)}" style="text-align:right;width:160px"></label>
    <div class="small" style="margin-top:-6px">Fill in any two and the third works itself out. Type 28.30 for 28:30, or 1.05.00 for an hour and 5.</div>
    <label class="field">Date<input class="input" type="date" data-input="runf" data-f="date" value="${f.date}" max="${today()}"></label>
    <div id="runcmp">${runCompareHtml()}</div>
    <button class="btn btn-run" data-act="saveRun">Save run</button>
    ${recent.length ? `<div class="stack4" style="margin-top:8px"><div class="eyebrow">Recent runs</div>${recent.map(runLine).join('')}</div>` : ''}`;
}

const runLine = (r) => `
  <button class="line-item" data-act="runSheet" data-id="${r.id}">
    <span class="hrow"><span class="tag run">${RUN_SHORT[r.type]}</span><span class="small">${esc(L.fmtDate(r.date, { weekday: 'short' }))}</span></span>
    <span style="font-size:16px">${L.fmtKm(r.distKm)} km · ${L.fmtDuration(L.paceOf(r))}/km</span>
  </button>`;

function signedTime(v) {
  const a = Math.abs(v);
  return `${v < 0 ? '−' : '+'}${a < 60 ? Math.round(a) + ' s' : L.fmtDuration(a)}`;
}

function runCompareHtml() {
  const f = ui.runForm;
  const last = lastRun(f.type);
  if (!last) return `<div class="small">First ${RUN[f.type].toLowerCase()} logged here — next time you'll see how it compares.</div>`;
  const d = L.parseKm(f.dist), t = L.parseDuration(f.time);
  const head = `Last ${RUN_SHORT[f.type].toLowerCase()} run · ${esc(L.fmtDate(last.date))}`;
  if (!d || !t) {
    return `<div class="card"><div class="eyebrow">${head}</div>
      <div class="sub">${L.fmtKm(last.distKm)} km in ${L.fmtDuration(last.timeSec)} · ${L.fmtDuration(L.paceOf(last))}/km</div></div>`;
  }
  const dd = d - last.distKm, dt = t - last.timeSec, dp = t / d - L.paceOf(last);
  const cell = (label, txt, dir) => {
    const color = dir === 'up' ? LIME : dir === 'down' ? ORANGE : 'var(--text)';
    return `<div class="stack4"><div class="small">${label}</div><div class="hrow" style="gap:6px;font-size:17px;font-weight:600;color:${color}">${arrow(dir)}${txt}</div></div>`;
  };
  const dDir = Math.abs(dd) < 0.05 ? 'same' : dd > 0 ? 'up' : 'down';
  const pDir = Math.abs(dp) < 2 ? 'same' : dp < 0 ? 'up' : 'down';
  return `<div class="card"><div class="eyebrow">vs ${head}</div><div class="grid3">
    ${cell('Distance', dDir === 'same' ? 'Same' : `${dd > 0 ? '+' : '−'}${L.fmtKm(Math.abs(dd))} km`, dDir)}
    ${cell('Time', Math.abs(dt) < 1 ? 'Same' : signedTime(dt), dDir === 'same' ? pDir : 'same')}
    ${cell('Pace', pDir === 'same' ? 'Same' : signedTime(dp), pDir)}
  </div></div>`;
}

function sRun() {
  const r = S.runs.find((x) => x.id === ui.runId);
  if (!r) return '<h2>Run not found</h2>';
  return `
    <div class="stack4"><h2>Edit run</h2><div class="sub">Pace is worked out from distance and time.</div></div>
    <form class="stack" data-submit="saveRunEdit" style="gap:14px" autocomplete="off">
      <div class="seg run">${RUN_TYPES.map((t) => `<button type="button" data-act="runEditType" data-v="${t}" aria-pressed="${r.type === t}">${RUN_SHORT[t]}</button>`).join('')}</div>
      <div class="grid2">
        <label class="field">Distance (km)<input class="input num" name="dist" inputmode="decimal" value="${L.fmtKm(r.distKm)}"></label>
        <label class="field">Time<input class="input num" name="time" inputmode="decimal" value="${L.fmtDuration(r.timeSec)}"></label>
      </div>
      <label class="field">Date<input class="input" type="date" name="date" value="${r.date}" max="${today()}"></label>
      <button class="btn btn-run" type="submit">Save changes</button>
    </form>
    <button class="btn btn-danger btn-small" data-act="delRun">Delete this run</button>`;
}

// ---------- progress ----------

const RANGES = [['1m', '1M', 30], ['3m', '3M', 91], ['6m', '6M', 182], ['1y', '1Y', 365], ['all', 'All', 0]];
const RANGE_TEXT = { '1m': 'last month', '3m': 'last 3 months', '6m': 'last 6 months', '1y': 'last year', all: 'all time' };

function rangeStart() {
  const r = RANGES.find((x) => x[0] === ui.range);
  return r && r[2] ? L.addDays(today(), -r[2]) : null;
}
function inRange(list) {
  const s = rangeStart();
  return s ? list.filter((x) => x.date >= s) : list;
}
const rangeSeg = () => `<div class="seg" role="group" aria-label="Time period">${RANGES
  .map(([k, l]) => `<button data-act="setRange" data-v="${k}" aria-pressed="${ui.range === k}">${l}</button>`).join('')}</div>`;

const dirCls = (dir) => (dir === 'up' ? 'lift' : dir === 'down' ? 'missc' : '');

// First vs last session inside the period (list is oldest first).
// The arrow is decided by estimated one-rep max, so weight and reps both count
// (e.g. 6 × 50 → 14 × 47.5 is up). Under 1% either way counts as no change.
// A weight increase still counts as up after the usual rep reset (15 × 40 → 10 × 42.5),
// unless the estimate fell by more than 8%.
function liftChange(ss) {
  if (ss.length < 2) return null;
  const a = L.bestSet(ss[0].sets), b = L.bestSet(ss.at(-1).sets);
  const ea = L.e1rm(ss[0].sets), eb = L.e1rm(ss.at(-1).sets);
  let dir = Math.abs(eb - ea) < ea * 0.01 ? 'same' : eb > ea ? 'up' : 'down';
  if (b.weight > a.weight && eb > ea * 0.92) dir = 'up';
  return { dir, a, b, ea, eb };
}
// Both parts of the change side by side, e.g. "+2.5 kg   −5 reps".
function liftChangeText(c) {
  if (!c) return '';
  const parts = [];
  const d = L.round(c.b.weight - c.a.weight);
  if (d) parts.push(`${d > 0 ? '+' : '−'}${Math.abs(d)} kg`);
  const r = c.b.reps - c.a.reps;
  if (r) parts.push(`${r > 0 ? '+' : '−'}${Math.abs(r)} rep${Math.abs(r) === 1 ? '' : 's'}`);
  return parts.length ? `<span class="chg">${parts.map((p) => `<span>${p}</span>`).join('')}</span>` : 'no change';
}

// Every run type is judged on pace (faster = better); within 2 s/km counts as the same.
function runChange(rs) {
  if (rs.length < 2) return null;
  return { dir: runDir(rs.at(-1), rs[0]), a: rs[0], b: rs.at(-1) };
}
function runChangeText(type, c) {
  if (!c) return '';
  const d = L.paceOf(c.b) - L.paceOf(c.a);
  return Math.abs(d) < 2 ? 'no change' : `${Math.round(Math.abs(d))} s/km ${d < 0 ? 'faster' : 'slower'}`;
}

// Line chart on a real date axis from the start of the period to today.
function timeChart(points, { color, invert, fmt, label }) {
  const W = 320, H = 160, PL = 44, PR = 12, PT = 12, PB = 26;
  const start = rangeStart() || points[0].date;
  const t0 = L.parseDate(start).getTime();
  const t1 = L.parseDate(today()).getTime();
  const span = Math.max(t1 - t0, 86400000);
  const vals = points.map((p) => p.v);
  let min = Math.min(...vals), max = Math.max(...vals);
  if (max - min < 1e-9) {
    const pad = Math.max(Math.abs(max) * 0.05, 1);
    min -= pad;
    max += pad;
  }
  const x = (d) => PL + ((W - PL - PR) * (L.parseDate(d).getTime() - t0)) / span;
  const y = (v) => {
    const f = (v - min) / (max - min);
    return PT + (H - PT - PB) * (invert ? f : 1 - f);
  };
  const long = span > 200 * 86400000;
  const dl = (d) => esc(long ? L.parseDate(d).toLocaleDateString('en-GB', { month: 'short', year: '2-digit' }) : L.fmtDate(d));
  const mid = L.isoDate(new Date((t0 + t1) / 2));
  const txt = (xx, yy, s, anchor = 'start') =>
    `<text x="${xx}" y="${yy}" fill="${GREY}" font-size="11" font-family="Barlow, sans-serif" text-anchor="${anchor}">${s}</text>`;
  const pts = points.map((p) => `${x(p.date).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ');
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(label)}">
    <line x1="${PL}" y1="${PT}" x2="${W - PR}" y2="${PT}" stroke="#2C2F35"/>
    <line x1="${PL}" y1="${H - PB}" x2="${W - PR}" y2="${H - PB}" stroke="#2C2F35"/>
    ${txt(0, PT + 4, fmt(invert ? min : max))}${txt(0, H - PB + 4, fmt(invert ? max : min))}
    ${txt(PL, H - 6, dl(start))}${txt((PL + W - PR) / 2, H - 6, dl(mid), 'middle')}${txt(W - PR, H - 6, dl(today()), 'end')}
    ${points.length > 1 ? `<polyline points="${pts}" fill="none" stroke="${color}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>` : ''}
    ${points.map((p, i) => `<circle cx="${x(p.date).toFixed(1)}" cy="${y(p.v).toFixed(1)}" r="${i === points.length - 1 ? 5 : 3.5}" fill="${color}"/>`).join('')}
  </svg>`;
}

const dateLong = (d) => L.fmtDate(d, { weekday: 'short', ...(ui.range === '6m' || ui.range === '1y' || ui.range === 'all' ? { year: 'numeric' } : {}) });

// Long lists show the latest 20 until "Show all" is tapped (reset on every screen change).
function capList(items, row) {
  const shown = ui.showAll ? items : items.slice(0, 20);
  return shown.map(row).join('') + (items.length > shown.length
    ? `<button class="btn btn-ghost btn-small" data-act="showAll" style="margin-top:8px">Show all ${items.length}</button>`
    : '');
}

const liftMatch = (name) => name.toLowerCase().includes(ui.liftQ.trim().toLowerCase());

function vProgress() {
  const p = cur();
  let ids = [];
  if (p) for (const k of DAYS) {
    const w = p.days[k]?.workout && p.workouts[p.days[k].workout];
    if (w) for (const it of w.items) if (!ids.includes(it.exId)) ids.push(it.exId);
  }
  ids = ids.filter((id) => exSessions(id).length);
  const runTypes = RUN_TYPES.filter((t) => runsOf(t).length);

  const lifts = ids.length
    ? ids.map((id) => {
        const all = exSessions(id);
        const ss = inRange(all);
        const last = all.at(-1);
        const best = L.bestSet(last.sets);
        const c = liftChange(ss);
        const name = exName(id);
        return `<button class="line-item" data-act="go" data-to="exercise" data-id="${id}" data-name="${esc(name.toLowerCase())}" ${liftMatch(name) ? '' : 'hidden'}>
          <span class="stack4" style="gap:2px"><span style="font-size:17px;font-weight:500">${esc(name)}</span><span class="small">Last ${esc(dateLong(last.date))}</span></span>
          <span class="stack4" style="gap:2px;align-items:flex-end">
            <span class="hrow" style="gap:6px;color:var(--text2)">${best.reps} × ${fmtW(best.weight)}${best.weight ? ' kg' : ''} ${arrow(c ? c.dir : 'same')}</span>
            <span class="small ${c ? dirCls(c.dir) : ''}">${c ? liftChangeText(c) : ss.length ? '1 session' : 'none in period'}</span>
          </span></button>`;
      }).join('')
    : '<div class="empty">Finish a workout and your lifts show up here.</div>';
  const liftSearch = ids.length ? `
    <label class="hrow input" style="gap:10px;margin:12px 0 4px;background:var(--bg)"><span class="muted">${I.search}</span>
      <input type="search" data-input="liftq" value="${esc(ui.liftQ)}" placeholder="Search lifts" aria-label="Search lifts" style="flex-grow:1;border:none;background:transparent;font-size:17px;outline:none"></label>
    <div class="small" id="liftnone" style="padding:12px 2px" ${ids.some((id) => liftMatch(exName(id))) ? 'hidden' : ''}>No lifts match that.</div>` : '';

  const runs = runTypes.length
    ? runTypes.map((t) => {
        const all = runsOf(t);
        const rs = inRange(all);
        const r = all.at(-1);
        const c = runChange(rs);
        return `<button class="line-item" data-act="go" data-to="runtype" data-type="${t}">
          <span class="stack4" style="gap:2px"><span style="font-size:17px;font-weight:500;color:${BLUE}">${RUN_SHORT[t]}</span><span class="small">Last ${esc(dateLong(r.date))}</span></span>
          <span class="stack4" style="gap:2px;align-items:flex-end">
            <span class="hrow" style="gap:6px;color:var(--text2)">${L.fmtKm(r.distKm)} km · ${L.fmtDuration(L.paceOf(r))}/km ${arrow(c ? c.dir : 'same')}</span>
            <span class="small ${c ? dirCls(c.dir) : ''}">${c ? runChangeText(t, c) : rs.length ? '1 run' : 'none in period'}</span>
          </span></button>`;
      }).join('')
    : '<div class="empty">Logged runs show up here.</div>';

  const liftDirs = ids.map((id) => liftChange(inRange(exSessions(id)))?.dir);
  const runDirs = runTypes.map((t) => runChange(inRange(runsOf(t)))?.dir);
  return `
    <div class="spread" style="align-items:center"><h1>Progress</h1><button class="linkbtn" data-act="go" data-to="archive">Archive ${I.chevron}</button></div>
    ${rangeSeg()}
    <div class="small" style="margin-top:-8px">Arrows and changes compare your first and latest session in the ${RANGE_TEXT[ui.range]}.</div>
    ${accordion('lifts', `Lifts${p ? ' · this program' : ''}`, ids.length, ids.length === 1 ? 'lift' : 'lifts', liftDirs, liftSearch + lifts)}
    ${accordion('runs', 'Runs', runTypes.length, runTypes.length === 1 ? 'run type' : 'run types', runDirs, runs)}`;
}

// Collapsible section; open/closed is kept in ui.open while the app is open.
function accordion(key, title, count, noun, dirs, body) {
  const open = !!ui.open[key];
  const up = dirs.filter((d) => d === 'up').length;
  const down = dirs.filter((d) => d === 'down').length;
  const summary = [`${count} ${noun}`, up && `<span class="lift">${up} up</span>`, down && `<span class="missc">${down} down</span>`].filter(Boolean).join(' · ');
  return `<section class="acc">
    <button class="acc-head" data-act="toggleSec" data-k="${key}" aria-expanded="${open}">
      <span class="stack4" style="gap:2px"><span class="acc-title">${title}</span><span class="small">${summary}</span></span>
      <span class="acc-chev" aria-hidden="true">${I.chevron}</span>
    </button>
    ${open ? `<div class="acc-body">${body}</div>` : ''}
  </section>`;
}

function yearAgo(list, pick) {
  const cutoff = L.addDays(today(), -365);
  const old = list.filter((x) => x.date <= cutoff).at(-1);
  return old ? pick(old) : null;
}

function vExercise(params) {
  const ex = S.exercises[params.id];
  if (!ex) return vProgress();
  const all = exSessions(ex.id);
  const t = S.targets[ex.id];
  let h = `<div class="hrow">${backBtn()}</div><h1>${esc(ex.name)}</h1>`;
  if (t) {
    h += `<div class="card"><div class="eyebrow">Next target</div>
      <div class="spread" style="align-items:center"><span class="cond" style="font-size:40px">${tReps(t)} × ${fmtW(t.weight)}${kgUnit(t.weight)}</span>
      <button class="linkbtn" data-act="editTarget" data-ex="${ex.id}">Change</button></div></div>`;
  }
  if (!all.length) return h + '<div class="empty">No sets logged yet.</div>';

  h += rangeSeg();
  const ss = inRange(all);
  if (!ss.length) {
    h += `<div class="empty">Nothing in the ${RANGE_TEXT[ui.range]}. Last session: ${esc(L.fmtDate(all.at(-1).date, { year: 'numeric' }))}.</div>`;
  } else {
    const c = liftChange(ss);
    const first = L.bestSet(ss[0].sets), last = L.bestSet(ss.at(-1).sets);
    h += `<div class="card">
      <div class="spread"><span class="eyebrow">Progression</span><span class="small">${ss.length} session${ss.length === 1 ? '' : 's'}</span></div>
      ${c ? `<div class="hrow" style="flex-wrap:wrap;gap:4px 10px"><span class="cond" style="font-size:28px">${first.reps} × ${fmtW(first.weight)} → <span class="${dirCls(c.dir)}">${last.reps} × ${fmtW(last.weight)}</span></span>
        <span class="small ${dirCls(c.dir)}">${liftChangeText(c)} in the ${RANGE_TEXT[ui.range]}</span></div>` : ''}
    </div>
    ${last.weight ? `<div class="card">
      <div class="spread"><span class="eyebrow">Weight</span><span class="small">kg lifted each session</span></div>
      ${timeChart(ss.map((s) => ({ date: s.date, v: L.bestSet(s.sets).weight })), { color: LIME, fmt: (v) => `${L.round(v)} kg`, label: `${ex.name} weight per session, ${RANGE_TEXT[ui.range]}` })}
    </div>` : ''}`;
  }

  const ya = yearAgo(all, (s) => L.bestSet(s.sets));
  const now = L.bestSet(all.at(-1).sets);
  if (ya) {
    h += `<div class="card"><div class="eyebrow">A year ago → now</div>
      <div class="cond" style="font-size:30px">${ya.reps} × ${fmtW(ya.weight)} → <span class="lift">${now.reps} × ${fmtW(now.weight)}</span></div></div>`;
  }

  const list = (ss.length ? ss : all.slice(-5)).slice().reverse();
  h += `<div class="stack4"><div class="spread"><span class="eyebrow">${ss.length ? 'Sessions' : 'Last sessions'}</span><span class="small">tap to fix a mistake</span></div>${capList(list, (s) => `
    <button class="line-item" data-act="editSession" data-sid="${s.id}" data-ex="${ex.id}"><span class="small">${esc(dateLong(s.date))}</span><span>${esc(setsText(s.sets))}</span></button>`)}</div>`;
  return h;
}

function vRunType(params) {
  const type = RUN_TYPES.includes(params.type) ? params.type : 'easy';
  const all = runsOf(type);
  let h = `<div class="hrow">${backBtn()}</div><h1>${RUN[type]}s</h1>`;
  if (!all.length) return h + '<div class="empty">No runs of this type yet.</div>';
  h += rangeSeg();
  const rs = inRange(all);
  if (!rs.length) {
    return h + `<div class="empty">No ${RUN_SHORT[type].toLowerCase()} runs in the ${RANGE_TEXT[ui.range]}. Last one: ${esc(L.fmtDate(all.at(-1).date, { year: 'numeric' }))}.</div>`;
  }
  const c = runChange(rs);
  h += `${c ? `<div class="sub">${rs.length} runs · <span class="${dirCls(c.dir)}">${runChangeText(type, c)}</span> in the ${RANGE_TEXT[ui.range]}</div>` : ''}
    <div class="card"><div class="spread"><span class="eyebrow">Pace /km</span><span class="small">higher = faster</span></div>
      ${timeChart(rs.map((r) => ({ date: r.date, v: L.paceOf(r) })), { color: BLUE, invert: true, fmt: L.fmtDuration, label: `${RUN[type]} pace, ${RANGE_TEXT[ui.range]}` })}</div>
    <div class="card"><div class="eyebrow">Distance</div>
      ${timeChart(rs.map((r) => ({ date: r.date, v: r.distKm })), { color: BLUE, fmt: (v) => `${L.fmtKm(v)} km`, label: `${RUN[type]} distance, ${RANGE_TEXT[ui.range]}` })}</div>
    <div class="stack4"><div class="eyebrow">Runs · tap to edit</div>${capList(rs.slice().reverse(), runLine)}</div>`;
  return h;
}

// ---------- programs ----------

function vPrograms() {
  const p = cur();
  const arch = S.programs.filter((x) => x.archived).sort((a, b) => b.startDate.localeCompare(a.startDate));
  let h = `<div class="hrow">${backBtn('week')}<h1 style="font-size:40px">Programs</h1></div>`;
  if (p) {
    const wk = L.weekOf(p.startDate, today());
    const pct = L.clamp(Math.round((100 * wk) / p.weeks), 0, 100);
    h += `<div class="card">
      <div class="eyebrow lift">Current</div>
      <div class="spread"><span style="font-size:20px;font-weight:600">${esc(p.name)}</span><span class="cond" style="font-size:22px">${esc(weekLabel(p))}</span></div>
      <div class="progress"><span style="width:${pct}%"></span></div>
      <div class="small">Started ${esc(L.fmtDate(p.startDate))} · ends ${esc(L.fmtDate(L.endOfProgram(p.startDate, p.weeks)))}. When it's done you'll be asked to start the next one, and this one moves to the Archive.</div>
      <button class="btn btn-ghost btn-small" data-act="endProgram">End early and archive</button>
    </div>`;
  } else {
    h += '<div class="empty">No program running.</div>';
  }
  h += `<button class="btn btn-primary" data-act="go" data-to="newprogram">${I.plus}New program</button>
    <div class="spread" style="margin-top:6px"><span class="eyebrow">Archive</span>${arch.length ? '<button class="linkbtn" data-act="archiveTab" data-v="programs">See all</button>' : ''}</div>
    ${arch.length ? `<div class="stack4">${arch.slice(0, 3).map(programLine).join('')}</div>` : '<div class="small">Finished programs land here, with everything you logged.</div>'}`;
  return h;
}

const programLine = (p) => `
  <button class="line-item" data-act="go" data-to="program" data-id="${p.id}">
    <span class="stack4" style="gap:2px"><span style="font-size:17px;font-weight:500">${esc(p.name)}${p.id === S.currentId && !p.archived ? ' <span class="tag lift" style="font-size:12px;padding:2px 8px">Current</span>' : ''}</span>
    <span class="small">${p.weeks} weeks · ${esc(L.fmtMonthYear(p.startDate))} – ${p.endDate ? esc(L.fmtMonthYear(p.endDate)) : 'now'}</span></span>
    <span class="muted">${I.chevron}</span>
  </button>`;

function seasonName() {
  const d = new Date();
  const s = ['Winter', 'Winter', 'Spring', 'Spring', 'Spring', 'Summer', 'Summer', 'Summer', 'Autumn', 'Autumn', 'Autumn', 'Winter'][d.getMonth()];
  const base = `${s} ${d.getFullYear()}`;
  let name = base;
  for (let n = 2; S.programs.some((p) => p.name === name); n++) name = `${base} (${n})`;
  return name;
}

function vNewProgram(params) {
  const all = S.programs.slice().sort((a, b) => b.startDate.localeCompare(a.startDate));
  if (!ui.np) {
    const from = params.from || cur()?.id || all[0]?.id || '';
    ui.np = { name: seasonName(), weeks: 12, other: false, start: today(), mode: from ? 'copy' : 'blank', from, workouts: true, runs: true, keep: true };
  }
  const np = ui.np;
  const c = cur();
  const chip = (v) => `<button data-act="npWeeks" data-v="${v}" aria-pressed="${!np.other && np.weeks === v}">${v}</button>`;
  const toggle = (k, label, sub) => `
    <label class="toggle"><span class="stack4" style="gap:2px"><span>${label}</span>${sub ? `<span class="small">${sub}</span>` : ''}</span>
    <input type="checkbox" data-change="npToggle" data-f="${k}" ${np[k] ? 'checked' : ''}></label>`;
  return `
    <div class="hrow">${backBtn('programs')}<h1 style="font-size:40px">New program</h1></div>
    <label class="field">Name<input class="input" data-input="npf" data-f="name" value="${esc(np.name)}"></label>
    <div class="stack"><div class="eyebrow">Length (weeks)</div>
      <div class="chips">${[6, 8, 10, 12].map(chip).join('')}<button data-act="npOther" aria-pressed="${np.other}" style="font-family:Barlow,sans-serif;font-size:15px;font-weight:600">Other</button></div>
      ${np.other ? `<input class="input num" type="number" inputmode="numeric" min="1" max="104" data-input="npf" data-f="weeks" value="${np.weeks}" aria-label="Number of weeks">` : ''}
    </div>
    <label class="field">Start date<input class="input" type="date" data-input="npf" data-f="start" value="${np.start}"></label>
    ${all.length ? `
      <div class="stack"><div class="eyebrow">Start from</div>
        <div class="seg"><button data-act="npMode" data-v="blank" aria-pressed="${np.mode === 'blank'}">Blank</button><button data-act="npMode" data-v="copy" aria-pressed="${np.mode === 'copy'}">A previous program</button></div>
        ${np.mode === 'copy' ? `
          <label class="field">Copy from<select class="input" data-change="npFrom">${all.map((p) => `<option value="${p.id}" ${p.id === np.from ? 'selected' : ''}>${esc(p.name)}${p.id === S.currentId && !p.archived ? ' (current)' : ''}</option>`).join('')}</select></label>
          <div class="card" style="gap:0;padding:4px 16px">
            ${toggle('workouts', 'Workouts and days')}
            ${toggle('runs', 'Runs')}
            ${toggle('keep', 'Keep latest weights & reps', 'Picks up from your last session. Off: same weights, reps back to the bottom of each range')}
          </div>` : '<div class="small">Exercises you’ve done before still remember their last weight when you add them.</div>'}
      </div>` : ''}
    ${c ? `<div class="small">${esc(c.name)} will move to the Archive.</div>` : ''}
    <div class="grow"></div>
    <button class="btn btn-primary" data-act="createProgram">Create program</button>`;
}

function createProgram() {
  const np = ui.np;
  const weeks = int(np.weeks, 1, 104, 12);
  if (!np.start) return toast('Pick a start date');
  const src = np.mode === 'copy' ? prog(np.from) : null;
  const days = {}, workouts = {}, idMap = {};
  if (src) {
    if (np.workouts) {
      for (const w of Object.values(src.workouts)) {
        const nw = { id: uid(), name: w.name, items: w.items.map((i) => ({ ...i })) };
        idMap[w.id] = nw.id;
        workouts[nw.id] = nw;
      }
    }
    for (const k of DAYS) {
      const d = src.days[k] || {};
      const nd = {};
      if (d.workout && idMap[d.workout]) nd.workout = idMap[d.workout];
      if (np.runs && d.run) nd.run = d.run;
      if (nd.workout || nd.run) days[k] = nd;
    }
    if (!np.keep) {
      for (const w of Object.values(workouts)) for (const it of w.items) {
        const t = S.targets[it.exId];
        if (t) Object.assign(t, { reps: it.min, sets: [it.min], miss: 0 });
      }
    }
  }
  archiveCurrent();
  const p = { id: uid(), name: np.name.trim() || seasonName(), weeks, startDate: np.start, endDate: null, archived: false, days, workouts };
  S.programs.push(p);
  S.currentId = p.id;
  ui.np = null;
  ui.day = null;
  save();
  toast(src ? 'Program created' : 'Program created — now plan your week');
  go('week');
}

function archiveCurrent() {
  const p = cur();
  if (!p) return;
  p.archived = true;
  p.endDate = today();
  S.currentId = null;
}

// ---------- archive ----------

function vArchive() {
  const tab = ui.archiveTab;
  let h = `<div class="hrow">${backBtn()}<h1 style="font-size:40px">Archive</h1></div>
    <div class="seg" role="tablist">
      <button role="tab" data-act="archiveTab" data-v="programs" aria-pressed="${tab === 'programs'}" aria-selected="${tab === 'programs'}">Programs</button>
      <button role="tab" data-act="archiveTab" data-v="exercises" aria-pressed="${tab === 'exercises'}" aria-selected="${tab === 'exercises'}">Exercises</button>
    </div>`;
  if (tab === 'programs') {
    const all = S.programs.slice().sort((a, b) => b.startDate.localeCompare(a.startDate));
    return h + (all.length ? `<div class="stack4">${all.map(programLine).join('')}</div>` : '<div class="empty">No programs yet.</div>');
  }
  // Same layout as Progress: collapsible Lifts (with search) and Runs, comparing a year ago with now.
  const lifts = archLifts();
  const runs = archRuns();
  const liftBody = lifts.length ? `
    <label class="hrow input" style="gap:10px;margin:12px 0 4px;background:var(--bg)"><span class="muted">${I.search}</span>
      <input type="search" data-input="archq" value="${esc(ui.archiveQ)}" placeholder="Search lifts" aria-label="Search lifts" style="flex-grow:1;border:none;background:transparent;font-size:17px;outline:none"></label>
    <div id="archlist">${archListHtml(lifts)}</div>` : '<div class="empty">Nothing logged yet.</div>';
  const runBody = runs.length ? archHead('Run') + runs.map((r) => r.html).join('') : '<div class="empty">Logged runs show up here.</div>';
  return h + `
    <div class="small" style="margin-top:-8px">Your best a year ago compared with now.</div>
    ${accordion('archLifts', 'Lifts', lifts.length, lifts.length === 1 ? 'lift' : 'lifts', lifts.map((x) => x.dir), liftBody)}
    ${accordion('archRuns', 'Runs', runs.length, runs.length === 1 ? 'run type' : 'run types', runs.map((x) => x.dir), runBody)}`;
}

const ARCH_GRID = 'display:grid;grid-template-columns:1fr 84px 84px;gap:8px';
const archHead = (first) => `<div style="${ARCH_GRID};padding:12px 2px 6px" class="eyebrow"><span>${first}</span><span>Year ago</span><span>Now</span></div>`;

// Every exercise ever logged: year-ago best weight vs latest.
function archLifts() {
  return Object.values(S.exercises)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((e) => {
      const ss = exSessions(e.id);
      if (!ss.length) return null;
      const ya = yearAgo(ss, (s) => L.bestSet(s.sets).weight);
      const now = L.bestSet(ss.at(-1).sets).weight;
      const dir = ya == null ? null : now > ya ? 'up' : now < ya ? 'down' : 'same';
      const color = dir === 'up' ? LIME : dir === 'down' ? ORANGE : 'var(--text2)';
      return { name: e.name, dir, html: `<button class="line-item" data-act="go" data-to="exercise" data-id="${e.id}" style="${ARCH_GRID}">
        <span style="font-size:16px;font-weight:500">${esc(e.name)}</span><span class="small">${ya == null ? '—' : fmtW(ya) + (ya ? ' kg' : '')}</span>
        <span style="font-weight:600;color:${color}">${fmtW(now)}${now ? ' kg' : ''}</span></button>` };
    })
    .filter(Boolean);
}

// Each run type: year-ago pace vs latest (faster = better).
function archRuns() {
  return RUN_TYPES.map((t) => {
    const rs = runsOf(t);
    if (!rs.length) return null;
    const val = (r) => `${L.fmtDuration(L.paceOf(r))}/km`;
    const old = yearAgo(rs, (r) => r);
    const dir = old ? runDir(rs.at(-1), old) : null;
    const color = dir === 'up' ? LIME : dir === 'down' ? ORANGE : BLUE;
    return { dir, html: `<button class="line-item" data-act="go" data-to="runtype" data-type="${t}" style="${ARCH_GRID}">
      <span style="font-size:16px;font-weight:500;color:${BLUE}">${RUN_SHORT[t]} pace</span>
      <span class="small">${old ? val(old) : '—'}</span><span style="font-weight:600;color:${color}">${val(rs.at(-1))}</span></button>` };
  }).filter(Boolean);
}

function archListHtml(lifts = archLifts()) {
  const q = ui.archiveQ.trim().toLowerCase();
  const rows = lifts.filter((x) => x.name.toLowerCase().includes(q));
  if (!rows.length) return '<div class="small" style="padding:12px 2px">No lifts match that.</div>';
  return archHead('Exercise') + rows.map((x) => x.html).join('');
}

function vProgramDetail(params) {
  const p = prog(params.id);
  if (!p) return vArchive();
  const sessions = S.sessions.filter((s) => s.programId === p.id);
  const runs = S.runs.filter((r) => r.programId === p.id);
  const sets = sessions.reduce((n, s) => n + s.entries.reduce((m, e) => m + e.sets.length, 0), 0);
  const best = {};
  for (const s of sessions) for (const e of s.entries) best[e.exId] = L.bestSet([...(best[e.exId] ? [best[e.exId]] : []), ...e.sets]);
  const stat = (v, l) => `<div class="card" style="gap:2px;padding:14px"><div class="cond" style="font-size:32px">${v}</div><div class="small">${l}</div></div>`;
  return `
    <div class="hrow">${backBtn()}</div>
    <div class="stack4"><h1>${esc(p.name)}</h1>
      <div class="sub">${p.weeks} weeks · ${esc(L.fmtDate(p.startDate, { year: 'numeric' }))} – ${p.endDate ? esc(L.fmtDate(p.endDate, { year: 'numeric' })) : 'now'}</div></div>
    <div class="grid3">${stat(sessions.length, 'workouts')}${stat(sets, 'sets')}${stat(runs.length, 'runs')}</div>
    <div class="stack4"><div class="eyebrow">Week</div>${DAYS.map((k) => {
      const d = p.days[k] || {};
      const w = d.workout && p.workouts[d.workout];
      const label = [w && w.name, d.run && RUN[d.run]].filter(Boolean).join(' + ');
      return label ? `<div class="line-item"><span class="dayname">${k.toUpperCase()}</span><span class="grow">${esc(label)}</span></div>` : '';
    }).join('')}</div>
    ${Object.keys(best).length ? `<div class="stack4"><div class="eyebrow">Best sets</div>${Object.entries(best).map(([id, b]) => `
      <button class="line-item" data-act="go" data-to="exercise" data-id="${id}"><span>${esc(exName(id))}</span><span class="muted">${b.reps} × ${fmtW(b.weight)}${b.weight ? ' kg' : ''}</span></button>`).join('')}</div>` : ''}
    ${p.archived ? `<button class="btn btn-ghost" data-act="go" data-to="newprogram" data-from="${p.id}">Start a new program from this one</button>` : ''}`;
}

// ---------- backup ----------

function sBackup() {
  const sess = Sync.getSession();
  const status = S.demo ? 'Demo data isn’t saved to your sheet' : Sync.isDirty() ? 'Saving…' : 'All saved to your Google Sheet';
  return `
    <div class="stack4"><h2>${esc(sess.name)}</h2><div class="sub">${status}</div></div>
    <div class="grid2">
      ${sess.url ? `<a class="btn btn-ghost" href="${esc(sess.url)}" target="_blank" rel="noopener">Open my sheet</a>` : '<span></span>'}
      <button class="btn btn-ghost" data-act="askSignOut">Sign out</button>
    </div>
    <div class="stack4" style="margin-top:8px"><div class="eyebrow">Backup file</div>
    <div class="small">Your Google Sheet is your backup. You can also save a file copy, or restore one.</div></div>
    <button class="btn btn-ghost" data-act="exportData">Save backup file</button>
    <label class="btn btn-ghost">Restore from a backup file<input type="file" accept="application/json,.json" data-change="importFile" hidden></label>
    <div class="small center">${S.lastBackup ? `Last backup: ${esc(L.fmtDate(S.lastBackup, { year: 'numeric' }))}` : 'No backup saved yet.'}</div>
    <div class="stack" style="margin-top:8px">
      <div class="eyebrow">Demo data</div>
      ${S.demo ? '<button class="btn btn-danger btn-small" data-act="clearDemo">Clear demo data, back to my data</button>' : ''}
      <button class="btn btn-ghost btn-small" data-act="loadDemo">Try demo data (not saved to your sheet)</button>
    </div>`;
}

async function exportData() {
  const name = `sort-it-out-${today()}.json`;
  const file = new File([JSON.stringify(S)], name, { type: 'application/json' });
  try {
    if (navigator.canShare && navigator.canShare({ files: [file] }) && /Android|iPhone|iPad/i.test(navigator.userAgent)) {
      await navigator.share({ files: [file], title: 'Sort It Out backup' });
    } else {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(file);
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    }
    S.lastBackup = today();
    save();
    renderSheet();
  } catch (e) {
    if (e.name !== 'AbortError') toast('Backup failed');
  }
}

// ---------- screen wake lock during workouts ----------

let lock = null;
async function wake(on) {
  try {
    if (on && 'wakeLock' in navigator && !lock) {
      lock = await navigator.wakeLock.request('screen');
      lock.addEventListener('release', () => { lock = null; });
    } else if (!on && lock) {
      await lock.release();
      lock = null;
    }
  } catch (e) { /* not supported or not allowed: fine */ }
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && S.active) wake(true);
});

// =====================================================================
// Actions
// =====================================================================

const A = {
  go(d) {
    if (d.to === 'newprogram') ui.np = null;
    const params = {};
    if (d.id) params.id = d.id;
    if (d.type) params.type = d.type;
    if (d.from) params.from = d.from;
    go(d.to, params);
  },
  tab(d) {
    if (d.to === 'today') ui.day = null;
    go(d.to);
  },
  back() {
    if (history.length > 1) history.back();
    else go('progress');
  },
  closeSheet,

  pickDay: () => openSheet(sPickDay),
  setDay(d) {
    ui.day = d.day === todayKey() ? null : d.day;
    ui.dayFrom = 'today';
    closeSheet();
    render(true);
  },
  // Picked a day by mistake: back to today's own plan, nothing started.
  cancelDay() {
    ui.day = null;
    render(true);
  },

  start(d) {
    const p = cur();
    const w = p.workouts[d.id];
    S.active = { programId: p.id, workoutId: w.id, workoutName: w.name, date: today(), started: Date.now(), items: w.items.map((i, k) => ({ ...i, k })), ex: 0, logs: {}, hist: [] };
    save();
    wake(true);
    go('train');
  },
  done() {
    const it = S.active.items[S.active.ex];
    const t = targetFor(it.exId, it);
    logSet({ reps: setReps(t, (S.active.logs[it.k] || []).length), weight: t.weight, hit: true });
  },
  missed() {
    const it = S.active.items[S.active.ex];
    const full = targetFor(it.exId, it);
    const t = { weight: full.weight, reps: setReps(full, (S.active.logs[it.k] || []).length) };
    ui.miss = { reps: t.reps, weight: t.weight, step: exStep(it.exId), t };
    openSheet(sMissed);
  },
  mstep(d) {
    const m = ui.miss;
    if (d.f === 'reps') m.reps = Math.max(0, m.reps + Number(d.d));
    else m.weight = Math.max(0, L.round(m.weight + Number(d.d) * NUDGE));
    renderSheet();
  },
  saveMissed() {
    const m = ui.miss;
    closeSheet();
    logSet({ reps: m.reps, weight: m.weight, hit: m.reps >= m.t.reps && m.weight >= m.t.weight });
  },
  undo() {
    const a = S.active;
    const k = a.hist.pop();
    a.logs[k].pop();
    a.ex = a.items.findIndex((i) => i.k === k);
    save();
    render(true);
  },
  editActive(d) {
    const a = S.active;
    const it = a.items.find((x) => String(x.k) === d.k);
    const t = targetFor(it.exId, it);
    openSetEditor(exName(it.exId), `Target ${L.repsText(t.sets)} × ${fmtW(t.weight)}${t.weight ? ' kg' : ''}`, a.logs[it.k] || [], exStep(it.exId), (sets) => {
      a.logs[it.k] = sets.map((s, i) => ({ ...s, hit: s.reps >= setReps(t, i) && s.weight >= t.weight }));
      a.hist = a.hist.filter((k) => k !== it.k).concat(sets.map(() => it.k));
      // a finished exercise that now has sets missing comes back as the current one
      const i = a.items.indexOf(it);
      if (i < a.ex && sets.length < it.sets) {
        a.items.splice(i, 1);
        a.items.splice(a.ex - 1, 0, it);
        a.ex--;
      }
      if (i === a.ex && sets.length >= it.sets) a.ex++;
      if (a.ex >= a.items.length) return finishWorkout();
    });
  },
  editSession(d) {
    const s = S.sessions.find((x) => x.id === d.sid);
    const e = s?.entries.find((x) => x.exId === d.ex);
    if (!e) return;
    openSetEditor(exName(e.exId), `${s.workoutName} · ${L.fmtDate(s.date, { weekday: 'short', year: 'numeric' })}`, e.sets, exStep(e.exId), (sets) => {
      if (sets.length) e.sets = sets.map((x, i) => ({ ...x, hit: x.reps >= L.setTargets(e.target, e.cfg)[i] && x.weight >= e.target.weight }));
      else s.entries = s.entries.filter((x) => x !== e);
      if (!s.entries.length) S.sessions = S.sessions.filter((x) => x !== s);
      toast('Saved · next target unchanged (tap Change to adjust)');
    });
  },
  esStep(d) {
    const s = ui.es.sets[Number(d.i)];
    if (d.f === 'reps') s.reps = Math.max(0, s.reps + Number(d.d));
    else s.weight = Math.max(0, L.round(s.weight + Number(d.d) * NUDGE));
    renderSheet();
  },
  esDel(d) {
    ui.es.sets.splice(Number(d.i), 1);
    renderSheet();
  },
  esAdd() {
    const last = ui.es.sets.at(-1) || { reps: 10, weight: 0 };
    ui.es.sets.push({ reps: last.reps, weight: last.weight });
    renderSheet();
  },
  esSave() {
    const es = ui.es;
    closeSheet();
    es.save(es.sets);
    save();
    render();
  },

  // Machine busy? Pick any remaining exercise to do now; sets already done are kept.
  pickEx: () => openSheet(sQueue),
  jumpEx(d) {
    const a = S.active;
    const [it] = a.items.splice(Number(d.i), 1);
    a.items.splice(a.ex, 0, it);
    save();
    closeSheet();
    render(true);
  },
  endWorkout() {
    const a = S.active;
    if (!a.hist.length) {
      if (!confirm('Cancel this workout? Nothing has been logged yet.')) return;
      S.active = null;
      wake(false);
      save();
      go('today');
      return;
    }
    if (confirm('Finish the workout now? Sets you logged are saved and next time’s targets are worked out.')) finishWorkout();
  },

  editTarget(d) {
    const t = S.targets[d.ex] || { weight: 0, reps: 10 };
    ui.tgt = { exId: d.ex, reps: (t.sets && t.sets[0]) || t.reps, weight: t.weight, step: exStep(d.ex) };
    openSheet(sTarget);
  },
  tstep(d) {
    const t = ui.tgt;
    if (d.f === 'reps') t.reps = Math.max(1, t.reps + Number(d.d));
    else t.weight = Math.max(0, L.round(t.weight + Number(d.d) * NUDGE));
    renderSheet();
  },
  saveTarget() {
    const t = ui.tgt;
    S.targets[t.exId] = { weight: t.weight, reps: t.reps, sets: [t.reps], miss: 0 };
    save();
    closeSheet();
    render();
  },

  daySheet(d) {
    ui.dayEdit = d.day;
    openSheet(sDay);
  },
  setDayWorkout(d) {
    const p = cur();
    p.days[ui.dayEdit] = { ...(p.days[ui.dayEdit] || {}), workout: d.id || null };
    save();
    render();
  },
  setDayRun(d) {
    const p = cur();
    p.days[ui.dayEdit] = { ...(p.days[ui.dayEdit] || {}), run: d.v || null };
    save();
    render();
  },
  newWorkout() {
    const p = cur();
    const w = { id: uid(), name: `${DAY_LONG[ui.dayEdit]} workout`, items: [] };
    p.workouts[w.id] = w;
    p.days[ui.dayEdit] = { ...(p.days[ui.dayEdit] || {}), workout: w.id };
    save();
    go('workout', { id: w.id });
  },
  delWorkout(d) {
    const p = cur();
    const w = p.workouts[d.id];
    if (!confirm(`Delete ${w.name}? Everything you've logged is kept.`)) return;
    delete p.workouts[d.id];
    for (const k of DAYS) if (p.days[k]?.workout === d.id) p.days[k].workout = null;
    save();
    go('week');
  },
  itemSheet(d) {
    ui.item = { wid: d.wid, i: Number(d.i) };
    openSheet(sItem);
  },
  moveItem(d) {
    const items = cur().workouts[ui.item.wid].items;
    const i = ui.item.i, j = i + Number(d.d);
    if (j < 0 || j >= items.length) return;
    [items[i], items[j]] = [items[j], items[i]];
    ui.item.i = j;
    save();
    render();
  },
  removeItem() {
    const items = cur().workouts[ui.item.wid].items;
    if (!confirm(`Remove ${exName(items[ui.item.i].exId)} from this workout? Its history is kept.`)) return;
    items.splice(ui.item.i, 1);
    save();
    closeSheet();
    render();
  },

  logRun(d) {
    ui.runForm = null;
    go('run', { type: d.type });
  },
  runType(d) {
    ui.runForm.type = d.v;
    render();
  },
  saveRun() {
    const f = ui.runForm;
    const dist = L.parseKm(f.dist);
    let time = L.parseDuration(f.time);
    const pace = L.parseDuration(f.pace);
    if (!time && dist && pace) time = Math.round(pace * dist);
    if (!dist || !time) return toast('Enter distance and time (or pace)');
    S.runs.push({ id: uid(), date: f.date || today(), programId: cur()?.id || null, type: f.type, distKm: dist, timeSec: time });
    ui.runForm = null;
    ui.day = null;
    save();
    toast('Run saved');
    render(true);
  },
  runSheet(d) {
    ui.runId = d.id;
    openSheet(sRun);
  },
  runEditType(d) {
    const r = S.runs.find((x) => x.id === ui.runId);
    r.type = d.v;
    save();
    renderSheet();
  },
  delRun() {
    if (!confirm('Delete this run?')) return;
    S.runs = S.runs.filter((r) => r.id !== ui.runId);
    save();
    closeSheet();
    render();
  },

  endProgram() {
    const p = cur();
    if (!confirm(`End ${p.name} now and move it to the Archive? Everything you logged is kept.`)) return;
    archiveCurrent();
    save();
    render();
  },
  npWeeks(d) {
    ui.np.weeks = Number(d.v);
    ui.np.other = false;
    render();
  },
  npOther() {
    ui.np.other = true;
    render();
  },
  npMode(d) {
    ui.np.mode = d.v;
    if (d.v === 'copy' && !ui.np.from) ui.np.from = S.programs.at(-1)?.id || '';
    render();
  },
  createProgram,
  archiveTab(d) {
    ui.archiveTab = d.v;
    if (route().name === 'archive') render();
    else go('archive');
  },

  askDelSession(d) {
    const s = S.sessions.find((x) => x.id === d.id);
    ui.ask = { title: `Delete ${s.workoutName}?`, body: 'This removes the sets you logged in this workout, and next time’s targets go back to what they were before it. This can’t be undone.', yes: 'Delete', act: 'delSession', id: d.id };
    openSheet(sAsk);
  },
  delSession(d) {
    deleteSession(d.id);
    save();
    closeSheet();
    toast('Workout deleted');
    render();
  },
  // Not doing today's planned workout/run: take it off today for this week only.
  askSkip(d) {
    const p = cur();
    const day = planDays(p)[todayKey()];
    const name = d.kind === 'run' ? `the ${RUN[day.run].toLowerCase()}` : p.workouts[day.workout].name;
    ui.ask = { title: `Skip ${name} today?`, body: `It’s taken off ${DAY_LONG[todayKey()]} for this week only. Your plan stays the same, and Program → This week → Reset to plan brings it back.`, yes: 'Skip', act: 'skipToday', id: d.kind };
    openSheet(sAsk);
  },
  skipToday(d) {
    const days = ensureWeek(cur());
    const k = todayKey();
    days[k] = { ...days[k], [d.id === 'run' ? 'run' : 'workout']: null };
    save();
    closeSheet();
    toast('Skipped for today');
    render();
  },
  askDelRun(d) {
    const r = S.runs.find((x) => x.id === d.id);
    ui.ask = { title: `Delete ${RUN[r.type].toLowerCase()}?`, body: `${L.fmtKm(r.distKm)} km in ${L.fmtDuration(r.timeSec)}. This can’t be undone.`, yes: 'Delete', act: 'delRunNow', id: d.id };
    openSheet(sAsk);
  },
  delRunNow(d) {
    S.runs = S.runs.filter((x) => x.id !== d.id);
    save();
    closeSheet();
    toast('Run deleted');
    render();
  },
  // This-week rows: coming days open the change panel; today and past days open on Today.
  weekDay(d) {
    const date = L.addDays(weekMonday(), DAYS.indexOf(d.day));
    if (date <= today()) return A.doDay(d);
    ui.wkDay = d.day;
    openSheet(sWeekDay);
  },
  setWkWorkout(d) {
    const days = ensureWeek(cur());
    days[ui.wkDay] = { ...days[ui.wkDay], workout: d.id || null };
    save();
    render();
  },
  setWkRun(d) {
    const days = ensureWeek(cur());
    days[ui.wkDay] = { ...days[ui.wkDay], run: d.v || null };
    save();
    render();
  },
  resetWeek() {
    delete cur().thisWeek;
    save();
    toast('Back to your plan for this week');
    render();
  },
  weekTab(d) {
    ui.weekTab = d.v;
    render();
  },
  // From a picked day back to the weekly view; Today goes back to showing today.
  backWeek() {
    ui.day = null;
    go('week');
  },
  // Show a day's planned workout/run on Today so it can be done now.
  doDay(d) {
    ui.day = d.day === todayKey() ? null : d.day;
    ui.dayFrom = 'week';
    go('today');
  },
  toggleSec(d) {
    ui.open[d.k] = !ui.open[d.k];
    render();
  },
  showAll() {
    ui.showAll = true;
    render();
  },
  setRange(d) {
    ui.range = d.v;
    render();
  },

  async loadDemo() {
    const hasData = S.sessions.length || S.runs.length || S.programs.length;
    if (hasData && !confirm('Replace everything in the app with demo data? Save a backup first if you want to keep what’s here.')) return;
    const { buildDemo } = await import('./demo.js');
    S = buildDemo();
    ui.day = null;
    save();
    closeSheet();
    toast('Demo data loaded');
    go('today');
  },
  // Demo data never goes to the sheet, so clearing it just reloads the person's own data.
  clearDemo() {
    S = blank();
    persist(S);
    Sync.setDirty(false);
    closeSheet();
    go('today');
    pullRemote().then(() => toast('Back to your data'));
  },
  askSignOut() {
    const unsaved = Sync.isDirty() && !S.demo;
    ui.ask = {
      title: 'Sign out?',
      body: unsaved ? 'Some changes haven’t reached your Google Sheet yet and would be lost. Get online first if you can.' : 'Your data is safe in your Google Sheet. Sign in again with your code any time.',
      yes: 'Sign out', act: 'signOut', id: '',
    };
    openSheet(sAsk);
  },
  signOut() {
    Sync.setSession(null);
    Sync.setDirty(false);
    S = blank();
    persist(S);
    ui.sheet = null;
    location.hash = '#/today';
    render(true);
  },

  backup: () => openSheet(sBackup),
  exportData,
};

// input events (no re-render, so the keyboard stays open)
const INP = {
  exname(el) {
    const ex = findExByName(el.value);
    const f = el.form.elements;
    const hint = document.getElementById('exhint');
    if (ex) {
      const t = S.targets[ex.id];
      const cfg = lastConfig(ex.id);
      if (t) f.kg.value = t.weight || '';
      f.step.value = ex.step;
      if (cfg) {
        f.sets.value = cfg.sets;
        f.min.value = cfg.min;
        f.max.value = cfg.max;
      }
      hint.className = 'small lift';
      hint.textContent = t ? `Done before · picks up at ${tReps(t)} × ${fmtW(t.weight)}${t.weight ? ' kg' : ''}` : 'Done before';
    } else {
      hint.className = 'small';
      hint.textContent = '';
    }
  },
  // typed straight into a stepper's number (no re-render, so the keyboard stays up)
  typed(el) {
    const o = el.dataset.obj;
    const target = o === 'es' ? ui.es.sets[Number(el.dataset.i)] : ui[o];
    const v = el.dataset.f === 'reps' ? int(el.value, 0, 999, null) : num(el.value);
    if (target && v != null) target[el.dataset.f] = v;
  },
  runf(el) {
    const f = ui.runForm;
    const k = el.dataset.f;
    f[k] = el.value;
    if (k === 'date') return;
    f.order = f.order.filter((x) => x !== k).concat(k);
    if (f.order.length >= 2) {
      const [a, b] = f.order.slice(-2);
      const third = ['dist', 'time', 'pace'].find((x) => x !== a && x !== b);
      const d = L.parseKm(f.dist), t = L.parseDuration(f.time), p = L.parseDuration(f.pace);
      let v = '';
      if (third === 'pace' && d && t) v = L.fmtDuration(t / d);
      if (third === 'time' && d && p) v = L.fmtDuration(p * d);
      if (third === 'dist' && t && p) v = L.fmtKm(t / p);
      if (v) {
        f[third] = v;
        document.querySelector(`[data-f="${third}"]`).value = v;
      }
    }
    document.getElementById('runcmp').innerHTML = runCompareHtml();
  },
  npf(el) {
    ui.np[el.dataset.f] = el.dataset.f === 'weeks' ? int(el.value, 1, 104, 12) : el.value;
  },
  // filters the Progress lift list in place so the keyboard stays open
  liftq(el) {
    ui.liftQ = el.value;
    let any = false;
    document.querySelectorAll('[data-name]').forEach((row) => {
      row.hidden = !liftMatch(row.dataset.name);
      any = any || !row.hidden;
    });
    document.getElementById('liftnone').hidden = any;
  },
  archq(el) {
    ui.archiveQ = el.value;
    document.getElementById('archlist').innerHTML = archListHtml();
  },
};

const CHG = {
  wname(el) {
    const w = cur()?.workouts[el.dataset.id];
    if (!w) return;
    w.name = el.value.trim() || 'Workout';
    save();
  },
  npToggle(el) {
    ui.np[el.dataset.f] = el.checked;
  },
  npFrom(el) {
    ui.np.from = el.value;
  },
  importFile(el) {
    const file = el.files[0];
    if (!file) return;
    const r = new FileReader();
    r.onload = () => {
      try {
        const d = JSON.parse(r.result);
        if (d.v !== 1 || !Array.isArray(d.programs)) throw new Error('bad file');
        if (!confirm('Replace everything on this phone with this backup?')) return;
        S = { ...blank(), ...d };
        save();
        closeSheet();
        toast('Backup restored');
        go('today');
      } catch (e) {
        toast('That file isn’t a Sort It Out backup');
      }
    };
    r.readAsText(file);
  },
};

const SUB = {
  async login(form) {
    const code = form.elements.code.value.trim();
    const err = document.getElementById('loginerr');
    const btn = form.querySelector('button');
    btn.disabled = true;
    btn.textContent = 'Signing in…';
    err.hidden = true;
    try {
      const r = await Sync.loadRemote(code);
      if (!r.ok) throw new Error(r.error === 'code' ? 'That code isn’t right.' : 'Something went wrong. Try again.');
      Sync.setSession({ code, name: r.name, url: r.url });
      const local = !S.demo && (S.programs.length || S.sessions.length || S.runs.length);
      if (r.state) {
        S = { ...blank(), ...r.state };
        Sync.setDirty(false);
      } else if (local) {
        Sync.setDirty(true); // empty sheet: keep what's on this phone and send it up
      } else {
        S = blank();
        Sync.setDirty(false);
      }
      persist(S);
      ui.day = null;
      location.hash = '#/today';
      render(true);
      toast(`Hi ${r.name}`);
      pushNow();
    } catch (e) {
      err.textContent = e.message.startsWith('That') || e.message.startsWith('Something') ? e.message : 'Couldn’t reach Google. Check your connection.';
      err.hidden = false;
      btn.disabled = false;
      btn.textContent = 'Sign in';
    }
  },
  saveRunEdit(form) {
    const f = form.elements;
    const r = S.runs.find((x) => x.id === ui.runId);
    const dist = L.parseKm(f.dist.value), time = L.parseDuration(f.time.value);
    if (!dist || !time) return toast('Check the distance and time');
    Object.assign(r, { distKm: dist, timeSec: time, date: f.date.value || r.date });
    save();
    closeSheet();
    toast('Run updated');
    render();
  },
  addEx(form) {
    const f = form.elements;
    const name = f.exname.value.trim();
    if (!name) return;
    const w = cur().workouts[form.dataset.id];
    const sets = int(f.sets.value, 1, 20, 3);
    const min = int(f.min.value, 1, 100, 10);
    const max = Math.max(min, int(f.max.value, 1, 100, min));
    const kg = f.kg.value.trim() === '' ? null : num(f.kg.value);
    let ex = findExByName(name);
    const known = !!ex;
    const step = num(f.step.value) || 2.5;
    if (!ex) {
      ex = { id: uid(), name, step };
      S.exercises[ex.id] = ex;
    } else {
      ex.step = step;
    }
    const t = S.targets[ex.id];
    if (!t) S.targets[ex.id] = { weight: kg || 0, reps: min, sets: [min], miss: 0 };
    else if (kg != null && kg !== t.weight) S.targets[ex.id] = { weight: kg, reps: min, sets: [min], miss: 0 };
    w.items.push({ exId: ex.id, sets, min, max });
    save();
    render();
    toast(known && t ? `${ex.name} added · carries on from last time` : `${ex.name} added`);
  },
  saveItem(form) {
    const f = form.elements;
    const w = cur().workouts[ui.item.wid];
    const it = w.items[ui.item.i];
    const ex = S.exercises[it.exId];
    const name = f.exname.value.trim();
    const clash = findExByName(name);
    if (clash && clash.id !== ex.id) return toast('Another exercise already has that name');
    if (name) ex.name = name;
    ex.step = num(f.step.value) || ex.step || 2.5;
    it.sets = int(f.sets.value, 1, 20, it.sets);
    it.min = int(f.min.value, 1, 100, it.min);
    it.max = Math.max(it.min, int(f.max.value, 1, 100, it.max));
    const old = S.targets[it.exId] || {};
    const weight = num(f.kg.value) ?? old.weight ?? 0;
    const reps = int(f.reps.value, 1, 100, it.min);
    const oldFirst = (old.sets && old.sets[0]) || old.reps;
    if (reps !== oldFirst) S.targets[it.exId] = { weight, reps, sets: [reps], miss: 0 };
    else if (weight !== old.weight) S.targets[it.exId] = { ...old, weight, miss: 0 };
    save();
    closeSheet();
    render();
  },
};

// ---------- drag to reorder ----------
// Lists marked data-sortable; items carry data-idx and a [data-handle] grip.
// data-mode="swap" swaps two items (week days); otherwise the item is moved and the rest slide.

const SORT = {
  ex(list, from, to) {
    const items = cur().workouts[list.dataset.wid].items;
    items.splice(to, 0, items.splice(from, 1)[0]);
  },
  // This week only: swap what two days show, without touching the plan.
  thisweek(list, from, to) {
    const p = cur();
    const mon = weekMonday();
    if (L.addDays(mon, from) < today() || L.addDays(mon, to) < today()) return toast('Past days can’t be moved');
    const days = ensureWeek(p);
    const a = DAYS[from], b = DAYS[to];
    [days[a], days[b]] = [days[b], days[a]];
    toast(`${DAY_LONG[a]} and ${DAY_LONG[b]} swapped for this week`);
  },
  days(list, from, to) {
    const p = cur();
    const a = DAYS[from], b = DAYS[to];
    [p.days[a], p.days[b]] = [p.days[b], p.days[a]];
    toast(`${DAY_LONG[a]} and ${DAY_LONG[b]} swapped`);
  },
};

let drag = null;
document.addEventListener('pointerdown', (e) => {
  const handle = e.target.closest('[data-handle]');
  const list = handle?.closest('[data-sortable]');
  if (!list) return;
  e.preventDefault();
  const items = [...list.querySelectorAll(':scope > [data-idx]')];
  const item = handle.closest('[data-idx]');
  const rects = items.map((el) => el.getBoundingClientRect());
  const from = items.indexOf(item);
  drag = { list, items, item, rects, from, to: from, y: e.clientY, swap: list.dataset.mode === 'swap', pitch: items.length > 1 ? rects[1].top - rects[0].top : rects[0].height };
  handle.setPointerCapture(e.pointerId);
  item.classList.add('dragging');
});
document.addEventListener('pointermove', (e) => {
  if (!drag) return;
  const { items, item, rects, from, swap, pitch } = drag;
  const dy = e.clientY - drag.y;
  item.style.transform = `translateY(${dy}px)`;
  const centre = rects[from].top + rects[from].height / 2 + dy;
  let to = from;
  rects.forEach((r, i) => {
    const mid = r.top + r.height / 2;
    if (swap) {
      if (i !== from && !items[i].hasAttribute('data-locked') && centre > r.top && centre < r.bottom) to = i;
    } else if ((i < from && centre < mid) || (i > from && centre > mid)) {
      to = i < from ? Math.min(to, i) : Math.max(to, i);
    }
  });
  drag.to = to;
  items.forEach((el, i) => {
    if (el === item) return;
    if (swap) {
      el.classList.toggle('droptarget', i === to);
      return;
    }
    const shift = from < to && i > from && i <= to ? -pitch : from > to && i < from && i >= to ? pitch : 0;
    el.style.transform = shift ? `translateY(${shift}px)` : '';
  });
});
function endDrag() {
  if (!drag) return;
  const { list, items, from, to } = drag;
  items.forEach((el) => {
    el.style.transform = '';
    el.classList.remove('dragging', 'droptarget');
  });
  drag = null;
  if (from !== to) {
    SORT[list.dataset.sortable](list, from, to);
    save();
    render();
  }
}
document.addEventListener('pointerup', endDrag);
document.addEventListener('pointercancel', endDrag);

document.addEventListener('click', (e) => {
  if (e.target.closest('[data-handle]')) return;
  const el = e.target.closest('[data-act]');
  if (!el || el.disabled) return;
  const fn = A[el.dataset.act];
  if (!fn) return;
  e.preventDefault();
  fn({ ...el.dataset }, el);
});
document.addEventListener('input', (e) => {
  const el = e.target.closest('[data-input]');
  if (el && INP[el.dataset.input]) INP[el.dataset.input](el);
});
document.addEventListener('change', (e) => {
  const el = e.target.closest('[data-change]');
  if (el && CHG[el.dataset.change]) CHG[el.dataset.change](el);
});
document.addEventListener('submit', (e) => {
  const form = e.target.closest('[data-submit]');
  if (!form) return;
  e.preventDefault();
  SUB[form.dataset.submit](form);
});

// ---------- boot ----------

if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
// Offline cache on phones only; on localhost it would serve stale files while developing.
if ('serviceWorker' in navigator) {
  if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
    navigator.serviceWorker.getRegistrations().then((rs) => rs.forEach((r) => r.unregister()));
  } else {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
}
if (S.active) wake(true);
render(true);
// Get the sheet's latest copy on open and whenever the app comes back to the front.
pullRemote();
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') pullRemote();
});
