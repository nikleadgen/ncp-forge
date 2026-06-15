# Forge — NCP Games Trainer — Claude Code Session Guide

> Local-first PWA that delivers and autoregulates a 12-month training program to take
> the operator from detrained to winning the New Christendom Press Games (~June 2027).
> Single user, runs on his phone, no backend. Bootstrapped from claude-starter-kit 2026-06-14.

---

## Operating Contract — Skunkworks (read this first)

A solo operator + small agent team solves hard problems with the simplest methods possible.
Speed is not a risk. Complexity is. Every rule protects output quality, not process purity.

- **KISS.** Before adding a component, ask: could a simpler version do 90% of the job? This app
  has **zero npm dependencies** and **no build step** by design. Keep it that way.
- **Builder owns QA end-to-end.** Whoever makes an artifact validates it. No QA theater.
- **Mistakes surface immediately with a fix.** Status is `completed` / `partial` / `blocked` /
  `error`. Silent degradation is forbidden.
- **Output is proof of work.** Ship artifacts, not narrated plans.
- **Every file earns its place.** "Does this produce a measurably better outcome?" — not "is this
  how others do it?"
- **Hard cap: 5 subagents.** Adding a 6th requires removing one.

---

## Shared-Resource Ownership — stay in your lane (fleet safety)

This project is one bot in a fleet (`../REGISTRY.md`). **Rule Zero:** if a resource isn't listed
as YOURS below, don't read, write, move, or delete it.

**You are `ncp-forge`. You own — and may ONLY touch:**
- The `Fitness Training/` project directory.
- **No shared fleet resources.** No GitHub repo, Cloudflare worker, Notion hub, or HubSpot brand.
  All user data lives in the browser (`localStorage`) on the operator's device; backups are local
  JSON files. There is nothing in a shared system to partition.

**Never touch:** the NextRoll Notion teamspace; any other business's repo, worker, store, Notion hub,
or HubSpot brand. If hosting is ever added, name the worker `ncp-forge` (the Naming Law).

---

## What This Project Is

Forge is a local-first, installable Progressive Web App (PWA) for one athlete: the operator,
training to **win the New Christendom Press Games (~June 2027)** from a detrained start. It encodes
a research-backed, periodized 12-month program for the five contested qualities (max strength,
muscular endurance, aerobic/running speed, power-endurance, grip/odd-object) and **autoregulates** —
adjusting the plan set-to-set (RPE/RIR), session-to-session (daily readiness), week-to-week (volume +
ACWR), and cycle-to-cycle (measured progress). Use is meant to be near-thoughtless: open → today's
workout → log a number → done.

**Primary goals (priority order):**
- Take the operator from detrained → **top-30 online qualifier → podium at the in-person finals**.
- Deliver an autoregulating program whose every decision traces to `docs/PROGRAM-SCIENCE.md`.
- Make daily use dead-simple and offline: minimum taps, prefilled prescriptions, works on the phone.
- Never lose a single logged workout.

**Out of scope (explicitly NOT this project):**
- No backend, accounts, or cloud sync (unless the operator later opts in).
- Not a multi-user / general-public fitness product. One athlete.
- Not medical advice or diagnosis. Surfaces a safety disclaimer; honors injury flags.

---

## Tech Stack

- **Vanilla JavaScript (ES modules), HTML5, CSS3.** No framework. No bundler. No build step.
- **PWA:** `manifest.webmanifest` + `sw.js` service worker → installable, fully offline.
- **Persistence:** browser `localStorage`, accessed ONLY through `js/store.js`. Backup/restore via
  JSON export/import.
- **Charts:** hand-rolled inline SVG (no charting library).
- **Serving:** static files. Dev = local static server (`python3 -m http.server`). Phone = "Add to
  Home Screen" from any static host (or the dev server on the LAN).

---

## Critical Rules

1. **Zero dependencies, no build step.** Do not add npm packages or tooling without explicit approval.
2. **All training logic lives in `js/engine.js` + `js/program.js`.** The UI renders prescriptions; it
   never computes or hardcodes them.
3. **Never lose user data.** Every read/write goes through `js/store.js`. A schema change must *migrate*
   existing data, never wipe it; bump `SCHEMA_VERSION` and add a migration.
