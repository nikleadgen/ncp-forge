// engine.js — the autoregulation brain. Pure functions over `state` (no storage side effects;
// the caller persists). Turns the plan into concrete prescriptions and learns from logs.
//
// Four loops of adjustment (per the brief):
//   set-to-set   → adjustAfterSet(): RPE off target nudges the next set's load
//   session      → readinessScale(): today's 5-tap check scales load + volume
//   week         → computeACWR(): acute:chronic workload guards against doing too much
//   cycle        → ingestModel(): logged PRs raise the working maxes that drive future loads
//
// All numbers trace to docs/PROGRAM-SCIENCE.md.

import { getExercise, EXERCISES } from './exercises.js';
import { planContext, getSession, getDay, COMMON_DAYS, dateForWeek, MACRO, LIFT_FLAVORS, liftFocus } from './program.js';

// ---------- equipment routing (proxy lifts you can't yet load) ----------
// The only odd-object work in the plan is sandbag-based. Until a loaded sandbag is
// ready (settings.equipment.sandbag), route those lifts to proxies using gear on hand:
// explosive shoulder/clean → dumbbell cleans, zercher squat → goblet, carry → DB farmer.
// Flip the toggle on and the real sandbag work returns automatically — no data lost.
const SANDBAG_PROXY = {
  sandbag_shoulder: 'kb_clean',
  sandbag_clean: 'kb_clean',
  sandbag_zercher: 'goblet_squat',
  sandbag_carry: 'farmer_carry',
};
export function sandbagReady(state) { return !!(state && state.settings && state.settings.equipment && state.settings.equipment.sandbag); }

// Resolve a planned exercise to what the athlete actually does today: their saved swap
// preference wins, then equipment routing. Returns { id, proxied } (proxied = sandbag→gear).
function routeExercise(state, baseEx) {
  const prefs = (state && state.settings && state.settings.exPrefs) || {};
  let id = baseEx, proxied = false;
  if (prefs[baseEx] && EXERCISES[prefs[baseEx]]) id = prefs[baseEx];
  if (getExercise(id).load === 'sandbag' && !sandbagReady(state) && SANDBAG_PROXY[id]) { id = SANDBAG_PROXY[id]; proxied = true; }
  return { id, proxied };
}
export function effectiveExId(state, exId) { return routeExercise(state, exId).id; }

// ---------- strength math ----------
// Reps-to-failure → %1RM (RTS/Helms style). Index = reps you could do to true failure.
const RTF = [null, 1.00, 0.955, 0.92, 0.892, 0.863, 0.837, 0.811, 0.786, 0.762, 0.739, 0.717, 0.696];
function pctFromRTF(n) {
  n = Math.max(1, Math.round(n));
  if (n < RTF.length) return RTF[n];
  return Math.max(0.35, 0.696 - (n - 12) * 0.021); // linear extrapolation past 12
}
export function loadForReps(e1rm, reps, rir) { return e1rm * pctFromRTF(reps + rir); }
export function e1rmFromSet(weight, reps, rir = 0) {
  if (!weight || !reps) return 0;
  return weight / pctFromRTF(reps + rir);
}

export function roundLoad(load, type, units = 'lb') {
  if (!load || load <= 0) return 0;
  const kg = units === 'kg';
  let inc = kg ? 2.5 : 5, min = 0, max = Infinity;
  switch (type) {
    case 'barbell': inc = kg ? 2.5 : 5; min = kg ? 20 : 45; break;       // empty bar floor
    case 'dumbbell': inc = kg ? 2.5 : 5; max = kg ? 36 : 80; break;       // adjustable DB ceiling per hand
    case 'cable': inc = kg ? 2.5 : 5; break;
    case 'sandbag': inc = kg ? 5 : 10; break;
    default: inc = kg ? 2.5 : 5;
  }
  let r = Math.round(load / inc) * inc;
  if (type === 'barbell') r = Math.max(min, r);
  if (isFinite(max)) r = Math.min(max, r);
  return r;
}

// ---------- plate math ----------
// What to actually hang on the bar, so nobody does arithmetic mid-set. Greedy from the heaviest
// plate down, per side. Bars differ (an EZ bar isn't 45), so each is named in exercises.js.
const BARS = { standard: { lb: 45, kg: 20 }, ez: { lb: 25, kg: 11 }, trap: { lb: 60, kg: 27 } };
const PLATES = { lb: [45, 35, 25, 15, 10, 5, 2.5, 1.25], kg: [25, 20, 15, 10, 5, 2.5, 1.25] };
const num = (n) => (Math.round(n * 100) / 100).toString();

export function barWeight(exId, units = 'lb') {
  const ex = getExercise(exId);
  if (ex.load !== 'barbell') return null;
  return (BARS[ex.bar] || BARS.standard)[units === 'kg' ? 'kg' : 'lb'];
}

// → { bar, perSide:[{plate,count}], exact, short } or null when plates don't apply.
export function plateMath(total, exId, units = 'lb') {
  const bar = barWeight(exId, units);
  if (bar == null || total == null || total <= 0) return null;
  const standard = bar === BARS.standard[units === 'kg' ? 'kg' : 'lb'];
  if (total <= bar) return { bar, standard, perSide: [], exact: total === bar, short: 'just the bar' };
  let side = (total - bar) / 2;
  const out = [];
  for (const p of PLATES[units === 'kg' ? 'kg' : 'lb']) {
    const n = Math.floor((side + 1e-9) / p);
    if (n > 0) { out.push({ plate: p, count: n }); side -= n * p; }
  }
  const exact = side < 1e-6;
  return { bar, standard, perSide: out, exact,
    short: out.map((o) => (o.count > 1 ? o.count + '×' : '') + num(o.plate)).join(' · ')
      + (exact ? '' : ` (+${num(side * 2)} short)`) };
}

