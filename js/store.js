// store.js — the ONLY persistence path for Forge.
// All reads/writes to localStorage go through here. UI and engine never touch
// localStorage directly. A schema change must MIGRATE existing data, never wipe it:
// bump SCHEMA_VERSION and add a function to MIGRATIONS.

const KEY = 'forge_state';
export const SCHEMA_VERSION = 3;

function defaultState() {
  return {
    schemaVersion: SCHEMA_VERSION,
    // profile: set during onboarding. null = first run.
    profile: null, // { name, sex, age, heightIn, bodyweight, units, injuries:[], experience, hasPullupBar, sandbagMax }
    settings: { units: 'lb', restDefault: 150, sound: true, autoRest: true },
    // maxes: the engine's working model of the athlete. Updated automatically from logs.
    maxes: {}, // see seedMaxes(): { deadlift:{e1rm,updated}, ..., pull_up:{maxReps,updated}, mile:{seconds,updated} }
    // program pointer. Training advances by completed sessions, not the calendar,
    // so a missed day never desyncs the plan.
    program: { startDateISO: null, absWeek: 0, sessionInWeek: 0 },
    readiness: [],   // [{dateISO, sleep, soreness, energy, stress, motivation, score}]
    body: [],        // [{dateISO, weight, bodyfat, restingHR, hrv, sleepHrs}] — Hume / Apple Health bridge
    tweaks: [],      // [{area, sinceISO}] — flagged niggles the engine trains around
    sessions: [],    // completed session logs (the permanent record)
    active: null,    // in-progress workout, persisted so a refresh never loses a set
    history: {},     // { exerciseId: [{dateISO, weight, reps, rpe, e1rm, bw}] } — fast index for charts/engine
    meta: { createdISO: null, lastBackupISO: null },
  };
}

// --- migrations: index N upgrades a v(N) state to v(N+1). Append, never edit. ---
const MIGRATIONS = [
  // v1 → v2: add the body/recovery log (Hume / Apple Health bridge)
  (s) => { if (!Array.isArray(s.body)) s.body = []; return s; },
  // v2 → v3: add the niggle/tweak list, seeded from any onboarding injuries
  (s) => {
    if (!Array.isArray(s.tweaks)) {
      s.tweaks = [];
      const since = (s.meta && s.meta.createdISO) || new Date().toISOString();
      for (const a of ((s.profile && s.profile.injuries) || [])) if (a && a !== 'none') s.tweaks.push({ area: a, sinceISO: since });
    }
    return s;
  },
];

function migrate(state) {
  let v = state.schemaVersion || 1;
  while (v < SCHEMA_VERSION && MIGRATIONS[v - 1]) {
    state = MIGRATIONS[v - 1](state);
    v += 1;
    state.schemaVersion = v;
  }
  return state;
}

let state = null;
const subscribers = new Set();

export function load() {
  if (state) return state;
  let raw = null;
  try { raw = localStorage.getItem(KEY); } catch (e) { /* private mode etc. */ }
  if (!raw) {
    state = defaultState();
    state.meta.createdISO = new Date().toISOString();
    persist();
  } else {
    try {
      state = migrate(JSON.parse(raw));
    } catch (e) {
      console.error('Forge: corrupt state, starting fresh. A backup of the raw value is in console.', raw);
      state = defaultState();
    }
  }
  return state;
}

export function get() { return state || load(); }

function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); }
  catch (e) { console.error('Forge: failed to save (storage full or blocked).', e); }
}

export function subscribe(fn) { subscribers.add(fn); return () => subscribers.delete(fn); }
function notify() { subscribers.forEach((fn) => { try { fn(state); } catch (e) { console.error(e); } }); }

// The one mutation primitive. mutator gets the live state; we persist + notify after.
export function update(mutator) {
  if (!state) load();
  mutator(state);
  persist();
  notify();
  return state;
}

// --- convenience helpers (thin; all just call update) ---

export function setProfile(profile) {
  update((s) => {
    s.profile = profile;
    s.settings.units = profile.units || s.settings.units;
    if (!s.program.startDateISO) s.program.startDateISO = new Date().toISOString();
  });
}

export function setSettings(patch) { update((s) => { Object.assign(s.settings, patch); }); }

export function seedMaxes(maxes) { update((s) => { Object.assign(s.maxes, maxes); }); }

