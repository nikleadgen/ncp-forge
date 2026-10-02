# Changelog

All notable changes to Forge (NCP Games Trainer).

## [0.8.1] — 2026-10-02 — Smarter set-to-set + reorder your lifts (user request)
- **Reorder before Start**: in Pick your lifts, tap **⇅ Reorder** and move lifts with ↑ ↓ (✕ removes).
- **Set-to-set steering rebuilt.** Each logged set compares reps done + reps left against the plan
  and re-prescribes **every** remaining set (was: only the next one, and only after an RIR tap).
  Missing reps now counts on its own; within ±1 rep you stay at the weight you just used; beyond it
  the load moves by exactly what the set showed (today's e1RM), not a fixed ±4–7%. Bodyweight lifts
  move the rep target instead. Changed sets get a ↑/↓ marker and a toast says why.
- **Working maxes can come down** on real evidence (logged RIR or missed reps, best set >5% under
  the prescription), a third of the gap per session — so after time off the program, Just Lift
  and Pick your lifts all stop prescribing yesterday's numbers. Readiness-trimmed, deload and
  niggle-lightened days done as written never count as a drop.
- Fix: a session's **best** set now sets the max (was whichever qualifying set came last).
- Sets now record their prescription (`targetReps`, `planWeight`) alongside what you did — additive,
  no schema change; older logs simply skip the drop check. SW cache → forge-v13.

## [0.8.0] — 2026-10-02 — Pick your lifts (user request)
- **Pick your lifts** at the top of Home: choose exactly the lifts you'll do, by muscle group (Back,
  Shoulders, Chest, Legs, Arms, Core, Carry & Grip, Power), in the order you'll do them, then Start.
  Each lift shows what you did last time. No warm-up block, no rotation — just your list, through
  the same one-lift-at-a-time workout screen. The day names itself from what's in it ("Back + Shoulders").
- Weights are prefilled from your numbers (e1RM + readiness); reps and set count repeat your last
  session of that lift; the card shows "Last time (Sep 28): 3×10 @ 60lb".
- **＋ Add another lift** mid-session, and **↻ Same as last time** on Home re-picks the lifts you
  actually logged last pick day.
- **＋ Add a set** on any set-based lift, in every mode — log the extra set you actually did.
- New lifts for a real shoulder/arm day: DB Lateral Raise, DB Rear-Delt Fly, DB Shrug, DB Incline
  Press, DB Hammer Curl, DB Overhead Triceps Extension.
- Logs as an extra session (never moves the 52-week pointer), like Just Lift. Finish-screen niggle
  chips no longer squash ("Non", "Lowe back"). Science: PROGRAM-SCIENCE §8b.
- No schema change — existing data loads as-is. SW cache → forge-v12.

## [0.7.0] — 2026-08-04 — Plate math + a week that matches real life (user request)
- **Plate calculator** on every barbell set: `45 · 10 · 2.5 /side` under the weight, updating live as
  you step the load. Greedy from the heaviest plate (45/35/25/15/10/5/2.5/1.25), exact at every 5lb
  increment the engine prescribes. Non-standard bars are handled and labelled (EZ 25lb, trap 60lb);
  dumbbell/bodyweight work shows nothing.
- **Weekly target (2/3/4)** in Settings: the week now advances once you've done or skipped *your*
  number, not four — so training twice a week no longer stalls the program forever. Set it and
  Forge shows your real 28-day average next to it.
- **Block priority order**: with a target under 4 you get the sessions that block exists to build,
  in order (deadlift leads Max Strength; the two qualifier events lead a test week). The rest stay
  on the board as **extra credit** — still startable, never deleted. "Up next" follows priority too.
- **Drift readout** on Home: program week vs calendar week, how far behind you are, and weeks to the
  qualifier — the plan waits for you, but the Games don't. Header now shows today's real date
  instead of the date the current program week *would* have been.
- **Re-entry damping now applies to program sessions too** (was Just Lift only): ≥14 days off trims
  loads ~8%, ≥28 days ~15%, with a banner saying so. After a layoff the ACWR advice says "ease back
  in" instead of "you can push a little more".
- Schema v6 (adds `settings.weekTarget`, defaults to the original 4-day week — existing data migrates
  untouched). SW cache → forge-v11.

## [0.6.0] — 2026-08-03 — "Just Lift": a second way to train (user request)
- **Just Lift** on the Home screen: pick **Leg / Push / Pull / Upper / Full Body** and Forge builds a
  complete session on the spot — every weight, set and rep filled in from your current maxes, today's
  readiness, ACWR and any flagged niggles. Preview it, **↻ different** for another roll, then Start.
- Exercise picks go to whatever you've trained **least recently** (variety with no decision to make);
  rep schemes rotate **Volume → Heavy → Pump** per focus (daily-undulating — PROGRAM-SCIENCE §8).
- **Re-entry damping**: ≥14 days since your last session trims loads ~8%, ≥28 days ~15%, with a note
  saying so. Stored maxes describe the athlete you were, not the one coming back from a layoff.
- **The 52-week plan is untouched.** Free lifts log as extra sessions: full record, history, charts,
  maxes and load monitor — but the week pointer never moves. Nothing existing was changed or lost.
