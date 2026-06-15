#!/usr/bin/env bash
#
# log-fix.sh — append a fix record to today's NDJSON log AND the human-readable .md log.
# Usage: scripts/log-fix.sh "<what broke> -> <what fixed it>" [files: comma-separated]
#
# Writes to:
#   .claude/observations/{YYYY-MM-DD}.ndjson — structured event log
#   .claude/fixes-log.md                      — human-readable, reverse-chron at bottom

set -euo pipefail

if [ $# -lt 1 ]; then
  echo "Usage: $0 \"<broke> -> <fix>\" [files: comma-separated paths]" >&2
  exit 2
fi

TEXT="$1"
FILES="${2:-}"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DATE="$(date +%Y-%m-%d)"
TS="$(date +%Y-%m-%dT%H:%M:%S%z)"
NDJSON_DIR="$REPO_ROOT/.claude/observations"
NDJSON_FILE="$NDJSON_DIR/${DATE}.ndjson"
MD_FILE="$REPO_ROOT/.claude/fixes-log.md"

mkdir -p "$NDJSON_DIR"

ESCAPED_TEXT=$(printf '%s' "$TEXT" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g')
ESCAPED_FILES=$(printf '%s' "$FILES" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g')

printf '{"ts":"%s","type":"fix","text":"%s","files":"%s"}\n' \
  "$TS" "$ESCAPED_TEXT" "$ESCAPED_FILES" >> "$NDJSON_FILE"

if [ -n "$FILES" ]; then
  printf '%s | %s | files: %s\n' "$(date +'%Y-%m-%d')" "$TEXT" "$FILES" >> "$MD_FILE"
else
  printf '%s | %s\n' "$(date +'%Y-%m-%d')" "$TEXT" >> "$MD_FILE"
fi

echo "logged fix -> $NDJSON_FILE"
