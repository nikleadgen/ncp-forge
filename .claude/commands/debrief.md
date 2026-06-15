---
description: End-of-session retro. Invokes skill-feedback-capturer with today's NDJSON observation log as primary input.
---

Run the `skill-feedback-capturer` skill. Pass these as inputs:

1. **Primary input (preferred):** `.claude/observations/{today}.ndjson` — if this file exists and has at least one line, treat it as the AUTHORITATIVE source of session learnings. Skip the git/memory archeology fallback unless the NDJSON has fewer than 2 entries.
2. **Secondary input:** `.claude/launch-observations.md` and `.claude/fixes-log.md` — human-readable views of the same data; use only for cross-reference.
3. **Fallback inputs (only if NDJSON is empty/absent):** git log since session start, memory file diffs, files touched, user-feedback phrases mined from this conversation. These are the skill's traditional Phase 1 sources.

Today's date for filename resolution: use `date +%Y-%m-%d` if you need to compute it.

Expected outputs (per the skill's contract):
- A retro file at `docs/retros/session-N-retro-YYYY-MM-DD.md`
- A numbered list of specific suggested skill edits (old text → new text, with file paths)
- An append to `CHANGELOG.md`

After the skill runs, surface the suggested-edits list to the user for batched approval. Do NOT auto-apply any suggested skill edits — that's a `moderate`-tier action and the user reviews first.
