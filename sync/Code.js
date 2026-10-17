// Sort It Out sync (Google Apps Script web app).
// One Google Sheet per person, picked by their code (codes live in Config.js, which is not in git).
// The app POSTs JSON as text/plain: { code, action: 'load' | 'save' | 'rename' | 'changeCode', ... }.
// People can change their name and code from the app; those changes are kept in Script
// Properties ('codes': new code -> person, 'retiredCodes': Config.js codes no longer valid,
// 'name_<person>': display name). The person key (and their sheet) never changes.

function doPost(e) {
  let req;
  try {
    req = JSON.parse(e.postData.contents);
  } catch (err) {
    return reply({ ok: false, error: 'bad request' });
  }
  const code = String(req.code || '').trim();
  const person = personFor(code);
  if (!person) return reply({ ok: false, error: 'code' });

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const props = PropertiesService.getScriptProperties();
    const name = props.getProperty('name_' + person) || person;
    if (req.action === 'rename') {
      const nn = String(req.name || '').trim().slice(0, 30);
      if (!nn) return reply({ ok: false, error: 'name' });
      props.setProperty('name_' + person, nn);
      try { sheetFor(person).rename('Sort It Out – ' + nn); } catch (err) { /* keep the old file name */ }
      return reply({ ok: true, name: nn });
    }
    if (req.action === 'changeCode') {
      const nc = String(req.newCode || '').trim();
      if (!/^\d{4,8}$/.test(nc)) return reply({ ok: false, error: 'format' });
      if (nc !== code && personFor(nc)) return reply({ ok: false, error: 'taken' });
      const map = JSON.parse(props.getProperty('codes') || '{}');
      const retired = JSON.parse(props.getProperty('retiredCodes') || '[]');
      if (map[code]) delete map[code];
      else if (!retired.includes(code)) retired.push(code);
      map[nc] = person;
      props.setProperty('codes', JSON.stringify(map));
      props.setProperty('retiredCodes', JSON.stringify(retired.filter((c) => c !== nc)));
      return reply({ ok: true, name });
    }
    const ss = sheetFor(person);
    if (req.action === 'load') return reply({ ok: true, name, url: ss.getUrl(), ...loadState(ss) });
    if (req.action === 'save') {
      const savedAt = req.savedAt || Date.now();
      saveState(ss, req.state, savedAt);
      writeReadable(ss, req.state);
      return reply({ ok: true, name, savedAt });
    }
    return reply({ ok: false, error: 'action' });
  } finally {
    lock.releaseLock();
  }
}

// A code's person: a code set from the app first, then Config.js (unless it was changed away).
function personFor(code) {
  if (!code) return null;
  const props = PropertiesService.getScriptProperties();
  const map = JSON.parse(props.getProperty('codes') || '{}');
  if (map[code]) return map[code];
  const retired = JSON.parse(props.getProperty('retiredCodes') || '[]');
  if (retired.includes(code)) return null;
  return PEOPLE[code] || null;
}

function doGet() {
  return reply({ ok: true, app: 'Sort It Out sync' });
}

