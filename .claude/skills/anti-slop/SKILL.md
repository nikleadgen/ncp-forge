---
name: anti-slop
description: >
  Detects and removes AI-generated fluff from drafts before publish or
  delivery. Use when reviewing any content draft (long-form, short-form,
  copy, briefs, internal docs), cleaning AI output, or running a fast
  structural sweep for the patterns the project's banned-word list
  doesn't cover. Flags every instance, then proposes a clean rewrite in
  the project's voice. Project-specific banned phrases and voice rules
  should live in CLAUDE.md or a project-voice skill; this skill owns
  the universal structural patterns that scream "robot wrote this."
---

# Anti-Slop

This skill owns the *structural* AI-slop patterns — the shapes of
sentences that scream "robot wrote this" even when no banned word
appears.

Project-specific banned WORDS live in `CLAUDE.md` (single source of
truth). This skill is the structural-pattern companion.

Two checks. Both required when running this skill.

1. **Vocabulary sweep** → defer to CLAUDE.md's banned list (or a
   project-voice skill if one exists).
2. **Structural sweep** → use this skill's red-flag taxonomy below.

---

## When this skill runs

- A content-generator skill calls it as a self-check after a draft is
  written, before a quality-gate sees the content.
- A quality-gate skill or subagent calls it as part of the pre-publish
  sweep.
- User invokes it directly: "scan this draft for slop" or `/anti-slop`.
- NOT called by generator skills mid-write — those should already
  encode voice rules; anti-slop is a *review*, not an authoring
  constraint.

---

## Input

Accept either:
- Pasted text (user provides content directly)
- File path (read and analyze the file)

If no content provided, ask for it.

---

## Part 1: Structural Red Flags

### Red Flag #1 — Binary contrast addiction
"It's not X, it's Y" — overused AI scaffolding.

**Fix:** Say what you mean directly. Cut the contrast frame; keep the
specific claim.

### Red Flag #2 — Triple threat syndrome
Forced groupings of three.
- "fast, efficient, reliable"
- "transparent, accountable, ethical"

**Fix:** Vary the rhythm. Sometimes two. Sometimes four. Sometimes one.

### Red Flag #3 — Infomercial transitions
- "The catch?"
- "Want to know the secret?"
- "The brutal truth?"
- "Here's the kicker"
- "The best part?"

**Fix:** If a real human wouldn't say it in conversation, cut it.

### Red Flag #4 — Corporate verb disease
Stuffy `-ing` verbs.
- "...highlighting the benefits..."
- "...emphasizing critical importance..."
- "...facilitating better outcomes..."

**Fix:** Use simple active verbs. "show" not "highlighting." "help" not
"facilitating."

### Red Flag #5 — Hedging language
- "It's worth considering..."
- "You might want to think about..."
- "It's important to note that..."

**Fix:** State the claim. Skip the diplomatic warm-up.

### Red Flag #6 — Thesaurus abuse
Fancy words for simple actions.
- utilize → use
- execute → do
- facilitate → help
- implement → start
- optimize → improve
- leverage → use

**Fix:** Write like you talk.

### Red Flag #7 — Arrow obsession
"→" sprinkled like glitter.

**Fix:** Maximum one arrow per page. Usually zero.

### Red Flag #8 — Em-dash overdose
"This approach—which many recommend—can transform your business—if you
put in the work—and see real results."

**Fix:** Use em dashes for emphasis, sparingly. Mix in commas and
periods.

### Red Flag #9 — "Enter: [thing]"
- "Enter: our partner network"
- "Enter: the solution you've been searching for"

**Fix:** Just introduce the thing.

### Red Flag #10 — Theatrical attribution
- "yesterday a vet said something that stopped me in my tracks:"
- "I'll never forget the moment when..."

**Fix:** Describe the actual moment without theater.

### Red Flag #11 — Symbol obsession
"This symbolizes..." / "Which reflects..." / "Emphasizing the
importance of..."

**Fix:** Say what happened. Say what changed. Skip the literary
analysis.

### Red Flag #12 — Generic case study
When data is missing, AI invents people. Usually named Sarah Chen.

**Fix:** Use real names and real numbers, with permission. If neither
exists, cut the section.

### Red Flag #13 — "Everything changed"
- "the strategy that changed everything"
- "this one shift transformed our entire process"

**Fix:** Describe the specific change with specific metrics.

### Red Flag #14 — "Real" overload
"Just real strategy from real experts getting real results."

**Fix:** Show authenticity through specific examples, not by repeating
the word "real."

### Red Flag #15 — Profound but obvious
"Not because of X. But because of Y."

**Fix:** If everyone already knows it, don't package it as insight.

### Red Flag #16 — Short hook questions
- "The best part?"
- "Want to know more?"
- "Ready to level up?"

**Fix:** Either ask a real question that requires thought, or remove
the question entirely.

### Red Flag #17 — "No X. No Y. Just Z."
- "No fluff. No theory. Just answers."

**Fix:** Literally any other sentence structure.

---

## Part 2: Project-specific banned phrases

These violate the project's voice/editorial constitution. Source of
truth lives in `CLAUDE.md` (and any project-voice skill). This skill
does NOT duplicate them — reference CLAUDE.md → "Common Mistakes" or
the project's voice skill.

Detection rule: scan for any phrase listed in CLAUDE.md's banned list.
On hit, auto-fail.

---

## Output Format

### 1. Slop Report

List every instance found by category:

**Vocabulary (from CLAUDE.md list):**
```
[word] — "[context snippet]"
```

**Structural patterns:**
```
[Red Flag #N name] — "[context snippet]"
```

**Project-specific (auto-fail):**
```
[rule violated] — "[context snippet]"
```

**Total:** X issues found

If `Total > 0` and any project-specific issue appears → `status: BLOCKED`
and refuse to ship until fixed.

If `Total > 0` but only structural/vocab issues → `status: needs_revision`
with the clean rewrite below.

If `Total == 0` → `status: clean`.

### 2. Clean Rewrite (only when revision is needed)

Rewrite following the project's voice (per CLAUDE.md):
- Default principles unless the project overrides:
  - Short sentences (8–15 words average)
  - Active voice, subject-verb-object
  - Plain language; eighth-grade reading level unless the project
    audience demands higher
  - Short paragraphs (2–3 sentences max)
  - Lead with the point
  - Specific examples over vague claims

---

## Example

**Input:**
"It's important to note that we delve into the comprehensive landscape
of options to unlock your peace of mind during this difficult journey.
The best part? This transformative approach will supercharge your
clarity."

**Slop Report:**

**Vocabulary:**
- `delve` — "we delve into the comprehensive"
- `comprehensive` — "the comprehensive landscape"
- `landscape` — "comprehensive landscape of options"
- `unlock` — "unlock your peace of mind"
- `transformative` — "This transformative approach"
- `supercharge` — "supercharge your clarity"

**Structural:**
- `Red Flag #5 (Hedging)` — "It's important to note that"
- `Red Flag #16 (Short hook question)` — "The best part?"

**Total:** 8 issues found. status: needs_revision

**Clean Rewrite:**
"Here's what to know about your options. Most fall into three
categories. We'll sort which one fits your situation."
