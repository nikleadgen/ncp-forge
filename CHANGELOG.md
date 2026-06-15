# Changelog

All notable changes to Forge (NCP Games Trainer).

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
