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
// cfg: { sets, min, max }  t: target { weight, reps }  sets: [{ reps, weight }]
// Returns next target plus a short reason and direction for the summary.
export function nextTarget(cfg, step, t, sets, missStreak = 0) {
  const minReps = Math.min(...sets.map((s) => s.reps));
  const minW = Math.min(...sets.map((s) => s.weight));
  const allHit = sets.every((s) => s.weight >= t.weight && s.reps >= t.reps);

  if (allHit && sets.length >= cfg.sets) {
    if (minReps >= cfg.max) {
      return { weight: round(t.weight + step), reps: cfg.min, miss: 0, dir: 'up', why: `Top of range hit · +${step} kg` };
    }
    const reps = Math.min(Math.max(minReps, t.reps) + 1, cfg.max);
    const added = reps - t.reps;
    return { weight: t.weight, reps, miss: 0, dir: 'up', why: `+${added} rep${added > 1 ? 's' : ''}` };
  }
  if (allHit) {
    return { weight: t.weight, reps: t.reps, miss: missStreak, dir: 'same', why: 'Not all sets done · same target' };
  }
  if (minW < t.weight) {
    const low = Math.min(...sets.filter((s) => s.weight === minW).map((s) => s.reps));
    return { weight: minW, reps: clamp(low + 1, cfg.min, cfg.max), miss: 0, dir: 'down', why: `Dropped to ${minW} kg · build back up` };
  }
  // Only drop the weight when most sets fell below the range, not for one bad last set.
  if (sets.filter((s) => s.reps < cfg.min).length * 2 > sets.length) {
    return { weight: Math.max(0, round(t.weight - step)), reps: cfg.min, miss: 0, dir: 'down', why: `Under ${cfg.min} reps · −${step} kg` };
  }
  if (missStreak >= 1) {
    const reps = Math.max(cfg.min, minReps);
    return { weight: t.weight, reps, miss: 0, dir: 'down', why: `Missed twice · reset to ${reps} reps` };
  }
  return { weight: t.weight, reps: t.reps, miss: 1, dir: 'same', why: 'Missed · same target' };
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
