// program.js — the 52-week periodized macrocycle for the New Christendom Press Games.
//
// Built as DATA the engine resolves into concrete numbers. The plan specifies INTENT
// (sets/reps/RIR, run type, metcon); the engine fills the numbers from the athlete's
// measured maxes + autoregulation. Every choice traces to docs/PROGRAM-SCIENCE.md and was
// red-teamed by the research workflow (validation fixes baked in: re-anchored 52-wk calendar,
// dedicated aerobic block, sandbag power deferred to post-strength, an explicit qualifier->
// finals Bridge for the double-peak, power distributed not front-loaded).
//
// THE GOLDEN RULE OF SPACING (interference management): never run hard in the hours before a
// heavy deadlift/squat day. The recommended week separates them; honor block.layoutNote.
//
// Slot schemes (scheme.t):
//   strength  {sets,reps,rir,rest,prog:'load'}              load from e1RM @ reps/RIR
//   topset    {sets,reps,rir,rest,backoff}                  1 top set @ RIR, backoffs at backoff*top
//   bwreps    {sets,reps,rest,pctMax}                       bodyweight reps; ~pctMax of current max ('max'=AMRAP,'sub'/'half')
//   emom      {minutes,reps}                                grease-the-groove single move ('half'=half max)
//   carry     {sets,dist,rest,loadPct}                      loaded carry for distance (yd)
//   hold      {sets,seconds,rest}                           timed hold
//   power     {sets,reps,rest,pct}                          explosive intent, sub-maximal, move FAST
//   run       {mode,minutes,reps,repDist,recovery,note}     mode: walkrun|easy|tempo|intervals|norwegian|strides|sprints|tt
//   metcon    {rounds,items:[{ex,reps}],timeCap,note}       circuit / event simulation ('amrap' rounds)
//   mobility  {minutes}
//   test_e1rm {ex,topReps}                                  work up to a heavy set; engine records new e1RM

export const MACRO = {
  totalWeeks: 52,
  qualifierWeek: 46, // 0-based: final week of the Qualifier Peak block (~mid-May 2027)
  finalsWeek: 51,    // 0-based: final week of the Bridge/Finals block (~mid-June 2027)
};

const WAVE_4 = [
  { label: 'Intro',    rirDelta: +1, volMult: 0.90, intMult: 0.96 },
  { label: 'Build',    rirDelta:  0, volMult: 1.00, intMult: 1.00 },
  { label: 'Overload', rirDelta: -1, volMult: 1.10, intMult: 1.04 },
  { label: 'Deload',   rirDelta: +2, volMult: 0.50, intMult: 0.85, deload: true },
];
const WAVE_5 = [
  { label: 'Intro',    rirDelta: +1, volMult: 0.90, intMult: 0.97 },
  { label: 'Build',    rirDelta:  0, volMult: 1.00, intMult: 1.00 },
  { label: 'Overload', rirDelta: -1, volMult: 1.08, intMult: 1.04 },
  { label: 'Peak',     rirDelta: -1, volMult: 0.95, intMult: 1.08 },
  { label: 'Deload',   rirDelta: +2, volMult: 0.50, intMult: 0.85, deload: true },
];

