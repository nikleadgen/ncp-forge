# Changelog

All notable changes to Forge (NCP Games Trainer).

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
