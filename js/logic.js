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

// "12" when every set is the same, otherwise "12 / 11 / 10".
export const repsText = (arr) => (arr.every((r) => r === arr[0]) ? String(arr[0]) : arr.join(' / '));

const sum = (arr) => arr.reduce((a, b) => a + b, 0);

// One more rep on the weakest set (the first one, if several are equal).
function bumpLowest(arr, max) {
  const a = [...arr];
  const i = a.indexOf(Math.min(...a));
  if (a[i] < max) a[i]++;
  return a;
}

// ---------- strength: one score for any weight × reps ----------
// Epley estimate of a one-rep max. It's reliable up to roughly 12–15 reps, so reps past
// REP_CAP don't add any more (a 25-rep set can't claim a huge estimate). Bodyweight: reps.
export const REP_CAP = 15;
// (`cap` is raised for exercises whose own rep range goes higher, e.g. 12–20 flys.)
export const strength = (weight, reps, cap = REP_CAP) => (weight ? weight * (1 + Math.min(reps, cap) / 30) : reps);
export const setStrength = (s, cap) => strength(s.weight, s.reps, cap);
// Reps at `weight` that match a strength score (whole reps, rounded down so it never over-promises).
export const repsAt = (score, weight) => (weight ? Math.floor(30 * (score / weight - 1) + 1e-6) : Math.floor(score + 1e-6));
// A set counts as on target when it's at least as strong as the planned set, however
// the weight and reps were mixed (15 × 45 beats 10 × 50).
// Same weight: just compare reps.
export const beats = (s, weight, reps) => (s.weight === weight ? s.reps >= reps : setStrength(s) >= strength(weight, reps) - 1e-6);
const TOL = 0.005; // within 0.5% of the target's strength counts as the same

// Double progression (reps up to the top of the range, then weight), judged on strength
// so any mix of reps and weight is weighed fairly. Only the planned sets count towards
// the target; extra sets added on the day are bonus work and never lower it.
// cfg: { sets, min, max }  t: target { weight, sets }  done: [{ reps, weight }] in set order
// Returns the next target plus a short reason and direction for the summary.
export function nextTarget(cfg, step, t, done, missStreak = 0) {
  const tr = setTargets(t, cfg);
  const fill = (r) => Array(cfg.sets).fill(r);
  const out = (weight, sets, miss, dir, why) => ({ weight: Math.max(0, round(weight)), sets, reps: sets[0], miss, dir, why });
  const work = done.slice(0, cfg.sets);
  if (work.length < cfg.sets) return out(t.weight, tr, missStreak, 'same', 'Not all sets done, same target');

  const cap = Math.max(REP_CAP, cfg.max);
  const got = sum(work.map((s) => setStrength(s, cap)));
  const want = sum(tr.map((r) => strength(t.weight, r, cap)));
  const met = got >= want * (1 - TOL);

  // Bodyweight: reps only.
  if (!t.weight && work.every((s) => !s.weight)) {
    const reps = work.map((s) => s.reps);
    if (reps[0] >= cfg.max && reps.every((r) => r >= cfg.max - 1)) return out(step, fill(cfg.min), 0, 'up', `Top of range, add ${step} kg`);
    if (met) {
      const arr = bumpLowest(reps.map((r) => Math.min(r, cfg.max)), cfg.max);
      const gain = sum(arr) - sum(tr);
      return out(0, arr, 0, 'up', gain > 0 ? `+${gain} rep${gain > 1 ? 's' : ''}` : 'Same target');
    }
    if (missStreak >= 1) return out(0, reps.map((r) => clamp(r, 1, cfg.max)), 0, 'down', 'Short twice, reset to what you did');
    const short = sum(tr) - sum(reps);
    return out(0, tr, 1, 'same', `Short ${short} rep${short > 1 ? 's' : ''}, same target`);
  }

  // The weight most of the sets were done at (heavier on a tie).
  const count = {};
  work.forEach((s) => { count[s.weight] = (count[s.weight] || 0) + 1; });
  const used = Object.keys(count).map(Number).sort((a, b) => count[b] - count[a] || b - a)[0];
  // Lighter but at least as strong (15 × 45 vs 10 × 50): keep the planned weight.
  let w = used < t.weight && met ? t.weight : used;
  const off = work.some((s) => s.weight !== t.weight);
  // What each set is worth at weight `x`: actual reps if done at x, otherwise converted.
  const at = (x) => work.map((s) => (s.weight === x ? s.reps : repsAt(setStrength(s, cap), x)));
  let eq = at(w);

  // Even the first, freshest set is under the range: too heavy for now.
  if (eq[0] < cfg.min) {
    let n = 0;
    while (w > 0 && eq[0] < cfg.min && n++ < 20) { w = Math.max(0, round(w - step)); eq = at(w); }
    const arr = bumpLowest(eq.map((r) => clamp(r, 1, cfg.max)), cfg.max);
    // Went heavier than planned and was still stronger overall: that's progress, not a drop.
    if (met && w > t.weight) return out(w, arr, 0, 'up', `Stronger, moved up to ${w} kg`);
    return out(w, arr, 0, 'down', `Under ${cfg.min} reps, down to ${w} kg`);
  }
  // Top of the range: first set at the top, the rest within a rep of it. Add weight; the
  // reps to aim for come from your strength at the new weight, less one rep to be safe.
  if (eq[0] >= cfg.max && eq.every((r) => r >= cfg.max - 1)) {
    const nw = round(w + step);
    const arr = work.map((s) => clamp(repsAt(setStrength(s, cap), nw) - 1, cfg.min, cfg.max));
    return out(nw, arr, 0, 'up', `Top of range, +${round(nw - t.weight) || step} kg`);
  }
  if (met) {
    const arr = bumpLowest(eq.map((r) => clamp(r, 1, cfg.max)), cfg.max);
    if (off) {
      const odd = work.find((s) => s.weight !== t.weight);
      return out(w, arr, 0, 'up', w === t.weight ? `${odd.reps} × ${odd.weight} beat ${tr[0]} × ${t.weight}` : `Stronger, now at ${w} kg`);
    }
    const gain = sum(arr) - sum(tr);
    return out(w, arr, 0, 'up', gain > 0 ? `+${gain} rep${gain > 1 ? 's' : ''}` : 'Same target');
  }
  // Weaker than the target.
  if (w < t.weight) return out(w, bumpLowest(eq.map((r) => clamp(r, 1, cfg.max)), cfg.max), 0, 'down', `Dropped to ${w} kg, build back up`);
  const pct = Math.round((1 - got / want) * 100);
  if (missStreak >= 1) return out(w, eq.map((r) => clamp(r, 1, cfg.max)), 0, 'down', 'Short twice, reset to what you did');
  return out(t.weight, tr, 1, 'same', pct >= 1 ? `${pct}% short, same target` : 'Just short, same target');
}

