# Risk Tiers — Canonical Definitions

Single source of truth for the risk-tier system. Both humans and any
risk-gate scripts read from here. Update here first, then mirror the
table into `CLAUDE.md` only if the user-facing rules change.

---

## The three tiers

| Tier | Default behavior |
|---|---|
| **safe** | Auto-allowed within preauthorized scope. No prompt, no confirmation. |
| **moderate** | Auto-allowed if the current task's declared scope covers it; otherwise escalates to user. |
| **risky** | ALWAYS escalates. No auto-allow path. User must confirm in the same message. |

---

## Action class catalog

Tiering happens by **action class** (what kind of thing is happening),
NOT by code size. A 1-line deletion of a deploy script is `risky`;
a 500-line new content file is `safe`.

### safe
- Read any file in the repo
- Run typecheck / build (no deploy)
- Call read-only MCP tools (search/fetch/get/list)
- Draft content / write to scratch / dry-run output locations
- Run any script with `--dry-run`
- Write to `.claude/observations/`, `.claude/launch-observations.md`,
  `.claude/fixes-log.md`
- Create new file inside the active task's declared scope

### moderate
- Local writes to config files that affect future runs (skill source,
  agent definitions, settings.local.json)
- Preview / staging deploys
- Dev-server runs against any environment
- Edits to `.claude/agents/*.md` (changes future subagent behavior)
- Edits to any skill source under `.claude/skills/` (changes future
  runs — skills hot-reload)
- Create new file outside active scope but within the project repo
- {{PROJECT_MODERATE_ACTIONS}}

### risky (ALWAYS escalate)
- Production deploys
- Writes to external systems (CRM, payments, comms, queues, mailing
  lists)
- Direct writes to a production database
- Schema changes (any system: DB, content collection, API contract)
- Edits to files in `scripts/lib/` (shared safety primitives)
- Edits to any deploy script
- Edits to the orchestrator skill (whichever skill drives multi-step
  workflows in this project)
- Edits to any active task's `state.json` while that task is in-flight
- Skipping any builder DoD or pre-publish gate, for any reason
- Anything outside the current task's declared scope
- {{PROJECT_RISKY_ACTIONS}}

---

## Auto-escalation rules

A `safe` or `moderate` action AUTO-ESCALATES to `risky` if it:
1. Touches any path in `scripts/lib/` or any deploy script
2. Touches the orchestrator skill
3. Touches an in-flight task's `state.json`
4. Affects a resource outside the current task's declared scope
5. Affects any already-live production resource

If the action matches MORE THAN ONE class, the highest tier wins.

---

## Updating this file

- Adding a new action class: append to the appropriate tier section.
- Re-tiering an existing class (e.g., `moderate` → `risky`): do it in
  one commit; partial re-tiering is a silent safety bug.
- Removing a class: only if it's truly unused. Mark deprecated for one
  session before removing.