- Swapping inside a free lift is a one-off (it doesn't pin a standing default and break the rotation);
  swapping inside a program lift still saves your default as before.
- Fixes along the way: est-1RM now uses logged **reps-in-reserve** (was assuming RIR 1); a rep max with
  no measurement borrows from the nearest measured lift (9 pull-ups no longer prescribes 3 chin-ups);
  Bench Press added to Progress; paused Just Lift / optional sessions get a **Resume** bar on Home.
- No schema change — existing data loads as-is. SW cache → forge-v10.

## [0.4.0] — 2026-06-18 — Flexible week: start any / skip / never lose a lift (user request)
- The week is now a **completion-based queue, not a calendar week**: start *any* session in any order,
  **skip** one you can't do (with undo), and the week only advances to the next once all four are
  done-or-skipped — so a missed session is never lost, you just do the next one whenever.
- Home board shows each session's real status + date done / RPE, the suggested "up next", and a clear
  note explaining the model. Done state is derived from your actual logged sessions (date-aware).
- SW cache → forge-v8.

## [0.3.1] — 2026-06-16 — Workout preview (user request)
- Tap any session on the Home board to expand a quick preview of its exercises (name + sets×reps)
  before hitting Start. SW cache → forge-v7.

## [0.3.0] — 2026-06-16 — Live auto-updating PWA (user request)
- Service worker is now **network-first**: always serves the latest when online, falls back to cache
  offline. The app **auto-reloads when a new version activates** and checks for updates on every reopen
  (and hourly while open) — no more stale installed copies. Current version is shown in Settings.
- One-time: fully close & reopen the installed app once (with signal) to land the new updater; automatic
  thereafter. SW cache → forge-v6.

## [0.2.2] — 2026-06-15 — Pain/tweak flag + injury routing (user request)
- Flag a cranky area (knee / lower back / shoulder / elbow / hip / wrist / ankle) at the end of any
  workout and Forge **trains around it**: swaps to a joint-safe alternative when one exists (e.g. a
  run becomes a ruck), otherwise **lightens the load + shows a pain-free-range caution**. Today banner
  shows what you're working around; Settings lets you mark it resolved. Seeds from onboarding injuries.
- Schema v3 migration (adds the tweak list). SW cache → forge-v5. Local dev server now sends no-store.

## [0.2.1] — 2026-06-15 — Effort-logging fixes (user feedback)
- Per-set effort logging switched from a confusing 6–10 RPE to a **"reps left?" picker (0–5+)** that
  matches the prescription's reps-in-reserve language — you can now log the RIR you actually had.
- Prescribed RIR ≥5 now shows as **"leave 4+ (easy)"** instead of a falsely-precise "5" (research: RIR
  estimates are unreliable past ~3–4). Set-to-set load nudge now keys off actual RIR. SW cache → forge-v4.
- Home tab is a hub (this-week board + activity calendar); Android Hume paste flow.

## [0.2.0] — 2026-06-14 — Hume/recovery bridge + live deploy
- **Body & recovery log** — weight, body-fat %, resting HR, HRV, sleep (schema v2 migration).
- HRV + short-sleep now refine daily readiness; bodyweight trend added to Progress; weight feeds the
  2×BW deadlift target + bodyweight-relative loads.
- **Health import** — CSV (Apple Health / Health Auto Export columns) + a URL-param `?ingest=` path so an
  iPhone Shortcut can auto-push Hume→Apple Health→Forge each morning. Guide: `docs/CONNECT-HUME.md`.
- **Deployed** — public repo `nikleadgen/ncp-forge`, served via GitHub Pages (branch `main`, /root).
  SW cache bumped to `forge-v2` so installed apps pull the update.

## [0.1.0] — 2026-06-14 — Initial build
- Project scaffolded from claude-starter-kit; CLAUDE.md tailored; registered in fleet REGISTRY (`ncp-forge`).
- Deep multi-agent research run (8 agents, 60+ cited sources) + independent S&C red-team of the macrocycle.
- **Program** (`js/program.js`): 52-week, 7-block periodized plan engineered for the five NCP Games
  events, incorporating every red-team fix (re-anchored calendar, dedicated aerobic block, sandbag
  power deferred to post-strength, an explicit qualifier→finals bridge, distributed power, run/lower
  separation).
- **Engine** (`js/engine.js`): RIR→%1RM loads, equipment-aware rounding, daily-readiness scaling,
  ACWR load monitor, set-to-set RPE adjustment, and auto-updating maxes from logged sets.
- **App**: local-first installable PWA — onboarding, Today + readiness, one-exercise-at-a-time workout
  flow with rest timer and in-app finish screen, Progress (charts + event-readiness scorecard), Plan
  timeline, Settings with JSON export/import. Offline via service worker. Zero dependencies.
- **Docs**: `docs/PROGRAM-SCIENCE.md` (cited rationale) + `docs/PROGRAM-OVERVIEW.md` (the plan).
- Verified end-to-end in a real browser: onboarding → readiness → workout (autoregulated loads,
  set-to-set nudge confirmed) → finish/commit → progress/plan/settings.