// ---- session days shared across phases (optional + test + warmup) ----
export const COMMON_DAYS = {
  warmup: { name: 'Warm-Up', tag: 'prep', slots: [
    { id: 'wu', ex: 'warmup_flow', scheme: { t: 'mobility', minutes: 6 } },
  ] },
  opt_aerobic: { name: 'Easy Aerobic (Zone 2)', tag: 'optional', optional: true, slots: [
    { id: 'z2', ex: 'run_easy', scheme: { t: 'run', mode: 'easy', minutes: 30, note: 'Conversational pace — builds the aerobic base that powers everything. Use the bike or a ruck if your legs are beat up (spares the joints, same engine benefit).' } },
  ] },
  opt_skill: { name: 'Skill: Pull-Up/Push-Up GTG + Mobility', tag: 'optional', optional: true, slots: [
    { id: 'gtg_pull', ex: 'pull_up', scheme: { t: 'emom', minutes: 10, reps: 'half', note: 'Grease-the-groove: ~half your max each minute, never to failure. The fastest way to add pull-ups.' } },
    { id: 'gtg_push', ex: 'push_up', scheme: { t: 'emom', minutes: 8, reps: 'half' } },
    { id: 'mob', ex: 'mobility_flow', scheme: { t: 'mobility', minutes: 10 } },
  ] },
  // Benchmark days — used on the final week of build phases.
  t_strength: { name: 'TEST — Strength', tag: 'test', slots: [
    { id: 't_dl', ex: 'deadlift', scheme: { t: 'test_e1rm', topReps: 3, note: 'Work up to a heavy, clean triple. The app converts it to your estimated 1RM.' } },
    { id: 't_sq', ex: 'back_squat', scheme: { t: 'test_e1rm', topReps: 3 } },
  ] },
  t_body: { name: 'TEST — Bodyweight', tag: 'test', slots: [
    { id: 't_pull', ex: 'pull_up', scheme: { t: 'amrap', note: 'Max strict reps, one all-out set.' } },
    { id: 't_push', ex: 'hand_release_push_up', scheme: { t: 'amrap', note: 'Max unbroken hand-release push-ups (the event standard).' } },
  ] },
  t_engine: { name: 'TEST — "Cindy" Benchmark', tag: 'test', slots: [
    { id: 't_cindy', ex: 'cindy', scheme: { t: 'metcon', rounds: 'amrap', timeCap: 1200, items: [{ ex: 'pull_up', reps: 5 }, { ex: 'push_up', reps: 10 }, { ex: 'air_squat', reps: 15 }], note: 'Log total rounds + reps. This IS the qualifier engine test.' } },
  ] },
  t_run: { name: 'TEST — 1-Mile Time Trial', tag: 'test', slots: [
    { id: 't_mile', ex: 'mile_time_trial', scheme: { t: 'run', mode: 'tt', note: 'Warm up well. Even pace, negative split, empty the tank the last 200m.' } },
  ] },
};

const FULL_TEST = ['t_strength', 't_run', 't_body', 't_engine'];

