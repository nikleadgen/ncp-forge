---
name: claude-code-troubleshooting
description: >
  Diagnose and resolve Claude Code harness issues. Use when the user
  reports errors, unexpected behavior, context degradation, permission
  issues, session troubles, search failures, MCP timeouts, or asks "why
  isn't Claude Code working." Covers API errors (especially 400 tool
  concurrency), context thresholds (quality drops at 30–40%, not 100%),
  VS Code extension issues, CLAUDE.md problems, ripgrep/search
  failures, and output quality troubleshooting. Skill is
  harness-focused — content/quality issues route to anti-slop or other
  domain-specific reviewers instead.
---

# Claude Code Troubleshooting

Diagnose and fix Claude Code (the harness) issues. This is a
behavioral-diagnostic skill — when the *tool* is misbehaving, not the
content.

## Quick Diagnosis Checklist

1. **Identify symptom** — Error message, unexpected behavior, or
   quality degradation?
2. **Gather context** — What task? How complex? How long has session
   been running?
3. **Check context usage** — Run `/cost` (problems start at 30–40%
   usage, not at 100%).
4. **Run diagnostics** — `/doctor` identifies many issues
   automatically.

## Diagnostic Commands

| Command | Purpose | When to use |
|---|---|---|
| `/doctor` | Health checks | First step for any issue |
| `/cost` | Context usage | Before and during tasks |
| `/compact` | Summarize conversation | Context above 30–40% |
| `/clear` | Fresh session | Task complete or off-track |
| `/rewind` | Undo last action | After errors |
| `/bug` | Report to Anthropic | Persistent bugs |
| `/memory` | View loaded memory | CLAUDE.md troubleshooting |
| `/permissions` | Tool permissions | Repeated permission prompts |

## Troubleshooting Workflow

Follow in order:

1. Run `/doctor`
2. Check `/cost`
3. Try `/rewind` (if recent error)
4. Try `/compact` (if context high)
5. Try `/clear` (if still broken)
6. Simplify the request
7. Report with `/bug` (if nothing works)

## Common Issues and Fixes

### API Error 400 (Tool Concurrency)

**Symptom:** "API Error: 400 due to tool use concurrency issues"

**Cause:** Internal tool calls got out of sync — known VS Code
extension bug.

**Fix:**
1. Run `/rewind` to roll back
2. If that fails, run `/clear` and restart with simpler request
3. Break complex tasks into smaller pieces

**Prevent:** Close files Claude is editing. Keep requests focused on
one task.

### Context Degradation

**Symptoms:** Claude "forgets" instructions, worse responses,
contradicts itself

**Cause:** Context window overloaded. Quality drops at 30–40% usage,
not 100%.

**Fix:**
1. Check with `/cost`
2. Run `/compact` to free space
3. If heavily degraded, `/clear` and start fresh
4. Copy-paste reset: copy important context → `/clear` → paste back
   essentials

**Prevent:** One task per conversation. Fresh sessions for new topics.

### Claude Seems Confused

**Check in order:**
1. Is context above 40%? (`/cost`)
2. Is CLAUDE.md overloaded? (Keep under 150 instructions)
3. Did you switch topics mid-conversation?

**Fix:** Usually `/compact` or `/clear` resolves this.

### Permission Prompts Keep Appearing

**Cause:** Claude Code asks permission for tools each session by
default.

**Fix:** Use `/permissions` to configure which tools run without
asking. For project-specific permissions, edit
`.claude/settings.local.json`.

### CLAUDE.md Changes Not Working

**Cause:** Memory files load at session start, not mid-conversation.

**Fix:** Start a new session after editing, or reference with
`@CLAUDE.md`.

**Important:** Skills DO hot-reload (no restart needed), but subagents
in `.claude/agents/` do NOT — they only register at session start or
via the interactive `/agents` UI.

### Claude Stopped Mid-Task

**Fix:**
1. Press `Ctrl+C` to cancel
2. Run `/rewind` if available
3. If unresponsive, close terminal and restart

**Causes:** Task too large, network issues, context overload.

### Search or @file Not Working

**Symptom:** Claude can't find files, search returns nothing.

**Fix:** Install system ripgrep:
- Mac: `brew install ripgrep`
- Ubuntu/Debian: `sudo apt install ripgrep`

Run `/doctor` to verify.

### MCP Tool Timeout

**Symptom:** MCP server takes too long to respond on startup.

