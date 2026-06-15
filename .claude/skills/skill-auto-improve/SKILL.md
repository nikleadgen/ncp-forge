---
name: skill-auto-improve
description: >
  Passive skill improvement system. NOT user-invocable — this is an
  internal behavior directive. After delivering output from ANY skill,
  silently evaluate that output against the skill's own rules, log any
  failure to the skill's improvements.log, and once 3+ similar failures
  accumulate, patch the skill with a small targeted change. Complements
  skill-feedback-capturer (which runs at session-end via /debrief);
  auto-improve is the continuous per-skill loop between debriefs.
user-invocable: false
disable-model-invocation: false
---

# Skill Auto-Improve

This is not a skill you run. It's a behavior you follow every time you
execute any other skill.

Every skill in this project carries its own quality bar — defined by its
own rules and the user's correction signal. When the skill misses that
bar, log it. When the failures cluster, patch the skill. Then keep going.

The point is to close the gap that `skill-feedback-capturer` can't
close: session-end retros are the right level for cross-skill
learnings, but per-skill drift between retros goes unfixed. This skill
fixes that.

---

## The rule

After delivering output from ANY skill, silently evaluate that output
against the skill's own instructions. If something failed, log it. When
failures pile up at the same root cause, patch the skill. That's it.

---

## What counts as a failure

1. **Skill rule violation.** Output breaks an explicit instruction in
   the skill.
2. **User correction.** User says "no, redo this," "that's wrong,"
   "change X to Y," or otherwise rejects the output.
3. **User edit-after-delivery.** User accepts the output but
   immediately asks for specific changes the skill should have handled.
4. **Repeated manual instruction.** User keeps giving the same
   correction that isn't in the skill.
5. **Silent DoD-check toggling.** A subagent flips a `dod_checks`
   boolean to `true` without evidence in the envelope. Forbidden per
   CLAUDE.md → Operating Contract. Log immediately.
6. **Project-critical violations.** Anything the project's CLAUDE.md
   marks as auto-fail. Log immediately, surface to user.

**What is NOT a failure:**
- User changes their mind about the brief (scope change, not skill
  defect)
- Output is correct but user wants a different creative direction
- One-off edge cases unlikely to recur

---

## Step 1 — Silent eval (every skill run)

After delivering skill output, do a quick internal check — do NOT output
this to the user:

1. Re-read the skill's key rules
2. Did the output follow every rule?
3. Did the user accept the output without corrections?

If everything passed → done. No logging needed.

If something failed → go to Step 2.

---

## Step 2 — Log the failure

Write a single line to the skill's improvement log:

```
.claude/skills/<skill-name>/improvements.log
```

Create the file if it doesn't exist. Each line is a single failure entry:

```
[YYYY-MM-DD] | [failure type] | [what failed] | [skill rule vs reality]
```

**Examples:**

```
2026-05-22 | rule violation | output used "delve" | anti-slop banned-word list prohibits "delve" but it appeared in section 2
2026-05-22 | user correction | user said "too long" | <generator-skill> caps at 1,500 words; output was 1,847 words
2026-05-23 | repeated instruction | user said "shorter paragraphs" | <generator-skill> has no max-paragraph-length rule
2026-05-23 | project critical | <project-specific> | logged + surfaced to user
```

Keep entries short. One line per failure. No paragraphs.

---

## Step 3 — Check if a fix is needed

After logging a failure, scan the full `improvements.log` for that
skill. Count similar failures.

**Fix threshold: 3+ similar failures for normal patterns. 1 failure for
project-critical patterns** (whatever CLAUDE.md marks as auto-fail).

"Similar" means the same root cause — not identical wording, but the
same underlying problem.

Examples:
- "too long" + "way too wordy" + "cut this down" = 3 similar (verbosity)
- "used delve" + "used vibrant" + "used unleash" = 3 similar (banned
  words slipping through)
- "no line breaks" + "wall of text" + "add spacing" = 3 similar
  (formatting density)

If fewer than 3 (and not project-critical) → stop. Don't fix yet.

If 3+ similar (or 1 project-critical) → Step 4.

---

## Step 4 — Patch the skill

Make ONE targeted change. Rules:

**What to change:**
- Add a specific instruction that addresses the failure pattern
- Tighten a vague instruction to be more explicit
- Add an anti-pattern ("Do NOT...") for a recurring mistake
- Move a buried instruction higher if position is the problem
- Add a concrete example showing correct behavior

**What NOT to change:**
- Don't rewrite the skill from scratch
- Don't change multiple things at once
- Don't add vague instructions ("be better at formatting")
- Don't make the skill longer without a specific reason
- Don't touch parts of the skill that are working fine

---

## Editable-paths allowlist (safety boundary)

Auto-improve may edit ONLY these locations:

- `.claude/skills/<name>/SKILL.md` (the skill the failure pattern
  belongs to)
- `.claude/skills/<name>/improvements.log` (logging is always permitted)
- `.claude/skills/<name>/references/*.md` (skill-owned reference files)

Auto-improve MAY NOT edit any of:

- `.claude/agents/*` — subagent files. Forbidden per CLAUDE.md →
  Operating Contract. If a subagent's DoD needs hardening, that's a
  human decision routed through `skill-feedback-capturer` at `/debrief`.
- Any deploy script, anything in `scripts/lib/` — risky tier.
- Any `state.json` for an in-flight task — read-only during the run.
- `CLAUDE.md` — project memory. Changes require human review.
- `.claude/commands/*` — slash command definitions.
- Any path outside `.claude/skills/`.

If the patch needs to touch a forbidden path, DO NOT auto-edit.
Instead, log the failure with a `requires_human` tag and surface it at
the next `/debrief` via `skill-feedback-capturer`.

---

## After patching

1. Append to the bottom of `improvements.log`:

```
--- FIX APPLIED [YYYY-MM-DD] ---
Problem: [one sentence describing the pattern]
Change: [one sentence describing what was added/changed]
Location: [which section of the skill was modified]
---
```

2. Clear the resolved failure entries from the log (delete the lines
   this fix addresses).

3. Tell the user in ONE line what you did:

> "Updated [Skill Name]: added rule about [X] based on [N] recent failures."

That's it. Don't ask for approval. Don't explain at length. Inform and
move on.

---

## When NOT to auto-fix

- **The failure is ambiguous.** Not sure if it's a skill defect or a
  one-off. Wait for more data.
- **The fix would contradict another rule in the skill.** Don't create
  a conflict — flag to user instead.
- **The skill is working well overall.** 1–2 failures across dozens of
  runs is noise. Don't over-optimize.
- **The fix would make the skill significantly longer.** If the skill
  is approaching 500 lines, tighten existing rules instead of adding.
- **The fix needs to touch the editable-paths allowlist limits.** Log
  with `requires_human` tag; surface at `/debrief`.

---

## The test

This system is working if:

1. Skills get slightly better over time without the user asking
2. The user stops having to give the same correction twice
3. Fixes are small, targeted, and don't break other things
4. The improvements.log per skill stays SHORT (failures resolve, not
   accumulate)
5. The user barely notices this is happening — background maintenance,
   not theater
6. `skill-feedback-capturer` at `/debrief` finds FEWER cross-skill
   learnings because most have already been absorbed mid-session
