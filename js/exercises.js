// exercises.js — exercise library tuned to the operator's home gym:
// barbell + squat rack + plates, adjustable dumbbells to 80lb/hand, cable lat-pulldown
// + seated row, EZ-curl bar, a sandbag, a pull-up bar (rack), bodyweight, outdoor running.
//
// Fields:
//   load: how the engine rounds prescribed weight — 'barbell'|'dumbbell'|'cable'|'sandbag'|'bodyweight'|'none'
//   unit: 'weight' (external load), 'bw' (bodyweight reps), 'time' (seconds held), 'run' (running)
//   pattern: movement bucket (for balance + substitution)
//   cues: 1–3 short coaching cues shown on the workout card
//   sub: substitution exercise ids (used if equipment/injury rules out the primary)
//   demo: a search string the UI turns into a "how?" link (online convenience only)

export const EXERCISES = {
  // ---------- Hinge / posterior (deadlift family — qualifier 1RM lives here) ----------
  deadlift: { name: 'Deadlift', load: 'barbell', unit: 'weight', pattern: 'hinge',
    cues: ['Bar over midfoot', 'Wedge — chest up, lats tight', 'Push the floor away'],
    sub: ['trap_bar_deadlift', 'romanian_deadlift'], demo: 'conventional deadlift setup tutorial' },
  trap_bar_deadlift: { name: 'Trap-Bar Deadlift', load: 'barbell', unit: 'weight', pattern: 'hinge',
    cues: ['Stand tall fast', 'Hips and knees finish together'], sub: ['deadlift'], demo: 'trap bar deadlift' },
  romanian_deadlift: { name: 'Romanian Deadlift', load: 'barbell', unit: 'weight', pattern: 'hinge',
    cues: ['Soft knees', 'Hips back, bar drags the thighs', 'Feel the hamstrings'], sub: ['db_rdl'], demo: 'romanian deadlift form' },
  db_rdl: { name: 'Dumbbell RDL', load: 'dumbbell', unit: 'weight', pattern: 'hinge',
    cues: ['Hips back', 'Flat back', 'Squeeze glutes at top'], sub: ['romanian_deadlift'], demo: 'dumbbell rdl' },
  hip_thrust: { name: 'Hip Thrust', load: 'barbell', unit: 'weight', pattern: 'hinge',
    cues: ['Ribs down', 'Chin tucked', 'Full glute lockout'], sub: ['db_hip_thrust'], demo: 'barbell hip thrust' },
  db_hip_thrust: { name: 'DB Hip Thrust', load: 'dumbbell', unit: 'weight', pattern: 'hinge',
    cues: ['Drive through heels', 'Pause at top'], sub: ['hip_thrust'], demo: 'dumbbell hip thrust' },
  kb_swing: { name: 'DB/KB Swing', load: 'dumbbell', unit: 'weight', pattern: 'power-hinge',
    cues: ['Hike it back', 'Snap the hips', 'Float to chest height'], sub: ['kb_clean'], demo: 'kettlebell swing hardstyle' },

  // ---------- Squat / knee ----------
  back_squat: { name: 'Back Squat', load: 'barbell', unit: 'weight', pattern: 'squat',
    cues: ['Big breath, brace', 'Knees track toes', 'Drive up out of the hole'], sub: ['front_squat', 'goblet_squat'], demo: 'low bar back squat' },
  front_squat: { name: 'Front Squat', load: 'barbell', unit: 'weight', pattern: 'squat',
    cues: ['Elbows high', 'Tall chest', 'Sit straight down'], sub: ['goblet_squat', 'back_squat'], demo: 'front squat form' },
  goblet_squat: { name: 'Goblet Squat', load: 'dumbbell', unit: 'weight', pattern: 'squat',
    cues: ['Hold DB at chest', 'Elbows inside knees', 'Upright torso'], sub: ['front_squat'], demo: 'goblet squat' },
  bulgarian_split_squat: { name: 'Bulgarian Split Squat', load: 'dumbbell', unit: 'weight', pattern: 'lunge',
    cues: ['Back foot elevated', 'Down and slightly forward', 'Drive front heel'], sub: ['db_reverse_lunge'], demo: 'bulgarian split squat' },
  db_reverse_lunge: { name: 'DB Reverse Lunge', load: 'dumbbell', unit: 'weight', pattern: 'lunge',
    cues: ['Step back', 'Knee kisses floor', 'Stay tall'], sub: ['walking_lunge'], demo: 'dumbbell reverse lunge' },
  walking_lunge: { name: 'Walking Lunge', load: 'dumbbell', unit: 'weight', pattern: 'lunge',
    cues: ['Long stride', 'Vertical shin', 'Smooth turnover'], sub: ['db_reverse_lunge'], demo: 'walking lunge form' },
  db_step_up: { name: 'DB Step-Up', load: 'dumbbell', unit: 'weight', pattern: 'lunge',
    cues: ['Full foot on box', 'Drive through heel', 'No pushing off back foot'], sub: ['bulgarian_split_squat'], demo: 'dumbbell step up' },

  // ---------- Vertical pull (pull-ups = qualifier; build relentlessly) ----------
  pull_up: { name: 'Pull-Up', load: 'bodyweight', unit: 'bw', pattern: 'vpull',
    cues: ['Dead hang start', 'Chest to bar', 'Control the descent'], sub: ['chin_up', 'lat_pulldown', 'band_pull_up'], demo: 'strict pull up' },
  chin_up: { name: 'Chin-Up', load: 'bodyweight', unit: 'bw', pattern: 'vpull',
    cues: ['Palms toward you', 'Drive elbows down', 'Full lockout at bottom'], sub: ['pull_up', 'lat_pulldown'], demo: 'chin up form' },
  band_pull_up: { name: 'Band-Assisted Pull-Up', load: 'bodyweight', unit: 'bw', pattern: 'vpull',
    cues: ['Foot in band', 'Same path as a strict rep', 'No bouncing'], sub: ['lat_pulldown'], demo: 'band assisted pull up' },
  negative_pull_up: { name: 'Pull-Up Negative', load: 'bodyweight', unit: 'time', pattern: 'vpull',
    cues: ['Jump to top', 'Lower for a 3–5s count', 'Fight all the way down'], sub: ['band_pull_up'], demo: 'pull up negatives' },
  lat_pulldown: { name: 'Lat Pulldown', load: 'cable', unit: 'weight', pattern: 'vpull',
    cues: ['Tall chest', 'Bar to collarbone', 'Squeeze lats, slow return'], sub: ['pull_up'], demo: 'lat pulldown form' },
  dead_hang: { name: 'Dead Hang', load: 'bodyweight', unit: 'time', pattern: 'grip',
    cues: ['Full grip', 'Shoulders active (not totally slack)', 'Breathe'], sub: [], demo: 'dead hang grip' },

  // ---------- Horizontal pull ----------
  barbell_row: { name: 'Barbell Row', load: 'barbell', unit: 'weight', pattern: 'hpull',
    cues: ['Hinge ~45°', 'Pull to lower ribs', 'No heave'], sub: ['db_row', 'cable_row'], demo: 'barbell row pendlay' },
  db_row: { name: 'DB Row', load: 'dumbbell', unit: 'weight', pattern: 'hpull',
    cues: ['Brace on bench/knee', 'Elbow past ribs', 'Squeeze, slow down'], sub: ['cable_row'], demo: 'single arm dumbbell row' },
  cable_row: { name: 'Seated Cable Row', load: 'cable', unit: 'weight', pattern: 'hpull',
    cues: ['Tall posture', 'Pull to belly', 'Shoulders down, not shrugged'], sub: ['db_row'], demo: 'seated cable row' },
  inverted_row: { name: 'Inverted Row', load: 'bodyweight', unit: 'bw', pattern: 'hpull',
    cues: ['Body in a plank', 'Chest to bar', 'Squeeze shoulder blades'], sub: ['db_row'], demo: 'inverted row' },
  face_pull: { name: 'Cable Face Pull', load: 'cable', unit: 'weight', pattern: 'hpull',
    cues: ['Pull to forehead', 'Thumbs back', 'Healthy shoulders'], sub: ['band_face_pull'], demo: 'cable face pull' },

  // ---------- Horizontal push (push-ups = qualifier + metcon movement) ----------
  push_up: { name: 'Push-Up', load: 'bodyweight', unit: 'bw', pattern: 'hpush',
    cues: ['Body rigid plank', 'Elbows ~45°', 'Full lockout'], sub: ['incline_push_up', 'db_floor_press'], demo: 'push up form' },
  hand_release_push_up: { name: 'Hand-Release Push-Up', load: 'bodyweight', unit: 'bw', pattern: 'hpush',
    cues: ['Chest fully down', 'Lift hands at bottom', 'Press as one piece — this is the event standard'], sub: ['push_up'], demo: 'hand release push up' },
  incline_push_up: { name: 'Incline Push-Up', load: 'bodyweight', unit: 'bw', pattern: 'hpush',
    cues: ['Hands on bench/rack', 'Rigid body', 'Full range'], sub: ['push_up'], demo: 'incline push up' },
  bench_press: { name: 'Bench Press', load: 'barbell', unit: 'weight', pattern: 'hpush',
    cues: ['Shoulder blades pinched', 'Bar to lower chest', 'Drive feet'], sub: ['db_bench_press', 'db_floor_press'], demo: 'bench press form' },
  db_bench_press: { name: 'DB Bench Press', load: 'dumbbell', unit: 'weight', pattern: 'hpush',
    cues: ['Wrists stacked', 'Lower under control', 'Press to lockout'], sub: ['db_floor_press'], demo: 'dumbbell bench press' },
  db_floor_press: { name: 'DB Floor Press', load: 'dumbbell', unit: 'weight', pattern: 'hpush',
    cues: ['Triceps touch floor', 'Pause', 'Press up'], sub: ['push_up'], demo: 'dumbbell floor press' },

  // ---------- Vertical push ----------
  overhead_press: { name: 'Overhead Press', load: 'barbell', unit: 'weight', pattern: 'vpush',
    cues: ['Squeeze glutes', 'Bar over mid-foot', 'Head through at top'], sub: ['db_shoulder_press', 'push_press'], demo: 'overhead press form' },
  push_press: { name: 'Push Press', load: 'barbell', unit: 'weight', pattern: 'vpush',
    cues: ['Short dip', 'Drive with legs', 'Punch overhead'], sub: ['db_push_press'], demo: 'push press' },
  db_shoulder_press: { name: 'DB Shoulder Press', load: 'dumbbell', unit: 'weight', pattern: 'vpush',
    cues: ['Ribs down', 'Press to lockout', 'Control the lower'], sub: ['overhead_press'], demo: 'dumbbell shoulder press' },
  db_push_press: { name: 'DB Push Press', load: 'dumbbell', unit: 'weight', pattern: 'vpush',
    cues: ['Dip-drive', 'Catch overhead', 'Stand tall'], sub: ['push_press'], demo: 'dumbbell push press' },

  // ---------- Odd-object / strongman (the sandbag ladder) ----------
  sandbag_shoulder: { name: 'Sandbag Shoulder', load: 'sandbag', unit: 'weight', pattern: 'strongman',
    cues: ['Hug high & tight', 'Hips explode', 'Shoulder, alternate sides'], sub: ['sandbag_clean', 'sandbag_zercher'], demo: 'sandbag shouldering technique' },
  sandbag_clean: { name: 'Sandbag Clean', load: 'sandbag', unit: 'weight', pattern: 'strongman',
    cues: ['Pull to lap', 'Quick elbows', 'Catch on chest'], sub: ['sandbag_shoulder'], demo: 'sandbag clean' },
  sandbag_zercher: { name: 'Sandbag Zercher Squat', load: 'sandbag', unit: 'weight', pattern: 'strongman',
    cues: ['Bag in elbow crook', 'Brace hard', 'Stand tall'], sub: ['goblet_squat'], demo: 'zercher squat sandbag' },
  sandbag_carry: { name: 'Sandbag Carry', load: 'sandbag', unit: 'dist', pattern: 'carry',
    cues: ['Bear-hug or shoulder', 'Tight core', 'Quick steady steps'], sub: ['farmer_carry'], demo: 'sandbag carry' },
  farmer_carry: { name: 'Farmer Carry', load: 'dumbbell', unit: 'dist', pattern: 'carry',
    cues: ['Tall posture', 'Crush the handles', 'Smooth fast steps'], sub: ['sandbag_carry'], demo: 'farmer carry' },

  // ---------- Power / explosive ----------
  box_jump: { name: 'Box Jump', load: 'bodyweight', unit: 'bw', pattern: 'power',
    cues: ['Load and explode', 'Soft landing', 'Step down (save the shins)'], sub: ['broad_jump'], demo: 'box jump' },
  broad_jump: { name: 'Broad Jump', load: 'bodyweight', unit: 'bw', pattern: 'power',
    cues: ['Big arm swing', 'Triple extension', 'Stick the landing'], sub: ['box_jump'], demo: 'standing broad jump' },
  db_snatch: { name: 'DB Snatch', load: 'dumbbell', unit: 'weight', pattern: 'power',
    cues: ['Hike, then snap', 'Punch overhead', 'One smooth pull'], sub: ['kb_swing'], demo: 'dumbbell snatch' },
  kb_clean: { name: 'DB/KB Clean', load: 'dumbbell', unit: 'weight', pattern: 'power',
    cues: ['Zip up the body', 'Catch in the rack', 'Soft front rack'], sub: ['kb_swing'], demo: 'kettlebell clean' },

  // ---------- Bodyweight conditioning movements ----------
  air_squat: { name: 'Air Squat', load: 'bodyweight', unit: 'bw', pattern: 'squat',
    cues: ['Hips below knees', 'Heels down', 'Stand tall and fast'], sub: [], demo: 'air squat standard' },
  burpee: { name: 'Burpee', load: 'bodyweight', unit: 'bw', pattern: 'fullbody',
    cues: ['Chest to floor', 'Jump feet in', 'Reach & hop'], sub: [], demo: 'burpee standard' },
  mountain_climber: { name: 'Mountain Climber', load: 'bodyweight', unit: 'time', pattern: 'core',
    cues: ['Flat back', 'Knees to chest', 'Quick feet'], sub: [], demo: 'mountain climbers' },

  // ---------- Core ----------
  plank: { name: 'Plank', load: 'bodyweight', unit: 'time', pattern: 'core',
    cues: ['Squeeze glutes', 'Ribs down', 'Straight line'], sub: ['hollow_hold'], demo: 'forearm plank' },
  hollow_hold: { name: 'Hollow Hold', load: 'bodyweight', unit: 'time', pattern: 'core',
    cues: ['Low back glued down', 'Long body', 'Breathe shallow'], sub: ['plank'], demo: 'hollow hold' },
  hanging_leg_raise: { name: 'Hanging Leg Raise', load: 'bodyweight', unit: 'bw', pattern: 'core',
    cues: ['No swing', 'Curl pelvis up', 'Slow lower'], sub: ['hollow_hold'], demo: 'hanging leg raise' },
  ab_wheel: { name: 'Ab Wheel', load: 'bodyweight', unit: 'bw', pattern: 'core',
    cues: ['Ribs down', 'Roll only as far as you keep a flat back', 'Pull back with abs'], sub: ['plank'], demo: 'ab wheel rollout' },
  suitcase_carry: { name: 'Suitcase Carry', load: 'dumbbell', unit: 'dist', pattern: 'core',
    cues: ['One DB, stay level', 'No lean', 'Brace the obliques'], sub: ['farmer_carry'], demo: 'suitcase carry' },

  // ---------- Arms / accessories ----------
  ez_curl: { name: 'EZ-Bar Curl', load: 'barbell', unit: 'weight', pattern: 'arms',
    cues: ['Elbows pinned', 'No swing', 'Squeeze top'], sub: ['db_curl'], demo: 'ez bar curl' },
  db_curl: { name: 'DB Curl', load: 'dumbbell', unit: 'weight', pattern: 'arms',
    cues: ['Supinate', 'Slow eccentric', 'No momentum'], sub: ['ez_curl'], demo: 'dumbbell curl' },
  tricep_pushdown: { name: 'Triceps Pushdown', load: 'cable', unit: 'weight', pattern: 'arms',
    cues: ['Elbows tight', 'Full lockout', 'Control up'], sub: ['db_floor_press'], demo: 'cable triceps pushdown' },
  band_face_pull: { name: 'Band Face Pull', load: 'none', unit: 'bw', pattern: 'hpull',
    cues: ['Pull apart to forehead', 'Thumbs back'], sub: ['face_pull'], demo: 'band face pull' },

  // ---------- Running / aerobic ----------
  run_walk: { name: 'Run/Walk Intervals', load: 'none', unit: 'run', pattern: 'aerobic',
    cues: ['Easy run, then walk', 'Nose-breathing pace on the runs', 'Build minutes, not speed'], sub: ['ruck'], demo: 'run walk method beginner' },
  run_easy: { name: 'Easy Run (Zone 2)', load: 'none', unit: 'run', pattern: 'aerobic',
    cues: ['Conversational pace', 'Relaxed shoulders', 'Land under your hips'], sub: ['ruck', 'bike_z2'], demo: 'zone 2 easy run' },
  run_tempo: { name: 'Tempo Run', load: 'none', unit: 'run', pattern: 'aerobic',
    cues: ['"Comfortably hard"', 'Steady, controlled', 'Could speak only a few words'], sub: ['run_easy'], demo: 'tempo run threshold' },
  run_intervals_400: { name: '400m Intervals', load: 'none', unit: 'run', pattern: 'anaerobic',
    cues: ['Hard but repeatable', 'Even splits', 'Full jog/walk recovery'], sub: ['run_intervals_800'], demo: '400m repeats vo2max' },
  run_intervals_800: { name: '800m Intervals', load: 'none', unit: 'run', pattern: 'anaerobic',
    cues: ['~Mile race effort', 'Hold form when it bites', 'Equal-time recovery'], sub: ['run_intervals_400'], demo: '800m repeats' },
  strides: { name: 'Strides', load: 'none', unit: 'run', pattern: 'speed',
    cues: ['~20s smooth accelerations', 'Fast but relaxed', 'Full walk-back recovery'], sub: [], demo: 'running strides' },
  sprints: { name: 'Sprints', load: 'none', unit: 'run', pattern: 'speed',
    cues: ['Drive the arms', 'Tall posture', 'Full recovery between'], sub: ['strides'], demo: 'sprint mechanics' },
  mile_time_trial: { name: '1-Mile Time Trial', load: 'none', unit: 'run', pattern: 'test',
    cues: ['Even pace, negative split', 'Settle, then squeeze', 'Empty the tank last 200m'], sub: [], demo: 'mile time trial pacing' },
  ruck: { name: 'Ruck / Weighted Walk', load: 'none', unit: 'run', pattern: 'aerobic',
    cues: ['Loaded pack or vest', 'Brisk steady pace', 'Tall posture'], sub: ['run_easy'], demo: 'rucking beginner' },
  bike_z2: { name: 'Zone 2 Bike', load: 'none', unit: 'run', pattern: 'aerobic',
    cues: ['Conversational', 'Steady cadence', 'Low-impact aerobic'], sub: ['run_easy'], demo: 'zone 2 bike' },

  // ---------- Mobility / prep ----------
  warmup_flow: { name: 'Dynamic Warm-Up', load: 'none', unit: 'time', pattern: 'mobility',
    cues: ['Leg swings, hip openers', 'T-spine rotations', 'Light to specific'], sub: [], demo: 'dynamic warm up routine' },
  mobility_flow: { name: 'Mobility Flow', load: 'none', unit: 'time', pattern: 'mobility',
    cues: ['Hips, ankles, t-spine', 'Slow breathing', 'No bouncing'], sub: [], demo: 'full body mobility routine' },
  couch_stretch: { name: 'Couch Stretch', load: 'none', unit: 'time', pattern: 'mobility',
    cues: ['Rear foot up wall', 'Squeeze glute', 'Tall torso'], sub: [], demo: 'couch stretch hip flexor' },

  // ---------- Named test / benchmark ----------
  cindy: { name: '"Cindy" (20-min AMRAP)', load: 'none', unit: 'bw', pattern: 'metcon',
    cues: ['5 pull-ups / 10 push-ups / 15 air squats', 'Steady unbroken early', 'Smooth = fast'], sub: [], demo: 'crossfit cindy strategy' },
  field_metcon: { name: 'Field Metcon (event sim)', load: 'none', unit: 'bw', pattern: 'metcon',
    cues: ['5 rounds down ~100yd', 'HR push-ups + walking lunges + air squats', 'Sprint the finish'], sub: [], demo: 'crossfit chipper field workout' },
};

export function getExercise(id) {
  return EXERCISES[id] || { name: id, load: 'none', unit: 'weight', pattern: 'other', cues: [], sub: [] };
}

export function exerciseName(id) { return getExercise(id).name; }

// Pick the best available substitution given an exclusion set (equipment/injury).
export function resolveExercise(id, excluded = new Set()) {
  if (!excluded.has(id)) return id;
  const ex = getExercise(id);
  for (const s of ex.sub || []) if (!excluded.has(s)) return s;
  return id; // nothing better; caller decides
}
