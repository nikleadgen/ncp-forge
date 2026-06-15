#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Status / debrief convention hook (portable; safe to install fleet-wide).
# No-ops in any repo that does NOT have docs/STATUS.md, so it can live globally
# or per-project without affecting projects that haven't adopted the convention.
#
#   SessionStart → clear the once-per-session marker + remind to read/update STATUS.md.
#   Stop         → once per session, if the working tree is clean and commits have
#                  landed since docs/STATUS.md was last updated (i.e. STATUS is behind
#                  the work), block once and ask for the end-of-session debrief.
#
# Every non-nudge path exits 0 (allow stop) so a failure can never trap a session.
# ---------------------------------------------------------------------------
input=$(cat 2>/dev/null)
dir="${CLAUDE_PROJECT_DIR:-$(pwd)}"
cd "$dir" 2>/dev/null || exit 0
[ -f docs/STATUS.md ] || exit 0   # convention not adopted here → do nothing

event=$(printf '%s' "$input" | sed -n 's/.*"hook_event_name"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')
# Once-per-session marker lives in the temp dir (keyed per project) so it never
# pollutes the repo or needs a .gitignore entry. Cleared on SessionStart.
marker="${TMPDIR:-/tmp}/claude-status-nudged-$(printf '%s' "$dir" | tr -c 'A-Za-z0-9' '_')"

if [ "$event" = "SessionStart" ]; then
  rm -f "$marker" 2>/dev/null
  printf 'Project convention: docs/STATUS.md is the living status + session log. Read it now for current state, and before this session ends update it (bump Current status, update Queued, prepend a dated Session log entry) and commit. CLAUDE.md is the stable guide — keep volatile status out of it.\n'
  exit 0
fi

if [ "$event" = "Stop" ]; then
  printf '%s' "$input" | grep -q '"stop_hook_active"[[:space:]]*:[[:space:]]*true' && exit 0
  [ -f "$marker" ] && exit 0
  [ -d .git ] || exit 0
  clean=$(git status --porcelain 2>/dev/null)
  status_t=$(git log -1 --format=%ct -- docs/STATUS.md 2>/dev/null); status_t=${status_t:-0}
  latest_t=$(git log -1 --format=%ct 2>/dev/null); latest_t=${latest_t:-0}
  if [ -z "$clean" ] && [ "$latest_t" -gt "$status_t" ] 2>/dev/null; then
    touch "$marker" 2>/dev/null
    printf '{"decision":"block","reason":"End-of-session debrief: commits have landed since docs/STATUS.md was last updated, so it is probably behind. Before finishing, update docs/STATUS.md (bump Current status, update Queued, prepend a dated Session log entry with the commit hashes) and commit it. This reminder fires once per session."}\n'
  fi
  exit 0
fi
exit 0
