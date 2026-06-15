---
description: First-run tailoring. Invokes the bootstrap-project skill to interview the user and rewrite CLAUDE.md placeholders for the current project.
---

Invoke the `bootstrap-project` skill. The skill will:

1. Detect whether `CLAUDE.md.template` still exists (= unbootstrapped) or `CLAUDE.md` already exists (= bootstrapped, ask before overwriting).
2. Interview the user to fill `{{PROJECT_NAME}}`, `{{PROJECT_SLUG}}`, `{{PROJECT_OWNED_RESOURCES}}`, `{{PROJECT_DESCRIPTION}}`, `{{PROJECT_GOALS}}`, `{{PROJECT_TECH_STACK}}`, `{{PROJECT_RULES}}`, `{{PROJECT_OUT_OF_SCOPE}}`, `{{PROJECT_CREDENTIALS}}`, `{{PROJECT_FORBIDDEN_ACTIONS}}`, `{{PROJECT_WORKFLOWS}}`, `{{PROJECT_MISTAKES}}`, `{{PROJECT_SKILLS}}`, `{{PROJECT_FILE_STRUCTURE}}`, and the risk-tier placeholders.
3. **Register the business in `../REGISTRY.md`** — claim a unique slug, add a fleet-table row + detail block, and walk the onboarding checklist for any shared resource that needs creating. This is what keeps the bot in its lane.
4. For content/lead-gen sites (Phase 6b), wire the content-launch pipeline: fill the per-business audit config + SOP tokens (including the red-team `{{FABRICATION_BANS}}` / `{{HONESTY_FORBIDDEN_LIST}}` in `docs/RED-TEAM-SOP.md`), then run `node scripts/redteam-check.mjs --seed` to create the red-team ledger and wire the enforced adversarial review.
5. Write the rewritten file to `CLAUDE.md` (project root).
6. Remove `CLAUDE.md.template` (bootstrapping complete).
7. Prune skills the user doesn't want (default keeps all 8 core skills).
8. Report back: what was filled, what was deferred for later.

Do NOT auto-fill placeholders the user didn't actually provide content for. Leave them as `{{TOKEN}}` so the next session sees them and prompts again. Half-bootstrapped is fine; fake-bootstrapped is not.
