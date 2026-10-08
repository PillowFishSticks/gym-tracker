// Google Sheets sync through the "Sort It Out sync" Apps Script web app (see /sync).
// Each person signs in with their code once; it's remembered on this phone.

export const SYNC_URL = 'https://script.google.com/macros/s/AKfycbxErm0GO2aeMu92lvFNI6U3rgvcWj6wAXjigP9A40DytV51gQti33Vz0wx2fYMixiGQXg/exec';

const SESSION_KEY = 'sort-it-out:session';
const DIRTY_KEY = 'sort-it-out:dirty';

const read = (k) => {
  try {
    return JSON.parse(localStorage.getItem(k));
  } catch (e) {
    return null;
  }
};
const write = (k, v) => {
  try {
    if (v == null) localStorage.removeItem(k);
    else localStorage.setItem(k, JSON.stringify(v));
  } catch (e) { /* storage blocked */ }
};

export const getSession = () => read(SESSION_KEY); // { code, name, url }
export const setSession = (s) => write(SESSION_KEY, s);

// "Dirty" = this phone has changes the sheet hasn't got yet.
export const isDirty = () => !!read(DIRTY_KEY);
export const setDirty = (v) => write(DIRTY_KEY, v ? true : null);

// text/plain keeps it a "simple" request, so the browser doesn't need a CORS preflight.
async function call(body) {
  const res = await fetch(SYNC_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export const loadRemote = (code) => call({ code, action: 'load' });
export const pushRemote = (code, state, savedAt) => call({ code, action: 'save', state, savedAt });
