---
description: Log a one-line observation (friction, surprise, discovery) to today's observation log.
argument-hint: <one-line description>
---

Run the bash helper that appends an NDJSON event AND a human-readable line:

```
scripts/log-observation.sh "$ARGUMENTS"
```

That's the whole command. The helper writes to `.claude/observations/{today}.ndjson` (structured, mineable) and `.claude/launch-observations.md` (human-readable). Do not edit those files by hand.

If `$ARGUMENTS` is empty, print usage and stop. Do NOT prompt the user — the slash command is fire-and-forget by design.