// Conservative default e1RM as a multiple of bodyweight (per hand for DB lifts). Seeds the very
// first prescriptions; real logs overwrite these within a couple of sessions.
const E1RM_MULT = {
  deadlift: 1.0, trap_bar_deadlift: 1.05, romanian_deadlift: 0.7, back_squat: 0.85, front_squat: 0.65,
  overhead_press: 0.45, push_press: 0.55, bench_press: 0.6, barbell_row: 0.55, hip_thrust: 1.1, ez_curl: 0.3,
  db_bench_press: 0.28, db_floor_press: 0.26, db_shoulder_press: 0.2, db_row: 0.3, db_rdl: 0.3,
  goblet_squat: 0.4, bulgarian_split_squat: 0.22, db_reverse_lunge: 0.22, walking_lunge: 0.2, db_step_up: 0.2,
  db_curl: 0.12, db_hip_thrust: 0.4, kb_swing: 0.25, db_snatch: 0.18, kb_clean: 0.25, db_push_press: 0.22,
  farmer_carry: 0.45, lat_pulldown: 0.6, cable_row: 0.5, face_pull: 0.2, tricep_pushdown: 0.25,
  sandbag_shoulder: 0.5, sandbag_clean: 0.5, sandbag_zercher: 0.55, sandbag_carry: 0.55, suitcase_carry: 0.4,
};
const DEFAULT_REPS_MAX = { pull_up: 3, chin_up: 4, push_up: 15, hand_release_push_up: 12, air_squat: 40,
  inverted_row: 10, hanging_leg_raise: 8, ab_wheel: 6 };

function bw(profile) { return (profile && profile.bodyweight) || 175; }
export function defaultE1RM(exId, profile) {
  const m = E1RM_MULT[exId];
  if (m != null) return Math.round(m * bw(profile));
  return Math.round(0.4 * bw(profile));
}
function currentE1RM(state, exId, profile) {
  const rec = state.maxes && state.maxes[exId];
  return (rec && rec.e1rm) ? rec.e1rm : defaultE1RM(exId, profile);
}
function currentMaxReps(state, exId) {
  const rec = state.maxes && state.maxes[exId];
  if (rec && rec.maxReps) return rec.maxReps;
  // Never measured this one — borrow from the nearest lift you HAVE measured before falling
  // back to a table default (9 pull-ups shouldn't prescribe 3 chin-ups).
  for (const sid of (getExercise(exId).sub || [])) {
    const r = state.maxes && state.maxes[sid];
    if (r && r.maxReps) return r.maxReps;
  }
  return DEFAULT_REPS_MAX[exId] || 10;
}
function mileSeconds(state) {
  const rec = state.maxes && state.maxes.mile;
  return (rec && rec.seconds) ? rec.seconds : 600; // 10:00 detrained default
}

// ---------- seed model from onboarding ----------
export function seedFromOnboarding(profile, known = {}) {
  const maxes = {};
  const now = new Date().toISOString();
  const set = (id, e1rm) => { maxes[id] = { e1rm: Math.round(e1rm), updated: now }; };
  // Known lifts → e1RM (entered as a recent weight×reps, or a known 1RM)
  if (known.deadlift) set('deadlift', known.deadlift);
  else set('deadlift', defaultE1RM('deadlift', profile));
  if (known.back_squat) set('back_squat', known.back_squat);
  else set('back_squat', defaultE1RM('back_squat', profile));
  if (known.overhead_press) set('overhead_press', known.overhead_press);
  else set('overhead_press', defaultE1RM('overhead_press', profile));
  // bodyweight rep maxes
  maxes.pull_up = { maxReps: known.pull_up != null ? known.pull_up : DEFAULT_REPS_MAX.pull_up, updated: now };
  maxes.push_up = { maxReps: known.push_up != null ? known.push_up : DEFAULT_REPS_MAX.push_up, updated: now };
  maxes.hand_release_push_up = { maxReps: Math.round((maxes.push_up.maxReps) * 0.85), updated: now };
  maxes.air_squat = { maxReps: 40, updated: now };
  // mile
  maxes.mile = { seconds: known.mile_seconds || 600, updated: now };
  // sandbag
  maxes.sandbag = { weight: known.sandbag || (profile.sandbagMax || Math.round(0.5 * bw(profile))), updated: now };
  return maxes;
}

// ---------- readiness (session loop) ----------
// entry fields each 1–5 where 5 = good (fresh/calm/energized/motivated/well-slept).
export function readinessScore(entry) {
  if (!entry) return null;
  const keys = ['sleep', 'soreness', 'energy', 'stress', 'motivation'];
  const vals = keys.map((k) => entry[k]).filter((v) => typeof v === 'number');
  if (!vals.length) return null;
  const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
  return Math.round(avg * 20); // 20–100
}
export function readinessScale(entry) {
  const score = readinessScore(entry);
  if (score == null) return { score: null, band: 'unknown', color: '#8a94a6', loadMult: 1, volMult: 1, message: '', downgrade: false };
  if (score >= 85) return { score, band: 'Primed', color: '#36d399', loadMult: 1.0, volMult: 1.0, message: 'Green light — attack it. A bonus set is fair game if you feel it.', downgrade: false };
  if (score >= 70) return { score, band: 'Ready', color: '#6ee7a8', loadMult: 1.0, volMult: 1.0, message: 'Solid. Run the plan as written.', downgrade: false };
  if (score >= 55) return { score, band: 'Moderate', color: '#fbbf24', loadMult: 0.95, volMult: 0.9, message: 'A bit flat — trimmed load slightly and dropped the last optional set.', downgrade: false };
  if (score >= 40) return { score, band: 'Low', color: '#fb923c', loadMult: 0.9, volMult: 0.8, message: 'Under-recovered — lighter loads, a set cut, hard intervals eased to steady.', downgrade: true };
  return { score, band: 'Depleted', color: '#f87171', loadMult: 0.85, volMult: 0.6, message: 'Recovery first. Treat today as technique + easy movement. No grinding — consider resting.', downgrade: true };
}

