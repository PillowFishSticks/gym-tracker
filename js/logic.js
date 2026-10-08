// Pure helpers: dates, progression rules and run maths. No DOM, no storage.

export const round = (x) => Math.round(x * 100) / 100;
export const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

// ---------- dates (all stored as local 'YYYY-MM-DD') ----------

export function isoDate(d = new Date()) {
  const z = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
}

export function parseDate(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(s, n) {
  const d = parseDate(s);
  d.setDate(d.getDate() + n);
  return isoDate(d);
}

function mondayOf(s) {
  const d = parseDate(s);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}

// Week 1 is the Monday-to-Sunday week the program started in.
export function weekOf(start, date) {
  const days = Math.round((mondayOf(date) - mondayOf(start)) / 86400000);
  return Math.floor(days / 7) + 1;
}

// Sunday of the program's last week.
export function endOfProgram(start, weeks) {
  return addDays(isoDate(mondayOf(start)), weeks * 7 - 1);
}

export function fmtDate(s, opts = {}) {
  return parseDate(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', ...opts });
}

export function fmtMonthYear(s) {
  return parseDate(s).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
}

// ---------- lifting progression (double progression) ----------
// Each set has its own rep target, because later sets naturally drop off with fatigue.
// A target is { weight, sets: [reps per set] } (older data may only have `reps`).
export function setTargets(t, cfg) {
  const base = t && Array.isArray(t.sets) && t.sets.length ? t.sets : [t?.reps ?? cfg.min];
  // A later set may sit below the range (fatigue); nothing goes above the top.
  return Array.from({ length: cfg.sets }, (_, i) => clamp(base[Math.min(i, base.length - 1)], 1, cfg.max));
}

// "12" when every set is the same, otherwise "12/11/10".
export const repsText = (arr) => (arr.every((r) => r === arr[0]) ? String(arr[0]) : arr.join('/'));

const sum = (arr) => arr.reduce((a, b) => a + b, 0);

// One more rep on the weakest set (the first one, if several are equal).
function bumpLowest(arr, max) {
  const a = [...arr];
  const i = a.indexOf(Math.min(...a));
  if (a[i] < max) a[i]++;
  return a;
}

// Double progression, judged on the session as a whole.
// cfg: { sets, min, max }  t: target { weight, sets }  done: [{ reps, weight }] in set order
// Returns the next target plus a short reason and direction for the summary.
export function nextTarget(cfg, step, t, done, missStreak = 0) {
  const tr = setTargets(t, cfg);
  const fill = (r) => Array(cfg.sets).fill(r);
  const out = (weight, sets, miss, dir, why) => ({ weight, sets, reps: sets[0], miss, dir, why });
  const reps = done.map((s) => s.reps);
  const minW = Math.min(...done.map((s) => s.weight));

  // Had to go lighter: start from what was managed at that weight and build back up.
  if (minW < t.weight) {
    const at = done.filter((s) => s.weight === minW).map((s) => s.reps);
    const arr = tr.map((_, i) => clamp(at[Math.min(i, at.length - 1)], 1, cfg.max));
    return out(minW, bumpLowest(arr, cfg.max), 0, 'down', `Dropped to ${minW} kg, build back up`);
  }
  // Even the first, freshest set couldn't reach the range: too heavy for now.
  // (Later sets dropping below it is normal fatigue and is handled below.)
  if (reps[0] < cfg.min) {
    return out(Math.max(0, round(t.weight - step)), fill(cfg.min), 0, 'down', `Under ${cfg.min} reps, −${step} kg`);
  }
  if (done.length < cfg.sets) {
    return out(t.weight, tr, missStreak, 'same', 'Not all sets done, same target');
  }
  // Top of the range: first set at the top, the rest within a rep of it.
  if (reps[0] >= cfg.max && reps.every((r) => r >= cfg.max - 1)) {
    return out(round(t.weight + step), fill(cfg.min), 0, 'up', `Top of range, +${step} kg`);
  }
  const got = sum(reps), want = sum(tr);
  if (got >= want) {
    const arr = bumpLowest(reps.map((r) => Math.min(r, cfg.max)), cfg.max);
    const gain = sum(arr) - want;
    return out(t.weight, arr, 0, 'up', gain > 0 ? `+${gain} rep${gain > 1 ? 's' : ''}` : 'Same target');
  }
  const short = want - got;
  if (missStreak >= 1) {
    return out(t.weight, reps.map((r) => Math.min(r, cfg.max)), 0, 'down', 'Short twice, reset to what you did');
  }
  return out(t.weight, tr, 1, 'same', `Short ${short} rep${short > 1 ? 's' : ''}, same target`);
}

// Estimated one-rep max (Epley) of the session's strongest set; reps alone for bodyweight.
export function e1rm(sets) {
  return Math.max(...sets.map((s) => (s.weight ? s.weight * (1 + s.reps / 30) : s.reps)));
}

// Heaviest set, then most reps at that weight.
export function bestSet(sets) {
  return sets.reduce((b, s) => (!b || s.weight > b.weight || (s.weight === b.weight && s.reps > b.reps) ? s : b), null);
}

// ---------- runs ----------

// "28:30" / "28.30" -> 1710, "1:05:00" -> 3900, "28" -> 1680 (whole minutes).
// Dots and commas count as colons because phone number pads have no colon key.
export function parseDuration(str) {
  const s = String(str || '').trim().replace(/[.,]/g, ':');
  if (!s) return null;
  if (/^\d+$/.test(s)) return parseInt(s, 10) * 60;
  const p = s.split(':').map((x) => (x === '' ? NaN : Number(x)));
  if (p.some((x) => Number.isNaN(x)) || p.slice(1).some((x) => x >= 60)) return null;
  if (p.length === 2) return p[0] * 60 + p[1];
  if (p.length === 3) return p[0] * 3600 + p[1] * 60 + p[2];
  return null;
}

export function fmtDuration(sec) {
  if (sec == null || !Number.isFinite(sec)) return '';
  sec = Math.round(sec);
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = String(sec % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
}

export function parseKm(str) {
  const v = parseFloat(String(str || '').replace(',', '.'));
  return v > 0 ? v : null;
}

export function fmtKm(km) {
  const r = Math.round(km * 100) / 100;
  return Number.isInteger(r) ? r.toFixed(1) : String(r);
}

export const paceOf = (run) => run.timeSec / run.distKm;