**Fix:** Set timeout env var before launch:
```bash
MCP_TIMEOUT=30000 claude
```

For repeated timeouts on a specific MCP: check `claude mcp list` to
confirm it's connected. Run `/mcp` inside Claude Code to
re-authenticate if needed.

### Output Quality Poor

**This is almost always an input problem.**

**Diagnose:**
- Was request specific enough?
- Did you provide examples of good output?
- Is context degraded? (`/cost`)
- Does CLAUDE.md have conflicting instructions?

**Fix:**
- Add examples: "Output should look like this: [example]"
- Specify format, length, tone explicitly
- Use plan mode (Shift+Tab) before execution
- Clear context and retry with focused request

## Context Management

### Token Usage Thresholds

| Usage | Quality | Action |
|---|---|---|
| 0–20% | Optimal | Continue |
| 20–40% | Starting to degrade | Consider `/compact` |
| 40–60% | Noticeable degradation | `/compact` or `/clear` |
| 60%+ | Significant issues | `/clear` recommended |

### Copy-Paste Reset

When context is degraded but need to preserve info:

1. Copy essential context from terminal
2. Run `/compact` to get a summary
3. Run `/clear` to reset
4. Paste back only what's critical

### External Memory Pattern

For multi-session work:

1. Have Claude write progress to `SCRATCHPAD.md` or a state file
2. Next session, reference that file
3. Claude reads and continues from documented state

## CLAUDE.md Troubleshooting

### Signs of Problems

- Claude ignoring instructions
- Inconsistent behavior across sessions
- Claude doing the opposite of what's specified

### Common Issues

**Too many instructions:** Keep under 150. Claude's system prompt uses
~50.

**Conflicting instructions:** Review for contradictions like
"detailed explanations" vs "keep brief."

**Too vague:** "Write good code" doesn't help. "Use TypeScript strict
mode because we've had production bugs" does.

### Memory File Hierarchy

| File | Scope |
|---|---|
| `~/.claude/CLAUDE.md` | Global (everywhere) |
| `./CLAUDE.md` | Project (this project) |
| `./.CLAUDE.local.md` | Local (not in git) |

Changes require new session to take effect (skills are the exception —
they hot-reload).

## VS Code Extension Recovery

### Step-by-Step for Persistent Errors

1. Try `/rewind` immediately
2. If fails, note what you were doing
3. Run `/clear`
4. Start fresh with simpler task
5. If repeating, try terminal Claude Code instead

### Update or Reinstall

```bash
# Check version
claude --version

# Update via npm
npm update -g @anthropic-ai/claude-code

# Native install (Mac/Linux)
curl -fsSL https://claude.ai/install.sh | bash

# Native install (Windows PowerShell)
irm https://claude.ai/install.ps1 | iex
```

### Authentication Reset

1. Run `/logout`
2. Close Claude Code
3. Restart and re-authenticate
4. If still failing: `rm -rf ~/.config/claude-code/auth.json` then
   restart

## Skills vs Subagents (gotcha that bites every project)

- **Skills hot-reload.** Editing `.claude/skills/<name>/SKILL.md`
  flows live — no restart, no install.
- **Subagents do NOT hot-reload.** Creating `.claude/agents/<name>.md`
  mid-session does NOT register it. Restart Claude Code or use
  `/agents` UI.
- **Subagents cannot spawn other subagents.** Only the main session
  can call `Agent()`. Inter-subagent handoffs flow THROUGH the
  orchestrator.

## Key Principles

- **Context degrades early:** Quality drops at 30–40%, not when full.
- **One task per session:** Don't mix unrelated work.
- **Quality input = quality output:** Bad output means improve the
  request.
- **CLAUDE.md is leverage:** Keep short, specific, updated.
- **When stuck, simplify:** Break into smaller pieces.

## When to Search Web

Claude Code updates frequently. Search when:
- Error not covered here
- Issue appeared after recent update
- GitHub issues might have newer workarounds

## Escalation Path

1. Document: error message, task, steps tried
2. Run `/doctor`, note output
3. Check `/cost`, note percentage
4. Report with `/bug`
5. Check GitHub: https://github.com/anthropics/claude-code/issues

## Official Documentation

- Troubleshooting: https://docs.anthropic.com/en/docs/claude-code/troubleshooting
- Workflows: https://docs.anthropic.com/en/docs/claude-code/tutorials
- Memory: https://code.claude.com/docs/en/memory