// Blend subjective readiness with today's objective recovery data (HRV/sleep from Hume).
export function combinedReadiness(state) {
  const day = new Date().toISOString().slice(0, 10);
  const subj = (state.readiness || []).find((r) => r.dateISO.slice(0, 10) === day) || null;
  const scale = readinessScale(subj);
  const body = (state.body || []).find((b) => b.dateISO.slice(0, 10) === day) || null;
  if (!body) return scale;
  let mult = 1; const notes = [];
  const hrvs = (state.body || []).filter((b) => b.hrv).map((b) => b.hrv);
  if (body.hrv && hrvs.length >= 3) {
    const recent = hrvs.slice(-14);
    const base = recent.reduce((a, b) => a + b, 0) / recent.length;
    if (body.hrv < base * 0.85) { mult *= 0.95; notes.push('HRV is below your baseline — eased the load a touch.'); }
    else if (body.hrv > base * 1.1) { notes.push('HRV is strong today.'); }
  }
  if (body.sleepHrs && body.sleepHrs < 6) { mult *= 0.95; notes.push('Short sleep — trimmed intensity; skip max-effort impact work.'); }
  if (mult !== 1) scale.loadMult = +(scale.loadMult * mult).toFixed(3);
  if (notes.length) scale.message = (scale.message + ' ' + notes.join(' ')).trim();
  scale.body = body;
  return scale;
}

function latestRecovery(state) {
  const arr = (state.body || []).slice().sort((a, b) => (a.dateISO < b.dateISO ? 1 : -1));
  const b = arr[0];
  return b ? { hrv: b.hrv || null, restingHR: b.restingHR || null, sleepHrs: b.sleepHrs || null, bodyfat: b.bodyfat || null, weight: b.weight || null, date: b.dateISO } : null;
}

// ---------- ACWR (week loop) ----------
function sessionLoad(s) {
  const rpe = s.sessionRPE || 6;
  const dur = s.durationMin || 45;
  return rpe * dur; // session-RPE load (AU)
}
export function computeACWR(state) {
  const now = Date.now();
  const day = 86400000;
  const sessions = state.sessions || [];
  let acute = 0, chronic = 0, chronicDays = 0;
  const oldest = sessions.reduce((min, s) => Math.min(min, new Date(s.dateISO).getTime()), now);
  const historyDays = (now - oldest) / day;
  for (const s of sessions) {
    const age = (now - new Date(s.dateISO).getTime()) / day;
    const load = sessionLoad(s);
    if (age <= 7) acute += load;
    if (age <= 28) chronic += load;
  }
  const chronicWeekly = chronic / 4;
  const established = historyDays >= 21 && sessions.length >= 6;
  const ratio = (established && chronicWeekly > 0) ? acute / chronicWeekly : null;
  let status = 'building', color = '#8a94a6', advice = 'Building your baseline — keep progressing steadily.';
  const off = layoffScale(state);
  if (ratio != null) {
    // A layoff also reads as "low load" — but the answer there is ease back in, not push harder.
    if (ratio < 0.8 && off.days >= 14) { status = 'returning'; color = '#fbbf24'; advice = `${off.days} days since your last session — ease back in for a session or two before pushing.`; }
    else if (ratio < 0.8) { status = 'detraining-risk'; color = '#60a5fa'; advice = 'Load is dipping below your baseline — you can push a little more.'; }
    else if (ratio <= 1.3) { status = 'optimal'; color = '#36d399'; advice = 'Sweet spot — fitness rising, injury risk low.'; }
    else if (ratio <= 1.5) { status = 'caution'; color = '#fbbf24'; advice = 'Ramping fast — hold volume steady this week.'; }
    else { status = 'high-risk'; color = '#f87171'; advice = 'Spiking — back off. Extra easy day or a deload is wise.'; }
  }
  return { acute: Math.round(acute), chronicWeekly: Math.round(chronicWeekly), ratio, status, color, advice, established };
}
function acwrDamp(acwr) {
  if (!acwr.established || acwr.ratio == null) return 1;
  if (acwr.ratio > 1.5) return 0.85;
  if (acwr.ratio > 1.3) return 0.95;
  return 1;
}

// ---------- pace helpers ----------
export function fmtTime(sec) {
  sec = Math.max(0, Math.round(sec));
  const m = Math.floor(sec / 60), s = sec % 60;
  return m + ':' + String(s).padStart(2, '0');
}
function paceHint(state, mode) {
  const mile = mileSeconds(state);
  if (mode === 'easy' || mode === 'walkrun') return 'Conversational — you can speak full sentences.';
  if (mode === 'tempo') return 'Comfortably hard — about ' + fmtTime(mile / 1609 * 1609 / 1609 * mile === 0 ? 0 : (mile + 50)) + '/mi feel, only a few words at a time.';
  if (mode === 'norwegian') return 'Hard (≈85–95% max HR). You should want it to end at 4:00.';
  return '';
}
function intervalTarget(state, repDist) {
  const mile = mileSeconds(state);
  if (/400/.test(repDist)) return fmtTime(mile / 4);
  if (/800/.test(repDist)) return fmtTime(mile / 2);
  return null;
}

