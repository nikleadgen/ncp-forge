---
description: Log a fix (what broke -> what fixed it) to today's fix log.
argument-hint: <broke> -> <fix> [|| comma-separated file paths]
---

Run the bash helper:

```
scripts/log-fix.sh "$ARGUMENTS"
```

If the user passed a `||` separator, split on it: everything before is the fix text, everything after is the file list. Pass them as two arguments to the script.

Examples:
- `/log-fix HubSpot field missing -> added pet_type property in HubSpot UI`
- `/log-fix .assetsignore missing -> created at repo root || .assetsignore, wrangler.jsonc`

If `$ARGUMENTS` is empty, print usage and stop.