export function logReadiness(entry) {
  update((s) => {
    const day = entry.dateISO.slice(0, 10);
    // one readiness entry per day — replace if re-checked
    s.readiness = s.readiness.filter((r) => r.dateISO.slice(0, 10) !== day);
    s.readiness.push(entry);
  });
}

export function todayReadiness() {
  const s = get();
  const day = new Date().toISOString().slice(0, 10);
  return s.readiness.find((r) => r.dateISO.slice(0, 10) === day) || null;
}

// Body & recovery — weight, body-fat, resting HR, HRV, sleep (from Hume via Apple Health, or manual).
export function logBody(entry) {
  update((s) => {
    const day = entry.dateISO.slice(0, 10);
    s.body = (s.body || []).filter((b) => b.dateISO.slice(0, 10) !== day);
    s.body.push(entry);
    if (entry.weight && s.profile) s.profile.bodyweight = entry.weight; // keep load math + 2×BW targets current
  });
}
export function latestBody() {
  const s = get();
  const arr = (s.body || []).slice().sort((a, b) => (a.dateISO < b.dateISO ? 1 : -1));
  return arr[0] || null;
}
export function todayBody() {
  const s = get();
  const day = new Date().toISOString().slice(0, 10);
  return (s.body || []).find((b) => b.dateISO.slice(0, 10) === day) || null;
}

// Niggles / tweaks the engine trains around.
export function addTweaks(areas) {
  update((s) => {
    const have = new Set((s.tweaks || []).map((t) => t.area));
    for (const a of (areas || [])) if (a && a !== 'none' && !have.has(a)) { s.tweaks.push({ area: a, sinceISO: new Date().toISOString() }); have.add(a); }
  });
}
export function removeTweak(area) { update((s) => { s.tweaks = (s.tweaks || []).filter((t) => t.area !== area); }); }
export function activeTweaks() { return get().tweaks || []; }

export function startSession(session) { update((s) => { s.active = session; }); }
export function patchActive(mutator) { update((s) => { if (s.active) mutator(s.active); }); }
export function clearActive() { update((s) => { s.active = null; }); }

// Finalize a workout: append to permanent log, index history, advance the pointer.
export function commitSession(session) {
  update((s) => {
    s.sessions.push(session);
    s.active = null;
    // index every logged set into history for charts + engine
    for (const entry of session.entries || []) {
      if (!entry.exerciseId) continue;
      const arr = (s.history[entry.exerciseId] = s.history[entry.exerciseId] || []);
      for (const set of entry.sets || []) {
        if (!set.done) continue;
        arr.push({
          dateISO: session.dateISO,
          weight: set.weight ?? null,
          reps: set.reps ?? null,
          rpe: set.rpe ?? null,
          e1rm: set.e1rm ?? null,
          bw: s.profile ? s.profile.bodyweight : null,
        });
      }
    }
    advancePointer(s);
  });
}

// Move to the next session in the week; roll to next week after the 4th.
function advancePointer(s) {
  s.program.sessionInWeek = (s.program.sessionInWeek || 0) + 1;
  if (s.program.sessionInWeek >= 4) {
    s.program.sessionInWeek = 0;
    s.program.absWeek = (s.program.absWeek || 0) + 1;
  }
}

// Manual pointer control (Settings / Plan view "jump to week").
export function setPointer({ absWeek, sessionInWeek }) {
  update((s) => {
    if (absWeek != null) s.program.absWeek = Math.max(0, absWeek | 0);
    if (sessionInWeek != null) s.program.sessionInWeek = Math.max(0, Math.min(3, sessionInWeek | 0));
  });
}

export function exportJSON() {
  update((s) => { s.meta.lastBackupISO = new Date().toISOString(); });
  return JSON.stringify(get(), null, 2);
}

export function importJSON(str) {
  const parsed = JSON.parse(str); // throws on bad JSON — caller handles
  if (!parsed || typeof parsed !== 'object' || !('schemaVersion' in parsed)) {
    throw new Error('Not a Forge backup file.');
  }
  state = migrate(parsed);
  persist();
  notify();
  return state;
}

// Destructive — UI must confirm + offer export first (CLAUDE.md rule).
export function resetAll() {
  state = defaultState();
  state.meta.createdISO = new Date().toISOString();
  persist();
  notify();
  return state;
}