// ---------- set-by-set adjustment during a workout ----------
// The next set's target, built from what the last set actually was rather than the plan.
// cfg: { sets, min, max }  plan: { weight, sets: [reps per set] }  logs: sets done so far.
// Keeps the plan's own set-to-set drop-off (e.g. 12 / 11 / 10), so beating or missing a set
// carries forward instead of being ignored. Way under or over the range moves the weight one step.
// Returns { reps, weight, why } — `why` is '' when it's just the plan.
export function liveSet(cfg, plan, step, logs) {
  const p = (i) => plan.sets[Math.min(i, plan.sets.length - 1)];
  const i = logs.length;
  if (!i) return { reps: p(0), weight: plan.weight, why: '' };
  const prev = liveSet(cfg, plan, step, logs.slice(0, -1));
  const last = logs[i - 1];
  const shape = p(i) - p(i - 1); // planned drop from the last set to this one (0 or less)
  const cap = last.weight ? cfg.max : Infinity; // bodyweight: no weight to add, so reps can keep climbing
  const res = (reps, weight, why) => {
    const r = { reps: clamp(reps, 1, cap), weight };
    const same = r.reps === p(i) && weight === plan.weight;
    return { ...r, why: same ? '' : why };
  };
  if (last.weight !== prev.weight) return res(last.reps + shape, last.weight, `Matched to your last set (${last.reps} × ${last.weight || 'BW'})`);
  // Way off the range: move the weight one step, with reps worked out from that set's strength.
  if (last.weight && last.reps <= Math.min(cfg.min, prev.reps) - 2) {
    const w = Math.max(0, round(last.weight - step));
    const r = w ? Math.max(repsAt(setStrength(last), w) + shape, Math.min(cfg.min, last.reps + 1)) : cfg.min;
    return res(r, w, `Last set was well under ${cfg.min} reps, −${step} kg`);
  }
  if (last.weight && last.reps >= Math.max(cfg.max, prev.reps) + 2) {
    const w = round(last.weight + step);
    return res(Math.max(cfg.min, repsAt(setStrength(last), w) + shape), w, `Last set was well over ${cfg.max} reps, +${step} kg`);
  }
  const why = last.reps > prev.reps ? `Up from your last set (${last.reps} reps)` : last.reps < prev.reps ? `Adjusted to your last set (${last.reps} reps)` : 'Following your last set';
  return res(last.reps + shape, last.weight, why);
}

// Estimated one-rep max (Epley) of the session's strongest set; reps alone for bodyweight.
export function e1rm(sets) {
  return Math.max(...sets.map(setStrength));
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