4. **Evidence-traceable.** Program/autoregulation decisions must be justifiable from
   `docs/PROGRAM-SCIENCE.md`. No bro-science in the engine.
5. **Mobile-first, minimum taps.** Big touch targets. Never add a button that adds a *decision* the
   athlete has to make. Prefill everything possible.
6. **Offline-first.** The app must fully function with no network.
7. **Not medical advice.** Keep the disclaimer; respect injury flags in exercise selection.

---

## File Structure

```
Fitness Training/
  index.html              # app shell
  app.css                 # mobile-first styles
  manifest.webmanifest    # PWA manifest
  sw.js                   # service worker (offline cache)
  icons/                  # app icons
  js/
    store.js              # localStorage data layer + migrations (the ONLY persistence path)
    program.js            # the 12-month periodized plan (data + helpers)
    exercises.js          # exercise library (cues, equipment, substitutions, progression rules)
    engine.js             # autoregulation: today's prescription from plan + history + readiness
    ui.js                 # views + interactions (Today, Workout, Progress, Plan, Settings)
    charts.js             # inline-SVG progress charts
    app.js                # bootstrap, routing, onboarding, SW registration
  docs/
    PROGRAM-SCIENCE.md    # evidence + citations behind every training decision
    PROGRAM-OVERVIEW.md   # human-readable 12-month plan
```

---

## Credentials & Secrets

None. The app holds no secrets and makes no authenticated calls. Do not introduce any.

---

## Risk Tiers — what requires escalation

Full catalog in `.claude/risk-tiers.md`. Summary: **safe** (read, draft, dry-run) auto-allowed;
**moderate** (local config/skill edits) auto-allowed if in scope; **risky** (anything destructive,
external writes, deploys) always escalate.

### Forbidden without explicit user OK in the same message
- **Clearing or overwriting logged workout data** without an export + explicit confirmation.
- **Schema changes that don't migrate** existing `localStorage` data.
- Modifying shared safety primitives (`scripts/lib/`) or any deploy script.
- Emitting `status: completed` from a subagent with a failed DoD check (use `blocked`).
- Adding a 6th subagent without removing one.

---

## Observation Logging — silent during work, batched at debrief

- `/log-observation "<one-line>"` — friction, surprises, discoveries.
- `/log-fix "<what broke> -> <what fixed it>"` — fixes applied.
- `/debrief` at session end invokes `skill-feedback-capturer`; output to `docs/retros/` + CHANGELOG.

---

## Skills (in `.claude/skills/`)

Starter-kit core (project-agnostic): `skill-creator`, `skill-feedback-capturer`,
`skill-auto-improve`, `deep-research`, `claude-code-troubleshooting`, `setting-up-mcps`, `anti-slop`.

**Project-specific skills:** _(none yet — add with `/skill-creator` when one earns its place, e.g. a
`program-author` skill if rebuilding mesocycles becomes routine.)_

---

## Workflows

- **WF01 — Daily use (the athlete):** open app → (if new day) 5-tap readiness check → "Start Workout"
  → log sets (prefilled, autoregulated) → finish (1-tap session RPE) → engine updates state.
- **WF02 — Program authoring/update (Claude):** research (evidence) → `docs/PROGRAM-SCIENCE.md` →
  encode in `js/program.js` + `js/exercises.js` → engine consumes it. Never hand-edit prescriptions
  into the UI.

---

## Common Mistakes to Avoid

Universal anti-patterns (kept regardless of project):
- Building a 6th subagent without removing one.
- Skipping the builder's DoD because "it looked fine."
- Silent partial output — always `BLOCKED` with reasons over a half-finished result.
- Adding "in case they're useful" abstractions, helpers, or feature flags.
- Over-commenting (comment WHY when non-obvious; never WHAT).

Project-specific:
- Putting training math in the UI instead of the engine.
- Writing to `localStorage` outside `store.js`.
- Adding a dependency or build step "for convenience."

---

## Self-Improvement Loop

`/log-observation` + `/log-fix` during work → `/debrief` at session end runs
`skill-feedback-capturer` → retros in `docs/retros/`, CHANGELOG tracks the arc.