// ---------- injury / niggle routing ----------
// Which body areas each movement loads. Specific overrides first, else by movement pattern.
const PATTERN_AREAS = { hinge: ['back'], 'power-hinge': ['back'], squat: ['knee'], lunge: ['knee'], vpush: ['shoulder'], hpush: ['shoulder', 'elbow'], vpull: ['shoulder', 'elbow'], hpull: ['shoulder'], strongman: ['back', 'shoulder'], carry: ['back'], power: ['knee'], arms: ['elbow'], aerobic: ['knee', 'ankle'], anaerobic: ['knee', 'ankle'], speed: ['knee', 'ankle'], core: [], mobility: [], grip: [], fullbody: [], test: [], other: [] };
const EXERCISE_AREAS = { deadlift: ['back'], trap_bar_deadlift: ['back'], romanian_deadlift: ['back'], db_rdl: ['back'], back_squat: ['knee', 'back'], front_squat: ['knee', 'back'], hip_thrust: ['back'], barbell_row: ['back', 'shoulder'], bench_press: ['shoulder', 'elbow'], db_bench_press: ['shoulder', 'elbow'], db_floor_press: ['shoulder', 'elbow'], box_jump: ['knee', 'ankle'], broad_jump: ['knee', 'ankle'], sprints: ['knee', 'ankle', 'hamstring'], run_walk: ['knee', 'ankle'], run_easy: ['knee', 'ankle'], run_tempo: ['knee', 'ankle'], run_intervals_400: ['knee', 'ankle'], run_intervals_800: ['knee', 'ankle'], strides: ['knee', 'ankle'], mile_time_trial: ['knee', 'ankle'], bike_z2: [], ruck: ['back'] };
export function areasFor(exId) { if (EXERCISE_AREAS[exId]) return EXERCISE_AREAS[exId]; return PATTERN_AREAS[getExercise(exId).pattern] || []; }
function intersects(arr, set) { return arr.some((a) => set.has(a)); }
const AREA_LABELS = { knee: 'knee', back: 'lower back', shoulder: 'shoulder', elbow: 'elbow', hip: 'hip', wrist: 'wrist', ankle: 'ankle', hamstring: 'hamstring' };
export function areaLabel(a) { return AREA_LABELS[a] || a; }
export function excludedAreas(state) { return new Set(((state.tweaks) || []).map((t) => t.area)); }

// ================= JUST LIFT — build a lift day on demand =================
// Free lifts run OUTSIDE the program's weekly wave (a program deload shouldn't shrink a day
// you chose to do), but every other loop still applies: readiness, ACWR, niggles, swaps,
// equipment routing, and the working maxes.
const FREE_WAVE = { label: 'Just Lift', rirDelta: 0, volMult: 1, intMult: 1 };

function lastTrainedTs(state, exId) {
  const h = (state.history && state.history[exId]) || [];
  let t = 0;
  for (const x of h) { const v = new Date(x.dateISO).getTime(); if (v > t) t = v; }
  return t;
}

// Gear the athlete doesn't have rules a lift out of the pool entirely.
function gearOk(state, exId, profile) {
  const NEEDS_BAR = new Set(['pull_up', 'chin_up', 'band_pull_up', 'negative_pull_up', 'dead_hang', 'hanging_leg_raise']);
  if (profile && profile.hasPullupBar === false && NEEDS_BAR.has(exId)) return false;
  return true;
}

// Days since the last logged session — a long layoff means the stored maxes are optimistic.
export function layoffScale(state) {
  const sessions = state.sessions || [];
  if (!sessions.length) return { days: null, mult: 1, note: '' };
  let last = 0;
  for (const s of sessions) { const t = new Date(s.dateISO).getTime(); if (t > last) last = t; }
  const days = Math.floor((Date.now() - last) / 86400000);
  if (days >= 28) return { days, mult: 0.85, note: `First one back after ${days} days — loads trimmed ~15%. Earn it back over two or three sessions.` };
  if (days >= 14) return { days, mult: 0.92, note: `${days} days since your last session — eased the loads a touch to knock the rust off.` };
  return { days, mult: 1, note: '' };
}

// Where the plan sits vs where the calendar sits. The program advances by completed sessions, so
// missing days never loses a workout — but it does push everything later, and the Games date doesn't
// move. This is the honest reconciliation of the two.
export function scheduleStatus(state) {
  const start = state.program && state.program.startDateISO;
  if (!start) return null;
  const programWeek = (state.program && state.program.absWeek) || 0;
  const calendarWeek = Math.floor((Date.now() - new Date(start).getTime()) / (7 * 86400000));
  const since = Date.now() - 28 * 86400000;
  const recent = (state.sessions || []).filter((s) => new Date(s.dateISO).getTime() >= since);
  return {
    programWeek, calendarWeek,
    weeksBehind: Math.max(0, calendarWeek - programWeek),
    sessionsLast28: recent.length,
    perWeek: Math.round((recent.length / 4) * 10) / 10,
    weeksToQualifier: MACRO.qualifierWeek - calendarWeek,
    weeksToFinals: MACRO.finalsWeek - calendarWeek,
  };
}

export function freeLiftCount(state, focusId) {
  return (state.sessions || []).filter((s) => s.free && (!focusId || s.free === focusId)).length;
}

// Scheme for one slot: the flavor sets the numbers, the exercise's own unit sets the type.
function schemeFor(exId, role, flavor) {
  const ex = getExercise(exId);
  const r = flavor.roles[role] || flavor.roles.accessory;
  if (ex.unit === 'time') return { t: 'hold', sets: 3, seconds: flavor.holdSecs, rest: 45 };
  if (ex.unit === 'dist') return { t: 'carry', sets: 3, dist: 40, rest: r.rest, loadPct: 0.6 };
  if (ex.unit === 'bw') return { t: 'bwreps', sets: r.sets, reps: 'sub', pctMax: flavor.bwPct, rest: r.rest };
  return { t: 'strength', sets: r.sets, reps: r.reps, rir: r.rir, rest: r.rest, prog: 'load' };
}