// ============================ THE PHASES (52 weeks) ============================
export const PHASES = [

  // -------- 1. FOUNDATION & RE-ENTRY (idx 0–7) --------
  { id: 'foundation', name: 'Foundation & Re-Entry', short: 'Foundation', weeks: 8, mesoWeeks: 4, wave: WAVE_4,
    emphasis: { strength: 2, power: 0, muscle: 2, aerobic: 3, anaerobic: 1 },
    focus: 'Re-teach the lifts light, build tendons & bones (they adapt slower than muscle), and lay an aerobic base with run/walk. The win condition for these 8 weeks is arriving healthy with a base — not soreness. Deload every 4 weeks because recovery capacity is low early.',
    layoutNote: 'Suggested: Mon Lower · Tue Upper · Thu Run · Sat Mixed. Keep a rest day between the lower lift and any hard running.',
    schedule: ['d1', 'd2', 'd3', 'd4'], testSchedule: FULL_TEST,
    days: {
      d1: { name: 'Lower Strength', tag: 'strength', slots: [
        { id: 'sq', ex: 'back_squat', scheme: { t: 'strength', sets: 3, reps: 6, rir: 4, rest: 150, prog: 'load' } },
        { id: 'rdl', ex: 'romanian_deadlift', scheme: { t: 'strength', sets: 3, reps: 8, rir: 4, rest: 120, prog: 'load' } },
        { id: 'lunge', ex: 'db_reverse_lunge', scheme: { t: 'strength', sets: 2, reps: 10, rir: 3, rest: 90, prog: 'load' } },
        { id: 'plank', ex: 'plank', scheme: { t: 'hold', sets: 3, seconds: 30, rest: 45 } },
      ] },
      d2: { name: 'Upper Strength', tag: 'strength', slots: [
        { id: 'ohp', ex: 'overhead_press', scheme: { t: 'strength', sets: 3, reps: 6, rir: 4, rest: 150, prog: 'load' } },
        { id: 'pull', ex: 'lat_pulldown', scheme: { t: 'strength', sets: 3, reps: 10, rir: 3, rest: 90, prog: 'load' } },
        { id: 'press', ex: 'db_floor_press', scheme: { t: 'strength', sets: 3, reps: 10, rir: 3, rest: 90, prog: 'load' } },
        { id: 'row', ex: 'cable_row', scheme: { t: 'strength', sets: 3, reps: 12, rir: 3, rest: 75, prog: 'load' } },
        { id: 'hang', ex: 'dead_hang', scheme: { t: 'hold', sets: 3, seconds: 20, rest: 60 } },
      ] },
      d3: { name: 'Aerobic Base (Run/Walk)', tag: 'conditioning', slots: [
        { id: 'run', ex: 'run_walk', scheme: { t: 'run', mode: 'walkrun', minutes: 24, note: 'Run 60s / walk 90s, repeat ~9–10 times. Easy enough to talk. This gentle ramp protects shins & tendons — the #1 injury risk for a returning lifter who runs.' } },
        { id: 'core', ex: 'hanging_leg_raise', scheme: { t: 'bwreps', sets: 3, reps: 8, rest: 60, pctMax: 0.7 } },
        { id: 'mob', ex: 'mobility_flow', scheme: { t: 'mobility', minutes: 6 } },
      ] },
      d4: { name: 'Power Intro + Carries', tag: 'mixed', slots: [
        { id: 'swing', ex: 'kb_swing', scheme: { t: 'power', sets: 4, reps: 12, rest: 75 } },
        { id: 'neg', ex: 'negative_pull_up', scheme: { t: 'hold', sets: 4, seconds: 4, rest: 75, note: 'Reps of slow 4–5s lowers — this builds your first strict pull-ups.' } },
        { id: 'pushup', ex: 'push_up', scheme: { t: 'bwreps', sets: 3, reps: 'sub', rest: 75, pctMax: 0.6 } },
        { id: 'carry', ex: 'sandbag_carry', scheme: { t: 'carry', sets: 3, dist: 40, rest: 90, loadPct: 0.5 } },
      ] },
    } },

  // -------- 2. HYPERTROPHY & WORK CAPACITY (idx 8–15) --------
  { id: 'hypertrophy', name: 'Hypertrophy & Work Capacity', short: 'Hypertrophy', weeks: 8, mesoWeeks: 4, wave: WAVE_4,
    emphasis: { strength: 2, power: 1, muscle: 3, aerobic: 2, anaerobic: 2 },
    focus: 'Build the muscle and rep-capacity everything stands on — more pull-ups & push-ups, thicker engine. Sandbag work here is CARRIES + GRIP only (explosive shouldering waits until you have a strength base). Easy aerobic maintained; strides added for running economy.',
    layoutNote: 'Suggested: Mon Lower · Tue Upper · Thu Run+strides · Sat Sandbag/Metcon.',
    schedule: ['d1', 'd2', 'd3', 'd4'], testSchedule: FULL_TEST,
    days: {
      d1: { name: 'Lower Hypertrophy', tag: 'strength', slots: [
        { id: 'sq', ex: 'back_squat', scheme: { t: 'strength', sets: 4, reps: 8, rir: 2, rest: 150, prog: 'load' } },
        { id: 'dl', ex: 'romanian_deadlift', scheme: { t: 'strength', sets: 3, reps: 10, rir: 2, rest: 120, prog: 'load' } },
        { id: 'split', ex: 'bulgarian_split_squat', scheme: { t: 'strength', sets: 3, reps: 10, rir: 2, rest: 90, prog: 'load' } },
        { id: 'core', ex: 'hanging_leg_raise', scheme: { t: 'bwreps', sets: 3, reps: 10, rest: 60, pctMax: 0.8 } },
      ] },
      d2: { name: 'Upper Hypertrophy + Pulling', tag: 'strength', slots: [
        { id: 'press', ex: 'db_bench_press', scheme: { t: 'strength', sets: 4, reps: 10, rir: 2, rest: 120, prog: 'load' } },
        { id: 'pull', ex: 'pull_up', scheme: { t: 'bwreps', sets: 4, reps: 'sub', rest: 120, pctMax: 0.75, note: 'Band or negatives if needed to hit the reps.' } },
        { id: 'ohp', ex: 'db_shoulder_press', scheme: { t: 'strength', sets: 3, reps: 10, rir: 2, rest: 90, prog: 'load' } },
        { id: 'row', ex: 'db_row', scheme: { t: 'strength', sets: 3, reps: 12, rir: 2, rest: 75, prog: 'load' } },
        { id: 'curl', ex: 'ez_curl', scheme: { t: 'strength', sets: 2, reps: 12, rir: 1, rest: 60, prog: 'load' } },
      ] },
      d3: { name: 'Run + Strides', tag: 'conditioning', slots: [
        { id: 'easy', ex: 'run_easy', scheme: { t: 'run', mode: 'easy', minutes: 28, note: 'Steady Zone 2 — still conversational.' } },
        { id: 'strides', ex: 'strides', scheme: { t: 'run', mode: 'strides', reps: 6, note: '6 × ~20s smooth accelerations after the run. Builds turnover, costs almost no fatigue.' } },
      ] },
      d4: { name: 'Carries, Grip + Metcon', tag: 'mixed', slots: [
        { id: 'carry', ex: 'sandbag_carry', scheme: { t: 'carry', sets: 4, dist: 50, rest: 75, loadPct: 0.6, note: 'Bear-hug carries build the grip + trunk that both the deadlift and sandbag need.' } },
        { id: 'metcon', ex: 'field_metcon', scheme: { t: 'metcon', rounds: 4, timeCap: 900, items: [{ ex: 'hand_release_push_up', reps: 10 }, { ex: 'walking_lunge', reps: 20 }, { ex: 'air_squat', reps: 20 }], note: 'Event-pattern conditioning. Steady & unbroken, then push the last round.' } },
        { id: 'grip', ex: 'dead_hang', scheme: { t: 'hold', sets: 3, seconds: 35, rest: 60 } },
      ] },
    } },

  // -------- 3. AEROBIC ENGINE & DURABILITY (idx 16–21) --------
  { id: 'aerobic', name: 'Aerobic Engine & Durability', short: 'Aerobic', weeks: 6, mesoWeeks: 6,
    wave: [
      { label: 'Base', rirDelta: +1, volMult: 0.90, intMult: 0.97 },
      { label: 'Base+', rirDelta: +1, volMult: 1.00, intMult: 0.98 },
      { label: 'Build', rirDelta: 0, volMult: 1.10, intMult: 1.0 },
      { label: 'Build+', rirDelta: 0, volMult: 1.18, intMult: 1.0 },
      { label: 'Peak Volume', rirDelta: 0, volMult: 1.22, intMult: 1.0 },
      { label: 'Down Week', rirDelta: +2, volMult: 0.55, intMult: 0.9, deload: true },
    ],
    emphasis: { strength: 1, power: 1, muscle: 1, aerobic: 3, anaerobic: 2 },
    focus: 'A dedicated polarized (~80/20) block to build the aerobic engine that the mile and every metcon run on — a non-runner needs base BEFORE intervals. Strength drops to 2 maintenance sessions (heavy, low-volume) so it holds without blunting the aerobic adaptation. Sandbag SHOULDER technique is introduced now that you have a base — light and crisp.',
    layoutNote: 'Suggested: Mon Lower(maint)+sandbag tech · Tue Easy run · Thu Upper(maint) · Sat Long easy + 1 tempo. Easy means EASY — that is the point.',
    schedule: ['d1', 'd2', 'd3', 'd4'], testSchedule: FULL_TEST,
    days: {
      d1: { name: 'Lower (maintain) + Sandbag Tech', tag: 'strength', slots: [
        { id: 'sq', ex: 'back_squat', scheme: { t: 'strength', sets: 3, reps: 5, rir: 2, rest: 180, prog: 'load', note: 'Just enough heavy work to keep your strength while the engine grows.' } },
        { id: 'sb', ex: 'sandbag_shoulder', scheme: { t: 'strength', sets: 4, reps: 4, rir: 3, rest: 90, prog: 'load', note: 'Learn the lift: hug high & tight, hips explode, alternate shoulders. Crisp reps, never grinding.' } },
        { id: 'core', ex: 'plank', scheme: { t: 'hold', sets: 3, seconds: 40, rest: 45 } },
      ] },
      d2: { name: 'Easy Aerobic Volume', tag: 'conditioning', slots: [
        { id: 'easy', ex: 'run_easy', scheme: { t: 'run', mode: 'easy', minutes: 35, note: 'The bread and butter. Easy, nasal-breathing pace. Bike/ruck a portion if the legs need a break.' } },
        { id: 'strides', ex: 'strides', scheme: { t: 'run', mode: 'strides', reps: 6 } },
      ] },
      d3: { name: 'Upper (maintain)', tag: 'strength', slots: [
        { id: 'press', ex: 'overhead_press', scheme: { t: 'strength', sets: 3, reps: 5, rir: 2, rest: 150, prog: 'load' } },
        { id: 'pull', ex: 'pull_up', scheme: { t: 'bwreps', sets: 4, reps: 'sub', rest: 120, pctMax: 0.8 } },
        { id: 'row', ex: 'db_row', scheme: { t: 'strength', sets: 3, reps: 10, rir: 2, rest: 75, prog: 'load' } },
      ] },
      d4: { name: 'Long Easy + Tempo Finish', tag: 'conditioning', slots: [
        { id: 'easy', ex: 'run_easy', scheme: { t: 'run', mode: 'easy', minutes: 30, note: 'Easy first.' } },
        { id: 'tempo', ex: 'run_tempo', scheme: { t: 'run', mode: 'tempo', minutes: 10, note: 'Then 10 min comfortably-hard to start touching threshold. This is the "20" in 80/20.' } },
      ] },
    } },

  // -------- 4. MAXIMAL STRENGTH (idx 22–31) --------
  { id: 'strength', name: 'Maximal Strength', short: 'Max Strength', weeks: 10, mesoWeeks: 5, wave: WAVE_5,
    emphasis: { strength: 3, power: 2, muscle: 2, aerobic: 2, anaerobic: 2 },
    focus: 'Turn muscle into raw force — the deadlift 1RM and heavy sandbag live here. Daily-undulating: heavy days and rep days alternate. Endurance & muscular-endurance shift to MAINTENANCE (kept sharp, low volume) so strength climbs without interference. Power kept alive with a weekly jump/speed touch.',
    layoutNote: 'Suggested: Mon Deadlift · Tue Upper · Thu Run quality (legs recovered) · Sat Heavy sandbag+power. Never run hard the day before deadlift day.',
    schedule: ['d1', 'd2', 'd3', 'd4'], testSchedule: FULL_TEST,
    days: {
      d1: { name: 'Deadlift Strength', tag: 'strength', slots: [
        { id: 'dl', ex: 'deadlift', scheme: { t: 'topset', sets: 4, reps: 4, rir: 2, rest: 210, backoff: 0.9, prog: 'load' } },
        { id: 'sq', ex: 'front_squat', scheme: { t: 'strength', sets: 3, reps: 5, rir: 2, rest: 150, prog: 'load' } },
        { id: 'hinge', ex: 'hip_thrust', scheme: { t: 'strength', sets: 3, reps: 8, rir: 2, rest: 90, prog: 'load' } },
        { id: 'jump', ex: 'box_jump', scheme: { t: 'power', sets: 3, reps: 3, rest: 90, note: 'Weekly power touch — explosive, fully recovered, low fatigue.' } },
      ] },
      d2: { name: 'Upper Strength + Pull-Up Strength', tag: 'strength', slots: [
        { id: 'ohp', ex: 'overhead_press', scheme: { t: 'topset', sets: 4, reps: 4, rir: 2, rest: 180, backoff: 0.9, prog: 'load' } },
        { id: 'pull', ex: 'pull_up', scheme: { t: 'bwreps', sets: 5, reps: 5, rest: 120, pctMax: 0.85, note: 'Add weight (DB between feet / belt) once 5×5 is easy.' } },
        { id: 'press', ex: 'bench_press', scheme: { t: 'strength', sets: 3, reps: 6, rir: 2, rest: 150, prog: 'load' } },
        { id: 'row', ex: 'barbell_row', scheme: { t: 'strength', sets: 3, reps: 8, rir: 2, rest: 90, prog: 'load' } },
      ] },
      d3: { name: 'Run Quality (maintain engine)', tag: 'conditioning', slots: [
        { id: 'tempo', ex: 'run_tempo', scheme: { t: 'run', mode: 'tempo', minutes: 20, note: 'One quality session keeps the aerobic base you built. Add an easy Zone-2 run as an optional day.' } },
        { id: 'core', ex: 'hollow_hold', scheme: { t: 'hold', sets: 3, seconds: 35, rest: 45 } },
      ] },
      d4: { name: 'Heavy Sandbag + Power', tag: 'mixed', slots: [
        { id: 'sb', ex: 'sandbag_shoulder', scheme: { t: 'strength', sets: 6, reps: 3, rir: 2, rest: 120, prog: 'load', note: 'Heavier bag, crisp explosive reps. Build the ladder strength.' } },
        { id: 'carry', ex: 'sandbag_carry', scheme: { t: 'carry', sets: 4, dist: 50, rest: 90, loadPct: 0.85 } },
        { id: 'grip', ex: 'dead_hang', scheme: { t: 'hold', sets: 3, seconds: 40, rest: 60 } },
      ] },
    } },

  // -------- 5. POWER, VO2MAX & METCON (idx 32–41) --------
  { id: 'power', name: 'Power, VO2max & Metcon', short: 'Power/Engine', weeks: 10, mesoWeeks: 5, wave: WAVE_5,
    emphasis: { strength: 2, power: 3, muscle: 1, aerobic: 2, anaerobic: 3 },
    focus: 'Convert strength into explosive power and sharpen the mile + event metcons. Strength shifts to MAINTENANCE via fast, sub-maximal lifting (speed deadlifts hold the 1RM). VO2max intervals get the mile fast; the field metcon gets rehearsed for real. Keep sprints fully-recovered — quality, not fatigue.',
    layoutNote: 'Suggested: Mon Lower power · Tue VO2 intervals · Thu Upper power+volume · Sat Sandbag power + field metcon. Keep 48h before any sprint/sandbag testing clear of hard eccentric running.',
    schedule: ['d1', 'd2', 'd3', 'd4'], testSchedule: FULL_TEST,
    days: {
      d1: { name: 'Lower Power (maintain strength)', tag: 'strength', slots: [
        { id: 'dl', ex: 'deadlift', scheme: { t: 'power', sets: 6, reps: 2, rest: 120, pct: 0.7, note: 'Speed deadlifts — every rep as fast as possible. Maintains the 1RM, builds rate of force.' } },
        { id: 'sq', ex: 'back_squat', scheme: { t: 'strength', sets: 3, reps: 3, rir: 2, rest: 150, prog: 'load', note: 'One heavy-ish triple to hold squat strength.' } },
        { id: 'jump', ex: 'broad_jump', scheme: { t: 'power', sets: 5, reps: 3, rest: 75 } },
      ] },
      d2: { name: 'VO2max Intervals (the mile)', tag: 'conditioning', slots: [
        { id: 'int', ex: 'run_intervals_400', scheme: { t: 'run', mode: 'intervals', reps: 6, repDist: '400m', recovery: '90s jog', note: '6 × 400m at ~mile-race effort, 90s easy jog between. The core of a faster mile.' } },
      ] },
      d3: { name: 'Upper Power + Pull/Push Volume', tag: 'strength', slots: [
        { id: 'pp', ex: 'push_press', scheme: { t: 'power', sets: 5, reps: 3, rest: 120, pct: 0.65 } },
        { id: 'pull', ex: 'pull_up', scheme: { t: 'bwreps', sets: 5, reps: 'sub', rest: 90, pctMax: 0.8, note: 'Drive total volume up — the qualifier needs a deep pull-up engine.' } },
        { id: 'push', ex: 'hand_release_push_up', scheme: { t: 'bwreps', sets: 5, reps: 'sub', rest: 75, pctMax: 0.8 } },
        { id: 'row', ex: 'db_row', scheme: { t: 'strength', sets: 3, reps: 10, rir: 2, rest: 75, prog: 'load' } },
      ] },
      d4: { name: 'Sandbag Power + Field Metcon', tag: 'mixed', slots: [
        { id: 'sb', ex: 'sandbag_shoulder', scheme: { t: 'power', sets: 6, reps: 2, rest: 90, note: 'Explosive shoulders, alternate sides — rehearse the ladder pattern.' } },
        { id: 'sprint', ex: 'sprints', scheme: { t: 'run', mode: 'sprints', reps: 6, repDist: '40yd', recovery: 'full', note: 'Sprint mechanics for the metcon finishes. Full recovery — quality over fatigue.' } },
        { id: 'metcon', ex: 'field_metcon', scheme: { t: 'metcon', rounds: 5, timeCap: 1080, items: [{ ex: 'hand_release_push_up', reps: 10 }, { ex: 'walking_lunge', reps: 20 }, { ex: 'air_squat', reps: 20 }], note: 'The real event pattern — 5 rounds, sprint the finish.' } },
      ] },
    } },

  // -------- 6. QUALIFIER PEAK & TAPER (idx 42–46) --------
  { id: 'qualifier_peak', name: 'Qualifier Peak & Taper', short: 'Qualifier', weeks: 5, mesoWeeks: 5,
    wave: [
      { label: 'Sharpen', rirDelta: 0, volMult: 0.90, intMult: 1.03 },
      { label: 'Heavy', rirDelta: -1, volMult: 0.85, intMult: 1.06 },
      { label: 'Peak DL', rirDelta: -2, volMult: 0.75, intMult: 1.10 },
      { label: 'Taper', rirDelta: +1, volMult: 0.55, intMult: 1.0, deload: true },
      { label: 'QUALIFIER WEEK', rirDelta: +2, volMult: 0.40, intMult: 1.0, deload: true, note: 'Submit your qualifier this week — fresh and primed. A true 1RM deadlift + your best "Cindy".' },
    ],
    emphasis: { strength: 3, power: 2, muscle: 1, aerobic: 1, anaerobic: 3 },
    focus: 'Peak the two qualifier lifts — a max deadlift and "Cindy" — and arrive fresh. Volume drops hard the last two weeks while sharpness stays high. This is where ten months of base becomes a number on the leaderboard.',
    layoutNote: 'Suggested: Mon Deadlift peak · Wed Cindy practice · Fri Pull/Push sharpen · then easy aerobic. Rest is a weapon now.',
    schedule: ['d1', 'd2', 'd3', 'd4'],
    days: {
      d1: { name: 'Deadlift Peak', tag: 'strength', slots: [
        { id: 'dl', ex: 'deadlift', scheme: { t: 'topset', sets: 4, reps: 2, rir: 1, rest: 240, backoff: 0.88, prog: 'load', note: 'Heavy, crisp doubles climbing toward your max. Perfect setup every rep.' } },
        { id: 'sq', ex: 'back_squat', scheme: { t: 'strength', sets: 2, reps: 3, rir: 2, rest: 180, prog: 'load' } },
        { id: 'core', ex: 'hollow_hold', scheme: { t: 'hold', sets: 3, seconds: 30, rest: 45 } },
      ] },
      d2: { name: '"Cindy" Practice + Pacing', tag: 'conditioning', slots: [
        { id: 'cindy', ex: 'cindy', scheme: { t: 'metcon', rounds: 'amrap', timeCap: 1200, items: [{ ex: 'pull_up', reps: 5 }, { ex: 'push_up', reps: 10 }, { ex: 'air_squat', reps: 15 }], note: 'Rehearse pacing: break sets BEFORE failure (pull-ups 3/2). Smooth and unbroken wins.' } },
      ] },
      d3: { name: 'Pull-Up / Push-Up Sharpen', tag: 'strength', slots: [
        { id: 'pull', ex: 'pull_up', scheme: { t: 'bwreps', sets: 4, reps: 'sub', rest: 120, pctMax: 0.7, note: 'Crisp, submaximal sets — sharpen, do not grind.' } },
        { id: 'push', ex: 'hand_release_push_up', scheme: { t: 'bwreps', sets: 4, reps: 'sub', rest: 90, pctMax: 0.7 } },
        { id: 'ohp', ex: 'overhead_press', scheme: { t: 'strength', sets: 3, reps: 3, rir: 2, rest: 150, prog: 'load' } },
      ] },
      d4: { name: 'Easy Aerobic + Mobility', tag: 'conditioning', slots: [
        { id: 'z2', ex: 'run_easy', scheme: { t: 'run', mode: 'easy', minutes: 25, note: 'Flush the legs — genuinely easy.' } },
        { id: 'mob', ex: 'mobility_flow', scheme: { t: 'mobility', minutes: 12 } },
      ] },
    } },

  // -------- 7. QUALIFIER→FINALS BRIDGE & FINALS PEAK (idx 47–51) --------
  { id: 'finals_bridge', name: 'Bridge → Finals Peak', short: 'Finals', weeks: 5, mesoWeeks: 5,
    wave: [
      { label: 'Recover & Re-Stim', rirDelta: +1, volMult: 0.70, intMult: 0.95, deload: true, note: 'Break the qualifier taper: easy aerobic + sandbag technique + 2 moderate lifts. Wake the body back up.' },
      { label: 'Finals Overload', rirDelta: -1, volMult: 1.10, intMult: 1.04, note: 'Re-stimulate the fast-decaying finals qualities: sandbag power, mile VO2, field metcon. Deadlift coasts on 1–2 primers.' },
      { label: 'Finals Overload+', rirDelta: -1, volMult: 1.10, intMult: 1.05 },
      { label: 'Taper', rirDelta: +1, volMult: 0.60, intMult: 1.0, deload: true },
      { label: 'FINALS WEEK', rirDelta: +2, volMult: 0.35, intMult: 1.0, deload: true, note: 'Compete fresh. Trust the work. Come and conquer.' },
    ],
    emphasis: { strength: 2, power: 3, muscle: 1, aerobic: 2, anaerobic: 3 },
    focus: 'The ~5 weeks between qualifier and finals. A long taper would DE-TRAIN the finals events (their qualities fade in days), so this is a mini block: recover, then re-overload the sandbag ladder, the fast mile, and the field metcon — keeping the deadlift alive on light heavy primers — then taper into competition day.',
    layoutNote: 'Suggested: Mon Sandbag ladder sim + DL primer · Tue Mile tune · Thu Field metcon sim + sprints · Sat easy + mobility.',
    schedule: ['d1', 'd2', 'd3', 'd4'],
    days: {
      d1: { name: 'Sandbag Ladder Sim + DL Primer', tag: 'mixed', slots: [
        { id: 'sb', ex: 'sandbag_shoulder', scheme: { t: 'metcon', rounds: 1, timeCap: 120, items: [{ ex: 'sandbag_shoulder', reps: 'max' }], note: 'EVENT SIM: 2-min max shoulders, climbing bag weights. Pace the first 60s, then empty it.' } },
        { id: 'dl', ex: 'deadlift', scheme: { t: 'strength', sets: 3, reps: 2, rir: 2, rest: 180, prog: 'load', note: 'Keep the deadlift alive — a few heavy doubles, no grind. Max strength holds for ~30 days.' } },
        { id: 'carry', ex: 'sandbag_carry', scheme: { t: 'carry', sets: 3, dist: 40, rest: 90, loadPct: 0.9 } },
      ] },
      d2: { name: 'Mile Tune-Up (Norwegian 4×4)', tag: 'conditioning', slots: [
        { id: 'int', ex: 'run_intervals_800', scheme: { t: 'run', mode: 'norwegian', reps: 4, repDist: '4 min', recovery: '3 min jog', note: '4 × 4 min hard (≈85–95% max HR), 3 min easy jog between. The most potent VO2max session — sharpens the mile fast.' } },
      ] },
      d3: { name: 'Field Metcon Sim + Sprints', tag: 'mixed', slots: [
        { id: 'metcon', ex: 'field_metcon', scheme: { t: 'metcon', rounds: 5, timeCap: 1080, items: [{ ex: 'hand_release_push_up', reps: 10 }, { ex: 'walking_lunge', reps: 20 }, { ex: 'air_squat', reps: 20 }], note: 'Full event rehearsal. Find your repeatable pace, then sprint the finish.' } },
        { id: 'sprint', ex: 'sprints', scheme: { t: 'run', mode: 'sprints', reps: 4, repDist: '40yd', recovery: 'full' } },
      ] },
      d4: { name: 'Easy Aerobic + Mobility', tag: 'conditioning', slots: [
        { id: 'z2', ex: 'run_easy', scheme: { t: 'run', mode: 'easy', minutes: 22, note: 'Easy flush.' } },
        { id: 'mob', ex: 'mobility_flow', scheme: { t: 'mobility', minutes: 12 } },
      ] },
    } },
];

