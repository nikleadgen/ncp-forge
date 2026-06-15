# Changelog

All notable changes to Forge (NCP Games Trainer).

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