// Build a complete lift day. `variant` is the re-roll counter — same inputs, same session,
// so what you previewed is exactly what you start.
export function buildLiftDay(state, focusId, variant = 0) {
  const focus = liftFocus(focusId);
  const profile = state.profile || {};
  const excluded = excludedAreas(state);
  const flavor = LIFT_FLAVORS[freeLiftCount(state, focus.id) % LIFT_FLAVORS.length];
  const used = new Set();
  const slots = [];
  for (const r of focus.roles) {
    let pool = r.pool.filter((id) => EXERCISES[id] && !used.has(id) && gearOk(state, id, profile));
    // prefer lifts that don't load a flagged niggle, but never leave the role empty
    const clean = pool.filter((id) => !intersects(areasFor(id), excluded));
    if (clean.length) pool = clean;
    if (!pool.length) continue;
    // least-recently-trained first — variety with no decision to make
    const ranked = pool.slice().sort((a, b) => lastTrainedTs(state, a) - lastTrainedTs(state, b) || a.localeCompare(b));
    const exId = ranked[variant % ranked.length];
    used.add(exId);
    slots.push({ id: r.id, ex: exId, scheme: schemeFor(exId, r.role, flavor) });
  }
  const layoff = layoffScale(state);
  return { focus, flavor, layoff, day: { name: `${focus.name} · ${flavor.label}`, tag: 'strength', free: focus.id, slots } };
}

// ================= resolve a session into concrete prescriptions =================
export function resolveSessionAt(state, absWeek, sessionInWeek, opts = {}) {
  const profile = state.profile;
  const units = (state.settings && state.settings.units) || 'lb';
  const { ctx, day, dayKey } = opts.customDay
    ? { ctx: planContext(absWeek), day: opts.customDay, dayKey: 'free:' + (opts.customDay.free || 'lift') }
    : opts.optionalDayKey
      ? { ctx: planContext(absWeek), day: COMMON_DAYS[opts.optionalDayKey], dayKey: opts.optionalDayKey }
      : getSession(absWeek, sessionInWeek);
  const free = !!opts.customDay;
  // Time off applies to BOTH modes: the stored maxes describe the athlete you were.
  const layoff = layoffScale(state);
  const wave = free ? { ...FREE_WAVE, intMult: layoff.mult }
    : { ...ctx.wave, intMult: ctx.wave.intMult * layoff.mult };
  const rs = combinedReadiness(state); // subjective check + today's HRV/sleep if present
  const acwr = computeACWR(state);
  const damp = acwrDamp(acwr);

  const slots = [];
  // prepend a warm-up on every primary/test session (not on pure optional aerobic)
  if (!opts.optionalDayKey) slots.push(COMMON_DAYS.warmup.slots[0]);
  for (const s of (day.slots || [])) slots.push(s);

  const excluded = excludedAreas(state);
  const blocks = slots.map((slot) => resolveSlot(slot, { state, profile, units, wave, rs, damp, ctx, excluded }));

  return {
    absWeek, sessionInWeek, dayKey,
    dayName: day.name, dayTag: day.tag, optional: free || !!day.optional,
    isTest: ctx.isTestWeek && !opts.optionalDayKey && !free,
    free: free ? day.free : null, layoffNote: layoff.note,
    ctx, readiness: rs, acwr, blocks,
    layoutNote: free ? '' : ctx.phase.layoutNote,
  };
}

// Re-resolve a single slot of the ACTIVE session (used by the in-workout "⇄ Swap").
// forcedExId forces that exercise (skips pref/equipment routing); null re-routes normally.
export function represcribeSlot(state, active, slotId, forcedExId) {
  const profile = state.profile;
  const units = (state.settings && state.settings.units) || 'lb';
  const ctx = planContext(active.absWeek);
  // a free lift carries its own slots on the active session (it isn't in the 52-week plan)
  const day = active.freeSlots ? { slots: active.freeSlots }
    : active.optionalDayKey ? COMMON_DAYS[active.optionalDayKey]
      : getSession(active.absWeek, active.sessionInWeek).day;
  let slot = (day.slots || []).find((sl) => sl.id === slotId);
  if (!slot && slotId === 'wu') slot = COMMON_DAYS.warmup.slots[0];
  if (!slot) return null;
  const rs = combinedReadiness(state);
  const acwr = computeACWR(state);
  const excluded = excludedAreas(state);
  const lay = layoffScale(state).mult;
  const wave = active.freeSlots ? { ...FREE_WAVE, intMult: lay } : { ...ctx.wave, intMult: ctx.wave.intMult * lay };
  return resolveSlot(slot, { state, profile, units, wave, rs, damp: acwrDamp(acwr), ctx, excluded, forcedEx: forcedExId || null });
}

function setsCount(base, volMult) { return Math.max(1, Math.min(base + 1, Math.round(base * volMult))); }

