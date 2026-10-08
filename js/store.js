// All data lives in this browser's localStorage under one key.
const KEY = 'gym-tracker:v1';

export const blank = () => ({
  v: 1,
  exercises: {},   // id -> { id, name, step }
  targets: {},     // exerciseId -> { weight, reps, miss }
  programs: [],    // { id, name, weeks, startDate, endDate, archived, days, workouts }
  currentId: null,
  sessions: [],    // { id, date, programId, workoutId, workoutName, minutes, entries: [{ exId, cfg, target, sets }] }
  runs: [],        // { id, date, programId, type, distKm, timeSec }
  active: null,    // workout in progress
  lastSummary: null,
});

export function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    if (s && s.v === 1) return { ...blank(), ...s };
  } catch (e) { /* fall through to a fresh store */ }
  return blank();
}

export function save(s) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
    return true;
  } catch (e) {
    return false;
  }
}

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
