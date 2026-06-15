#!/usr/bin/env bash
#
# log-observation.sh — append an observation to today's NDJSON log AND the human-readable .md log.
# Usage: scripts/log-observation.sh "<one-line description>" [optional: session label, defaults to date]
#
# Writes to:
#   .claude/observations/{YYYY-MM-DD}.ndjson — structured event log, mineable by /debrief
#   .claude/launch-observations.md           — human-readable, reverse-chron at bottom
#
# Both writes are atomic per call. NDJSON is the authoritative log; the .md is a UX courtesy.

set -euo pipefail

if [ $# -lt 1 ]; then
  echo "Usage: $0 \"<observation text>\" [session-label]" >&2
  exit 2
fi

TEXT="$1"
SESSION="${2:-$(date +%Y-%m-%d)}"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DATE="$(date +%Y-%m-%d)"
TS="$(date +%Y-%m-%dT%H:%M:%S%z)"
NDJSON_DIR="$REPO_ROOT/.claude/observations"
NDJSON_FILE="$NDJSON_DIR/${DATE}.ndjson"
MD_FILE="$REPO_ROOT/.claude/launch-observations.md"

mkdir -p "$NDJSON_DIR"

ESCAPED_TEXT=$(printf '%s' "$TEXT" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g')
ESCAPED_SESSION=$(printf '%s' "$SESSION" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g')

printf '{"ts":"%s","type":"observation","session":"%s","text":"%s"}\n' \
  "$TS" "$ESCAPED_SESSION" "$ESCAPED_TEXT" >> "$NDJSON_FILE"

printf '%s | %s | %s\n' "$(date +'%Y-%m-%d %H:%M')" "$SESSION" "$TEXT" >> "$MD_FILE"

echo "logged observation -> $NDJSON_FILE"