function resolveSlot(slot, c) {
  const baseEx = slot.ex;
  // a forced exercise (an explicit in-workout swap) skips pref/equipment routing; otherwise route.
  let exId, proxied = false;
  if (c.forcedEx) exId = c.forcedEx;
  else { const r = routeExercise(c.state, baseEx); exId = r.id; proxied = r.proxied; }
  let ex = getExercise(exId);
  const proxyNote = proxied ? `No loaded sandbag yet — doing this as ${ex.name}.` : '';
  // route around flagged niggles: substitute to a safe alternative, else lighten + caution
  let routeMult = 1, cautionNote = '';
  if (c.excluded && c.excluded.size && intersects(areasFor(exId), c.excluded)) {
    const hit = areasFor(exId).find((a) => c.excluded.has(a));
    const safe = (ex.sub || []).find((sid) => !intersects(areasFor(sid), c.excluded));
    if (safe) { exId = safe; ex = getExercise(safe); cautionNote = `Swapped to protect your ${areaLabel(hit)}.`; }
    else { routeMult = 0.8; cautionNote = `⚠ ${areaLabel(hit)} flagged — pain-free range only, lighter is fine, stop if it hurts.`; }
  }
  const sc = slot.scheme;
  const volMult = c.wave.volMult * c.rs.volMult * c.damp;
  const intMult = c.wave.intMult * c.rs.loadMult * routeMult;
  // when proxied, drop the sandbag-specific coaching note (it no longer applies) — keep the proxy note.
  const leadNote = [cautionNote, proxyNote].filter(Boolean).join(' ');
  const bodyNote = proxied ? '' : (sc.note || slot.note || '');
  const base = {
    id: slot.id, exerciseId: exId, baseExId: baseEx, name: ex.name, unit: ex.unit, loadType: ex.load,
    pattern: ex.pattern, cues: ex.cues || [], demo: ex.demo, sub: ex.sub || [],
    note: [leadNote, bodyNote].filter(Boolean).join(' '),
    rest: sc.rest || (c.state.settings && c.state.settings.restDefault) || 120,
    type: sc.t, caution: !!cautionNote,
  };

  switch (sc.t) {
    case 'strength': {
      const effRir = Math.max(0, Math.min(6, sc.rir + c.wave.rirDelta));
      const e1rm = currentE1RM(c.state, exId, c.profile);
      const w = ex.load === 'bodyweight' ? null : roundLoad(loadForReps(e1rm, sc.reps, effRir) * intMult, ex.load, c.units);
      const n = setsCount(sc.sets, volMult);
      const sets = Array.from({ length: n }, (_, i) => ({ idx: i, weight: w, reps: sc.reps, targetRir: effRir, kind: 'work' }));
      return { ...base, kind: 'sets', targetRir: effRir,
        prescription: `${n} × ${sc.reps}` + (w ? ` @ ${w}${c.units}` : '') + `  ·  leave ${effRir >= 5 ? '4+ (easy)' : effRir} in reserve`, sets };
    }
    case 'topset': {
      const effRir = Math.max(0, Math.min(6, sc.rir + c.wave.rirDelta));
      const e1rm = currentE1RM(c.state, exId, c.profile);
      const top = roundLoad(loadForReps(e1rm, sc.reps, effRir) * intMult, ex.load, c.units);
      const boW = roundLoad(top * (sc.backoff || 0.9), ex.load, c.units);
      const n = setsCount(sc.sets, volMult);
      const sets = [{ idx: 0, weight: top, reps: sc.reps, targetRir: effRir, kind: 'top' }];
      for (let i = 1; i < n; i++) sets.push({ idx: i, weight: boW, reps: sc.reps + 1, targetRir: effRir + 1, kind: 'backoff' });
      return { ...base, kind: 'sets', targetRir: effRir,
        prescription: `Top set ${sc.reps} @ ${top}${c.units} (leave ${effRir >= 5 ? '4+' : effRir}), then ${n - 1} × ${sc.reps + 1} @ ${boW}${c.units}`, sets };
    }
    case 'power': {
      const e1rm = currentE1RM(c.state, exId, c.profile);
      const pct = sc.pct || 0.6;
      const w = ex.load === 'bodyweight' ? null : roundLoad(e1rm * pct * intMult, ex.load, c.units);
      const n = setsCount(sc.sets, volMult);
      const sets = Array.from({ length: n }, (_, i) => ({ idx: i, weight: w, reps: sc.reps, kind: 'power' }));
      return { ...base, kind: 'sets',
        prescription: `${n} × ${sc.reps}` + (w ? ` @ ${w}${c.units}` : '') + '  ·  move every rep FAST', sets };
    }
    case 'bwreps': {
      const max = currentMaxReps(c.state, exId);
      let target;
      if (sc.reps === 'max') target = null;
      else if (sc.reps === 'sub') target = Math.max(3, Math.round((sc.pctMax || 0.7) * max));
      else if (sc.reps === 'half') target = Math.max(3, Math.round(max / 2));
      else target = sc.reps;
      const n = setsCount(sc.sets, volMult);
      const sets = Array.from({ length: n }, (_, i) => ({ idx: i, reps: target, weight: 0, kind: target == null ? 'amrap' : 'work' }));
      return { ...base, kind: 'reps',
        prescription: `${n} × ${target == null ? 'MAX reps' : target}` + (target == null ? '' : `  (your best is ${max})`), sets };
    }
    case 'amrap': {
      return { ...base, kind: 'reps', isTest: true,
        prescription: 'One all-out set — MAX reps', sets: [{ idx: 0, reps: null, weight: 0, kind: 'amrap' }] };
    }
    case 'emom': {
      const max = currentMaxReps(c.state, exId);
      const per = sc.reps === 'half' ? Math.max(2, Math.round(max / 2)) : (sc.reps === 'sub' ? Math.max(2, Math.round(0.4 * max)) : sc.reps);
      return { ...base, kind: 'emom',
        prescription: `EMOM ${sc.minutes} min — ${per} reps every minute`, minutes: sc.minutes, perMinute: per,
        sets: [{ idx: 0, reps: per * sc.minutes, weight: 0, kind: 'emom' }] };
    }
    case 'hold': {
      const secs = Math.round(sc.seconds * (c.wave.deload ? 0.85 : 1));
      const n = setsCount(sc.sets, volMult);
      const sets = Array.from({ length: n }, (_, i) => ({ idx: i, seconds: secs, kind: 'hold' }));
      return { ...base, kind: 'hold', prescription: `${n} × ${secs}s hold`, sets };
    }
    case 'carry': {
      const load = carryLoad(c.state, exId, sc.loadPct || 0.6, c.profile, c.units);
      const n = setsCount(sc.sets, volMult);
      const sets = Array.from({ length: n }, (_, i) => ({ idx: i, weight: load, dist: sc.dist, kind: 'carry' }));
      return { ...base, kind: 'carry', prescription: `${n} × ${sc.dist}yd @ ${load}${c.units}`, sets };
    }
    case 'run': {
      return resolveRun(base, sc, c, ex);
    }
    case 'metcon': {
      const items = (sc.items || []).map((it) => ({ name: getExercise(effectiveExId(c.state, it.ex)).name, reps: it.reps }));
      const roundsLabel = sc.rounds === 'amrap' ? `AMRAP ${Math.round((sc.timeCap || 1200) / 60)} min` : `${sc.rounds} rounds`;
      return { ...base, kind: 'metcon', rounds: sc.rounds, items, timeCap: sc.timeCap,
        prescription: roundsLabel + ' · ' + items.map((i) => `${i.reps} ${i.name}`).join(' / '),
        sets: [{ idx: 0, kind: 'metcon', result: null }] };
    }
    case 'mobility': {
      return { ...base, kind: 'mobility', prescription: `${sc.minutes} min`, minutes: sc.minutes,
        sets: [{ idx: 0, kind: 'mobility' }] };
    }
    case 'test_e1rm': {
      return { ...base, kind: 'sets', isTest: true, targetRir: 1,
        prescription: `Work up to a heavy ${sc.topReps} (leave ~1 in the tank)`,
        sets: [{ idx: 0, reps: sc.topReps, weight: currentE1RM(c.state, exId, c.profile) ? roundLoad(loadForReps(currentE1RM(c.state, exId, c.profile), sc.topReps, 1), ex.load, c.units) : null, targetRir: 1, kind: 'test' }] };
    }
    default:
      return { ...base, kind: 'note', prescription: base.note || 'See notes', sets: [] };
  }
}