function reply(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// Run once from the editor: approves access and creates everyone's sheet.
function authorize() {
  Object.values(PEOPLE).forEach((name) => Logger.log(name + ': ' + sheetFor(name).getUrl()));
}

// ---------- sheets ----------

function sheetFor(name) {
  const props = PropertiesService.getScriptProperties();
  const key = 'sheet_' + name;
  const id = props.getProperty(key);
  if (id) {
    try {
      return SpreadsheetApp.openById(id);
    } catch (e) { /* deleted: make a new one */ }
  }
  const ss = SpreadsheetApp.create('Sort It Out – ' + name);
  ss.getSheets()[0].setName('Workouts');
  ss.insertSheet('Runs');
  ss.insertSheet('Targets');
  ss.insertSheet('App data').hideSheet();
  props.setProperty(key, ss.getId());
  return ss;
}

// The app's full data is kept as JSON in the hidden "App data" tab, split into chunks because a
// cell holds at most 50,000 characters. Each chunk starts with "~" so Sheets never reads it as a formula.
const CHUNK = 45000;

function loadState(ss) {
  const sh = ss.getSheetByName('App data');
  const n = sh.getLastRow();
  if (!n) return { state: null, savedAt: 0 };
  const vals = sh.getRange(1, 1, n, 2).getValues();
  const json = vals.map((r) => String(r[0]).slice(1)).join('');
  return { state: json ? JSON.parse(json) : null, savedAt: Number(vals[0][1]) || 0 };
}

function saveState(ss, state, savedAt) {
  const sh = ss.getSheetByName('App data');
  const json = JSON.stringify(state);
  const rows = [];
  for (let i = 0; i < json.length; i += CHUNK) rows.push(['~' + json.slice(i, i + CHUNK), '']);
  rows[0][1] = savedAt;
  sh.clearContents();
  sh.getRange(1, 1, rows.length, 2).setValues(rows);
}

// ---------- readable tabs (rebuilt on every save) ----------

const RUN_NAMES = { threshold: 'Threshold', long: 'Long', easy: 'Easy' };

function writeReadable(ss, st) {
  const exName = (id) => (st.exercises[id] || {}).name || id;
  const byDate = (a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
  const repsFor = (t, i) => {
    if (!t) return '';
    const sets = t.sets && t.sets.length ? t.sets : [t.reps];
    return sets[Math.min(i, sets.length - 1)];
  };

  const workouts = [['Date', 'Workout', 'Exercise', 'Set', 'Reps', 'Weight (kg)', 'Target reps', 'Target kg']];
  (st.sessions || []).slice().sort(byDate).forEach((s) => {
    s.entries.forEach((e) => {
      e.sets.forEach((x, i) => {
        workouts.push([s.date, s.workoutName, exName(e.exId), i + 1, x.reps, x.weight, repsFor(e.target, i), e.target ? e.target.weight : '']);
      });
    });
  });

  const runs = [['Date', 'Type', 'Distance (km)', 'Time', 'Pace (per km)']];
  (st.runs || []).slice().sort(byDate).forEach((r) => {
    runs.push([r.date, RUN_NAMES[r.type] || r.type, r.distKm, "'" + duration(r.timeSec), "'" + duration(r.timeSec / r.distKm)]);
  });

  // Targets are kept per workout ('<exId>@<workoutId>'); a bare '<exId>' is just the latest
  // from any workout, so only the current program's per-workout ones are listed.
  const cur = (st.programs || []).find((p) => p.id === st.currentId);
  const wName = (wid) => (cur && cur.workouts[wid] ? cur.workouts[wid].name : null);
  const targets = [['Exercise', 'Workout', 'Next weight (kg)', 'Next reps per set']];
  Object.keys(st.targets || {})
    .map((key) => {
      const [id, wid] = key.split('@');
      return wid ? (wName(wid) ? [exName(id), wName(wid), st.targets[key]] : null) : [exName(id), '', st.targets[key]];
    })
    .filter(Boolean)
    .filter((r, i, all) => r[1] || !all.some((x) => x[1] && x[0] === r[0]))
    .sort((a, b) => (a[0] + a[1] < b[0] + b[1] ? -1 : 1))
    .forEach(([name, w, t]) => {
      const sets = t.sets && t.sets.length ? t.sets : [t.reps];
      targets.push([name, w, t.weight, "'" + sets.join(' / ')]);
    });

  fill(ss.getSheetByName('Workouts'), workouts);
  fill(ss.getSheetByName('Runs'), runs);
  fill(ss.getSheetByName('Targets'), targets);
}

function fill(sh, rows) {
  sh.clearContents();
  sh.getRange(1, 1, rows.length, rows[0].length).setValues(rows);
  sh.setFrozenRows(1);
  sh.getRange(1, 1, 1, rows[0].length).setFontWeight('bold');
}

function duration(sec) {
  sec = Math.round(sec);
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = String(sec % 60).padStart(2, '0');
  return h ? h + ':' + String(m).padStart(2, '0') + ':' + s : m + ':' + s;
}
