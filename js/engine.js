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

import { getExercise } from './exercises.js';
import { planContext, getSession, getDay, COMMON_DAYS, dateForWeek, MACRO } from './program.js';

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
  return (rec && rec.maxReps) ? rec.maxReps : (DEFAULT_REPS_MAX[exId] || 10);
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
  if (ratio != null) {
    if (ratio < 0.8) { status = 'detraining-risk'; color = '#60a5fa'; advice = 'Load is dipping below your baseline — you can push a little more.'; }
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

// ================= resolve a session into concrete prescriptions =================
export function resolveSessionAt(state, absWeek, sessionInWeek, opts = {}) {
  const profile = state.profile;
  const units = (state.settings && state.settings.units) || 'lb';
  const { ctx, day, dayKey } = opts.optionalDayKey
    ? { ctx: planContext(absWeek), day: COMMON_DAYS[opts.optionalDayKey], dayKey: opts.optionalDayKey }
    : getSession(absWeek, sessionInWeek);
  const wave = ctx.wave;
  const rs = combinedReadiness(state); // subjective check + today's HRV/sleep if present
  const acwr = computeACWR(state);
  const damp = acwrDamp(acwr);

  const slots = [];
  // prepend a warm-up on every primary/test session (not on pure optional aerobic)
  if (!opts.optionalDayKey) slots.push(COMMON_DAYS.warmup.slots[0]);
  for (const s of (day.slots || [])) slots.push(s);

  const blocks = slots.map((slot) => resolveSlot(slot, { state, profile, units, wave, rs, damp, ctx }));

  return {
    absWeek, sessionInWeek, dayKey,
    dayName: day.name, dayTag: day.tag, optional: !!day.optional,
    isTest: ctx.isTestWeek && !opts.optionalDayKey,
    ctx, readiness: rs, acwr, blocks,
    layoutNote: ctx.phase.layoutNote,
  };
}

function setsCount(base, volMult) { return Math.max(1, Math.min(base + 1, Math.round(base * volMult))); }

function resolveSlot(slot, c) {
  const ex = getExercise(slot.ex);
  const sc = slot.scheme;
  const volMult = c.wave.volMult * c.rs.volMult * c.damp;
  const intMult = c.wave.intMult * c.rs.loadMult;
  const base = {
    id: slot.id, exerciseId: slot.ex, name: ex.name, unit: ex.unit, loadType: ex.load,
    pattern: ex.pattern, cues: ex.cues || [], demo: ex.demo, sub: ex.sub || [],
    note: sc.note || slot.note || '', rest: sc.rest || (c.state.settings && c.state.settings.restDefault) || 120,
    type: sc.t,
  };

  switch (sc.t) {
    case 'strength': {
      const effRir = Math.max(0, Math.min(6, sc.rir + c.wave.rirDelta));
      const e1rm = currentE1RM(c.state, slot.ex, c.profile);
      const w = ex.load === 'bodyweight' ? null : roundLoad(loadForReps(e1rm, sc.reps, effRir) * intMult, ex.load, c.units);
      const n = setsCount(sc.sets, volMult);
      const sets = Array.from({ length: n }, (_, i) => ({ idx: i, weight: w, reps: sc.reps, targetRir: effRir, kind: 'work' }));
      return { ...base, kind: 'sets', targetRir: effRir,
        prescription: `${n} × ${sc.reps}` + (w ? ` @ ${w}${c.units}` : '') + `  ·  leave ${effRir >= 5 ? '4+ (easy)' : effRir} in reserve`, sets };
    }
    case 'topset': {
      const effRir = Math.max(0, Math.min(6, sc.rir + c.wave.rirDelta));
      const e1rm = currentE1RM(c.state, slot.ex, c.profile);
      const top = roundLoad(loadForReps(e1rm, sc.reps, effRir) * intMult, ex.load, c.units);
      const boW = roundLoad(top * (sc.backoff || 0.9), ex.load, c.units);
      const n = setsCount(sc.sets, volMult);
      const sets = [{ idx: 0, weight: top, reps: sc.reps, targetRir: effRir, kind: 'top' }];
      for (let i = 1; i < n; i++) sets.push({ idx: i, weight: boW, reps: sc.reps + 1, targetRir: effRir + 1, kind: 'backoff' });
      return { ...base, kind: 'sets', targetRir: effRir,
        prescription: `Top set ${sc.reps} @ ${top}${c.units} (leave ${effRir >= 5 ? '4+' : effRir}), then ${n - 1} × ${sc.reps + 1} @ ${boW}${c.units}`, sets };
    }
    case 'power': {
      const e1rm = currentE1RM(c.state, slot.ex, c.profile);
      const pct = sc.pct || 0.6;
      const w = ex.load === 'bodyweight' ? null : roundLoad(e1rm * pct * intMult, ex.load, c.units);
      const n = setsCount(sc.sets, volMult);
      const sets = Array.from({ length: n }, (_, i) => ({ idx: i, weight: w, reps: sc.reps, kind: 'power' }));
      return { ...base, kind: 'sets',
        prescription: `${n} × ${sc.reps}` + (w ? ` @ ${w}${c.units}` : '') + '  ·  move every rep FAST', sets };
    }
    case 'bwreps': {
      const max = currentMaxReps(c.state, slot.ex);
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
      const max = currentMaxReps(c.state, slot.ex);
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
      const load = carryLoad(c.state, slot.ex, sc.loadPct || 0.6, c.profile, c.units);
      const n = setsCount(sc.sets, volMult);
      const sets = Array.from({ length: n }, (_, i) => ({ idx: i, weight: load, dist: sc.dist, kind: 'carry' }));
      return { ...base, kind: 'carry', prescription: `${n} × ${sc.dist}yd @ ${load}${c.units}`, sets };
    }
    case 'run': {
      return resolveRun(base, sc, c, ex);
    }
    case 'metcon': {
      const items = (sc.items || []).map((it) => ({ name: getExercise(it.ex).name, reps: it.reps }));
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
        sets: [{ idx: 0, reps: sc.topReps, weight: currentE1RM(c.state, slot.ex, c.profile) ? roundLoad(loadForReps(currentE1RM(c.state, slot.ex, c.profile), sc.topReps, 1), ex.load, c.units) : null, targetRir: 1, kind: 'test' }] };
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
  const e1 = (id) => seriesByDay(H[id], (h) => h.e1rm || (h.weight && h.reps ? Math.round(e1rmFromSet(h.weight, h.reps, h.rpe != null ? 10 - h.rpe : 1)) : null));
  return {
    deadlift: e1('deadlift'),
    back_squat: e1('back_squat'),
    overhead_press: e1('overhead_press'),
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