function carryLoad(state, exId, loadPct, profile, units) {
  const ex = getExercise(exId);
  if (ex.load === 'sandbag') {
    const baseW = (state.maxes && state.maxes.sandbag && state.maxes.sandbag.weight) || (profile && profile.sandbagMax) || Math.round(0.5 * bw(profile));
    return roundLoad(baseW * loadPct, 'sandbag', units);
  }
  return roundLoad(currentE1RM(state, exId, profile) * loadPct, 'dumbbell', units);
}

function resolveRun(base, sc, c, ex) {
  const mode = sc.mode;
  let prescription = '', detail = sc.note || '';
  const mins = sc.minutes ? Math.max(8, Math.round(sc.minutes * (c.wave.volMult >= 1 ? 1 : c.wave.volMult))) : null;
  if (mode === 'walkrun') prescription = `${mins} min run/walk`;
  else if (mode === 'easy') prescription = `${mins} min easy (Zone 2)`;
  else if (mode === 'tempo') prescription = `${mins} min tempo`;
  else if (mode === 'intervals') { const tgt = intervalTarget(c.state, sc.repDist); prescription = `${sc.reps} × ${sc.repDist}` + (tgt ? ` @ ~${tgt}` : '') + ` · ${sc.recovery} rec`; }
  else if (mode === 'norwegian') prescription = `${sc.reps} × ${sc.repDist} hard · ${sc.recovery}`;
  else if (mode === 'strides') prescription = `${sc.reps} × ~20s strides · full walk-back`;
  else if (mode === 'sprints') prescription = `${sc.reps} × ${sc.repDist} sprint · ${sc.recovery} rec`;
  else if (mode === 'tt') prescription = `1-Mile Time Trial — all out`;
  // readiness downgrade: ease hard sessions to steady
  if (c.rs.downgrade && (mode === 'intervals' || mode === 'norwegian' || mode === 'tempo' || mode === 'sprints')) {
    detail = 'Eased to a steady easy effort today (you logged low readiness). ' + detail;
    prescription = `${mins || 25} min easy (downgraded from ${mode})`;
  }
  return { ...base, kind: 'run', mode, prescription, paceHint: paceHint(c.state, mode), detail,
    sets: [{ idx: 0, kind: 'run', mode, result: null }] };
}

// ---------- set-to-set adjustment ----------
export function adjustAfterSet(set, actual, units = 'lb', loadType = 'barbell') {
  if (!set || set.weight == null || actual == null) return null;
  const targetRir = set.targetRir != null ? set.targetRir : 2;
  let rir = actual.rir;
  if (rir == null && actual.rpe != null) rir = Math.max(0, 10 - actual.rpe);
  if (rir == null) return null;
  // fewer reps left than planned => too heavy; clearly more left => too light
  if (rir <= targetRir - 2) {
    const next = roundLoad(set.weight * 0.93, loadType, units);
    return { nextWeight: next, message: `Tougher than planned — ${next}${units} next set.` };
  }
  if (rir >= targetRir + 2 && (actual.reps == null || actual.reps >= set.reps)) {
    const next = roundLoad(set.weight * 1.04, loadType, units);
    return { nextWeight: next, message: `Plenty left — bump to ${next}${units}.` };
  }
  return null;
}