// ----- precompute phase week ranges (0-based) -----
let _acc = 0;
for (const p of PHASES) { p._start = _acc; p._end = _acc + p.weeks - 1; _acc += p.weeks; }

export function planContext(absWeek) {
  const w = Math.max(0, Math.min(absWeek | 0, MACRO.totalWeeks - 1));
  const phaseIndex = PHASES.findIndex((p) => w >= p._start && w <= p._end);
  const phase = PHASES[phaseIndex] || PHASES[PHASES.length - 1];
  const weekInPhase = w - phase._start;
  const mesoIndex = Math.floor(weekInPhase / phase.mesoWeeks);
  const weekInMeso = weekInPhase % phase.mesoWeeks;
  const wave = phase.wave[weekInMeso] || phase.wave[phase.wave.length - 1];
  const isFinalWeekOfPhase = weekInPhase === phase.weeks - 1;
  const mesoCount = Math.ceil(phase.weeks / phase.mesoWeeks);
  return {
    absWeek: w, phaseIndex, phase, phaseName: phase.name,
    weekInPhase, mesoIndex, mesoCount, weekInMeso, wave,
    isDeload: !!wave.deload, isFinalWeekOfPhase,
    isTestWeek: isFinalWeekOfPhase && !!phase.testSchedule,
    waveLabel: wave.label,
    weeksToQualifier: MACRO.qualifierWeek - w,
    weeksToFinals: MACRO.finalsWeek - w,
  };
}

export function getSession(absWeek, sessionInWeek) {
  const ctx = planContext(absWeek);
  const schedule = ctx.isTestWeek && ctx.phase.testSchedule ? ctx.phase.testSchedule : ctx.phase.schedule;
  const dayKey = schedule[Math.max(0, Math.min(sessionInWeek | 0, schedule.length - 1))];
  const day = ctx.phase.days[dayKey] || COMMON_DAYS[dayKey];
  return { ctx, dayKey, day, sessionInWeek, isOptional: false };
}

export function getDay(dayKey, absWeek) {
  const ctx = planContext(absWeek != null ? absWeek : 0);
  return ctx.phase.days[dayKey] || COMMON_DAYS[dayKey] || null;
}

export function optionalDays() { return ['opt_aerobic', 'opt_skill']; }

export function dateForWeek(startISO, absWeek) {
  const d = new Date(startISO);
  d.setDate(d.getDate() + absWeek * 7);
  return d;
}

export function phaseTimeline() {
  return PHASES.map((p) => ({ id: p.id, name: p.name, short: p.short, start: p._start, end: p._end,
    weeks: p.weeks, focus: p.focus, emphasis: p.emphasis, layoutNote: p.layoutNote }));
}