// ---------- ingest a finished session → updated maxes (cycle loop) ----------
export function ingestModel(state, session) {
  const patch = {};
  const now = session.dateISO || new Date().toISOString();
  const bumpE1RM = (exId, e1rm) => {
    const cur = (state.maxes[exId] && state.maxes[exId].e1rm) || 0;
    const capped = cur ? Math.min(e1rm, cur * 1.15) : e1rm; // guard against a fluke spike
    if (capped > cur) patch[exId] = { ...(state.maxes[exId] || {}), e1rm: Math.round(capped), updated: now };
  };
  const bumpReps = (exId, reps) => {
    const cur = (state.maxes[exId] && state.maxes[exId].maxReps) || 0;
    if (reps > cur) patch[exId] = { ...(state.maxes[exId] || {}), maxReps: reps, updated: now };
  };
  for (const entry of (session.entries || [])) {
    const ex = getExercise(entry.exerciseId);
    for (const st of (entry.sets || [])) {
      if (!st.done) continue;
      const rir = st.rir != null ? st.rir : (st.rpe != null ? Math.max(0, 10 - st.rpe) : (st.targetRir != null ? st.targetRir : 1));
      if ((ex.unit === 'weight') && st.weight && st.reps) bumpE1RM(entry.exerciseId, e1rmFromSet(st.weight, st.reps, rir));
      if ((ex.unit === 'bw') && st.reps && (st.kind === 'amrap' || st.rpe == null || st.rpe >= 9)) bumpReps(entry.exerciseId, st.reps);
    }
    // 1-mile time trial result (seconds)
    if (entry.exerciseId === 'mile_time_trial' && entry.resultSeconds) {
      const cur = (state.maxes.mile && state.maxes.mile.seconds) || Infinity;
      if (entry.resultSeconds < cur) patch.mile = { seconds: entry.resultSeconds, updated: now };
    }
    // Cindy rounds
    if (entry.exerciseId === 'cindy' && entry.resultRounds != null) {
      const cur = (state.maxes.cindy && state.maxes.cindy.rounds) || 0;
      if (entry.resultRounds > cur) patch.cindy = { rounds: entry.resultRounds, updated: now };
    }
    // Sandbag heaviest shouldered
    if (entry.exerciseId === 'sandbag_shoulder' && entry.topWeight) {
      const cur = (state.maxes.sandbag && state.maxes.sandbag.weight) || 0;
      if (entry.topWeight > cur) patch.sandbag = { ...(state.maxes.sandbag || {}), weight: entry.topWeight, updated: now };
    }
  }
  return patch;
}

// ---------- progress data for charts ----------
function seriesByDay(history, pick) {
  const byDay = {};
  for (const h of (history || [])) {
    const d = (h.dateISO || '').slice(0, 10);
    const v = pick(h);
    if (v == null) continue;
    byDay[d] = byDay[d] == null ? v : Math.max(byDay[d], v);
  }
  return Object.keys(byDay).sort().map((d) => ({ x: d, y: byDay[d] }));
}
export function progressSeries(state) {
  const H = state.history || {};
  const rirOf = (h) => (h.rir != null ? h.rir : (h.rpe != null ? Math.max(0, 10 - h.rpe) : 1));
  const e1 = (id) => seriesByDay(H[id], (h) => h.e1rm || (h.weight && h.reps ? Math.round(e1rmFromSet(h.weight, h.reps, rirOf(h))) : null));
  return {
    deadlift: e1('deadlift'),
    back_squat: e1('back_squat'),
    overhead_press: e1('overhead_press'),
    bench_press: e1('bench_press'),
    pull_up: seriesByDay(H.pull_up, (h) => h.reps),
    push_up: seriesByDay(H.hand_release_push_up, (h) => h.reps).concat(seriesByDay(H.push_up, (h) => h.reps)).sort((a, b) => a.x < b.x ? -1 : 1),
    bodyweight: seriesByDay(state.body, (h) => h.weight),
    recovery: latestRecovery(state),
    loadHistory: weeklyLoadSeries(state),
  };
}
function weeklyLoadSeries(state) {
  const wk = {};
  for (const s of (state.sessions || [])) {
    const d = new Date(s.dateISO);
    const onejan = new Date(d.getFullYear(), 0, 1);
    const week = Math.ceil((((d - onejan) / 86400000) + onejan.getDay() + 1) / 7);
    const key = d.getFullYear() + '-W' + String(week).padStart(2, '0');
    wk[key] = (wk[key] || 0) + sessionLoad(s);
  }
  return Object.keys(wk).sort().map((k) => ({ x: k, y: Math.round(wk[k]) }));
}

// ---------- event-readiness scorecard ----------
export function eventReadiness(state) {
  const profile = state.profile || {};
  const b = bw(profile);
  const dl = currentE1RM(state, 'deadlift', profile);
  const pu = currentMaxReps(state, 'pull_up');
  const hrpu = (state.maxes.hand_release_push_up && state.maxes.hand_release_push_up.maxReps) || currentMaxReps(state, 'push_up');
  const cindy = (state.maxes.cindy && state.maxes.cindy.rounds) || 0;
  const mile = mileSeconds(state);
  const pct = (v) => Math.max(0, Math.min(100, Math.round(v)));
  return [
    { key: 'deadlift', label: 'Deadlift 1RM', current: `${dl} ${profile.units || 'lb'}`, target: `${Math.round(2 * b)} ${profile.units || 'lb'} (2× BW)`, pct: pct(dl / (2 * b) * 100) },
    { key: 'pull_up', label: 'Strict Pull-Ups', current: `${pu}`, target: '20', pct: pct(pu / 20 * 100) },
    { key: 'push_up', label: 'Hand-Release Push-Ups', current: `${hrpu}`, target: '50', pct: pct(hrpu / 50 * 100) },
    { key: 'cindy', label: '"Cindy" Rounds', current: cindy ? `${cindy}` : '—', target: '20', pct: pct(cindy / 20 * 100) },
    { key: 'mile', label: '1-Mile Time', current: fmtTime(mile), target: '6:00', pct: pct(360 / mile * 100) },
  ];
}

// ---------- plan overview (for Plan view) ----------
export function weekList(state) {
  const start = state.program && state.program.startDateISO;
  const out = [];
  for (let w = 0; w < MACRO.totalWeeks; w++) {
    const ctx = planContext(w);
    out.push({
      week: w, phase: ctx.phase.short, phaseName: ctx.phase.name, label: ctx.waveLabel,
      isDeload: ctx.isDeload, isTest: ctx.isTestWeek,
      isQualifier: w === MACRO.qualifierWeek, isFinals: w === MACRO.finalsWeek,
      date: start ? dateForWeek(start, w) : null,
      current: state.program && w === state.program.absWeek,
    });
  }
  return out;
}
