---
name: skill-feedback-capturer
description: >
  Closes the retro-to-skill-update loop at the end of every working
  session. Examines what was learned during the session — from the
  NDJSON observation log (primary), git log, user feedback in the
  conversation, newly-added memory entries, files touched, and skills
  updated — then proposes specific edits to other skills so the lessons
  propagate. Without this, hard-won learnings sit in the session and
  never reach the skills they should improve. Outputs: (1) a session
  retro markdown file, (2) a structured list of suggested skill edits,
  and (3) an append to CHANGELOG.md. Run at session end. Do not use
  mid-session — the signal-to-noise on in-progress work is too low.
---

# Skill Feedback Capturer

This skill harvests the session's learnings, matches each to the
skill(s) that should change, and produces a concrete, actionable update
list. It does NOT make the edits itself — the human (or a separate edit
pass) does that, having reviewed the suggestions.

---

## When to use this skill

Run at the END of every working session that produced learnings. Common
triggers:
- End of a multi-day work session
- After completing a major piece of work
- After a significant retro discussion
- Before context-switching to a new project area

**Do NOT use this skill for:**
- Mid-session reviews (signal-to-noise too low while work is in flight)
- Code-only sessions where nothing was learned procedurally
- Sessions composed entirely of routine maintenance

---

## Required inputs (all have defaults)

- **NDJSON observation log** (preferred when present) — default:
  `.claude/observations/{today}.ndjson`. If this file exists and has
  ≥2 entries, treat it as the AUTHORITATIVE source.
- **Session start commit / time** — default: first commit of today's
  session, or 24 hours ago if no commit found
- **Project root** — default: current working directory
- **Skills directory** — default: `.claude/skills/`
- **Memory directory** — default: Claude Code's per-project memory path
- **Optional: explicit learning notes** — if the user wants to feed
  specific learnings rather than relying on auto-extraction

---

## The workflow — copyable checklist

```
Session Retro: [session range / date]
- [ ] Phase 1: Gather evidence
      [ ] 1.0 — NDJSON observation log (if present, this is primary; skip 1A & 1D)
      [ ] 1A — Git activity (skip if 1.0 ran)
      [ ] 1B — Memory diffs (always)
      [ ] 1C — Skills touched (always)
      [ ] 1D — Conversation mining (skip if 1.0 ran)
      [ ] 1E — Subagent contract sanity sweep
- [ ] Phase 2: Extract distinct learnings
- [ ] Phase 3: Match each learning to affected skill(s)
- [ ] Phase 4: Generate specific suggested edits per skill
- [ ] Phase 5: Write session-retro.md
- [ ] Phase 6: Append summary to CHANGELOG.md
- [ ] Phase 7: Self-validation
```

---

## PHASE 1 — Gather evidence

**Goal:** Build the raw material the rest of the phases will analyze.

### 1.0 — NDJSON observation log (PREFERRED)

If `.claude/observations/{today}.ndjson` exists and has at least 2
entries, this is the AUTHORITATIVE source of session learnings. The
`/log-observation` and `/log-fix` slash commands write to this file
during work, so it captures the user's intent at the moment of the
observation — much higher signal than post-hoc git/memory archeology.

```bash
TODAY=$(date +%Y-%m-%d)
NDJSON_FILE=".claude/observations/${TODAY}.ndjson"
if [ -f "$NDJSON_FILE" ] && [ "$(wc -l < "$NDJSON_FILE")" -ge 2 ]; then
  echo "Using NDJSON as primary source (entries: $(wc -l < "$NDJSON_FILE"))"
  # Parse: each line is {ts, type, session, text, ...}
  # type=observation -> a learning candidate
  # type=fix         -> a learning + the resolution
  # type=action      -> deterministic noise; ignore
else
  echo "NDJSON empty or absent; falling back to git/memory archeology"
fi
```

When NDJSON is authoritative:
- Skip 1A (git activity) UNLESS you need to map an observation to
  specific files
- Skip 1D (conversation mining) — observations were already mined into
  NDJSON at the moment
- Still run 1B (memory diffs) and 1C (skills touched) as cross-reference

When NDJSON is empty/absent: run 1A–1D as originally specified.

### 1A — Git activity
```bash
git log --oneline --since="<session start>"
git diff --stat <session-start-commit>..HEAD
git log --since="<session start>" --name-only --pretty=format:"" | sort -u
```

Capture: commits made, files touched, files created vs. modified.

### 1B — Memory diffs
```bash
find <memory-dir> -type f -newer <session-start-marker>
```

Read each new or modified memory entry — usually the cleanest
articulation of a learning.

### 1C — Skills touched
```bash
find .claude/skills/ -type f -newer <session-start-marker> 2>/dev/null
```

For each modified skill: capture the diff or the new file. These are
the *direct* learnings — someone already started encoding them.

### 1D — User-feedback signals in conversation (if accessible)
Best-effort. Search for phrases like:
- "don't do X again"
- "remember that"
- "from now on"
- "actually, prefer"
- "I prefer"
- "stop doing"

Each is a corrective signal worth propagating.

### 1E — Subagent contract sanity sweep
For every `.claude/agents/*.md` modified this session, verify the
agent's `tools:` list covers the action verbs the input contract uses.
Common failure pattern:

- Contract says "write to `output/{name}.md`" but `tools:` omits `Write`
- Contract says "patch the draft frontmatter" but `tools:` omits `Edit`
- Contract says "fetch the cited URL" but `tools:` omits `WebFetch`

Quick check:
```bash
for f in .claude/agents/*.md; do
  echo "=== $f ==="
  grep -E "^tools:" "$f"
  grep -E "(write|persist|emit|edit|patch|fetch).*(file|URL|to )" "$f" | head -5
done
```

If any verb has no matching tool, surface it as a Phase 4 suggested
edit immediately.

**Output of Phase 1:** A raw inventory of NDJSON entries, commits,
memory edits, skill changes, user-corrective phrases, agent-contract
defects.

---

## PHASE 2 — Extract distinct learnings

Convert the raw inventory into a deduplicated list.

A learning is a sentence of the form: "We learned that [X], which
affects [skill/system Y], which should now [be / do / not do Z]."

Filter rules:
- Same learning expressed in multiple places (memory + commit message +
  skill edit) is ONE learning, not three.
- Learnings tied to routine operations are NOT learnings — skip.
- Learnings too vague to act on ("we should be more careful") are NOT
  learnings — escalate to the user for clarification, or skip.

**Output of Phase 2:** A numbered list of distinct learnings, each
formulated as a complete "We learned X, affects Y, should now Z"
sentence.

---

## PHASE 3 — Match each learning to affected skill(s)

For each learning from Phase 2, examine the "affects" clause and walk
the skill's SKILL.md headings to find the closest matching section.
Flag if a learning doesn't map to any existing skill — that's a
candidate for a new skill (or a memory entry).

**Output of Phase 3:** A mapping from each learning to a list of
`{ skill, section }` tuples.

---

## PHASE 4 — Generate specific suggested edits

For each (learning, skill, section) triplet, write a concrete suggested
edit: what text to add, change, or remove.

Format each suggestion as:
```
Skill: [skill name]
Section: [section heading]
Type: add | change | remove
Specifics:
  [exact text to add | old → new | text to remove]
Why: [one-line rationale from the learning]
```

Each suggestion is concrete enough that a follow-up session can apply
it without re-deriving the reasoning.

---

## PHASE 5 — Write session-retro.md

Path: `docs/retros/session-<N>-retro-<YYYY-MM-DD>.md`

If `docs/retros/` doesn't exist, create it. Each retro file is
immutable — never overwrite a prior retro.

Template:

```markdown
# Session [N] Retro — [YYYY-MM-DD]

## Session summary
[2–4 sentences describing what was worked on]

## Learnings

### Learning 1: [short title]
**Discovered:** [what we figured out]
**Affects:** [which skill(s) / which part of the system]
**Should now:** [the change that should happen]

(One section per learning from Phase 2)

## Suggested skill edits

### `[skill-name]`
- **Section:** [section heading]
- **Type:** add | change | remove
- **Specifics:** [exact change]
- **Why:** [rationale]

(One entry per tuple from Phase 4)

## Items that don't map to existing skills
[Candidates for new skill, memory entry, or noted-for-awareness]

## What we'll do differently next session
[Procedural takeaways; optional]
```

---

## PHASE 6 — Append to CHANGELOG.md

Append a one-paragraph summary at the top of `CHANGELOG.md`:

```markdown
## Session [N] — [YYYY-MM-DD]
**Worked on:** [1-sentence summary]
**Key learnings:** [comma-separated list of learning titles]
**Skills updated:** [list, or "none if all updates deferred"]
**Full retro:** [docs/retros/session-N-retro-YYYY-MM-DD.md](docs/retros/session-N-retro-YYYY-MM-DD.md)
```

The CHANGELOG entry is a tease; the retro file is the full record.

---

## PHASE 7 — Self-validation

```
Feedback-capturer self-check:
- [ ] At least 1 learning identified (if 0 — confirm session truly
      produced nothing new; if yes, output is "no new learnings")
- [ ] Every learning has Discovered / Affects / Should now fields
- [ ] Every suggested edit has Skill / Section / Type / Specifics / Why
- [ ] session-retro.md exists at docs/retros/ with the correct filename
- [ ] CHANGELOG.md has the new session entry at the top
- [ ] No suggested edits reference skills that don't exist
- [ ] No proposed edits remove content another active skill depends on
```

If any item fails: fix or report. Half-finished retros lose more value
than no retro at all (they create false confidence).

---

## Anti-patterns to avoid

1. **Skipping retro generation "because nothing big happened."** Small
   learnings compound. Even 1 learning is worth recording.
2. **Vague learnings.** "We should be more careful about X" is not a
   learning. "[Specific failure] on [date] because [cause]; [specific
   fix] added to [skill] Phase N to catch it" IS a learning.
3. **Suggesting edits to skills that don't exist yet.** Write as
   "candidate new skill: X with purpose Y," don't pretend an existing
   skill covers it.
4. **Auto-applying suggested edits without human review.** The skill
   suggests; the human (or a follow-up session) reviews and applies.
   Auto-apply turns this into an error-amplifying loop.
5. **Re-writing the same learning across multiple skills when one is
   the canonical home.** Pick the single right home; reference from
   others if needed.
6. **Counting routine activity as learnings.** "We rebuilt X" is not a
   learning. "We discovered X's rebuild process loses state under
   condition Y" IS a learning.
7. **Renumbering existing phases when extending a skill.** If a skill
   has sub-phases (1A, 1B, 1C…), insert new content as Phase X.0 or
   X.5 — never renumber 1B → 1C → 1D. External references break
   silently.

---

## Patterns that work — encode and reuse

1. **Validate one component end-to-end before scaling.** Multi-agent /
   multi-skill systems should ship ONE full component, test it against
   a real run, fix what breaks, THEN build the rest from the proven
   template.

2. **Stub partial builds — valid frontmatter + refuse-cleanly body.**
   When building N components but only able to fully validate K of
   them, ship K with full implementation and (N - K) as stubs with
   valid metadata and a body that refuses execution with a clear
   "STUB — pending validation" message.

3. **Rich-remote-content rescue before sync.** When a local
   source-of-truth file is about to sync to a remote system, ALWAYS
   dry-run first. If the remote has richer content, pull the remote
   INTO the local BEFORE applying.

4. **Silent observation logging + batched debrief at session end.**
   Logging friction as it happens via `/log-observation` + `/log-fix`
   produces higher-signal retro material than post-hoc archeology.

---

## Next best skill

After running this skill, the natural follow-up is to apply the
suggested edits in a focused follow-up session. Don't apply edits
mid-retro — separate the "identify" and "apply" passes.

The applied edits should themselves be tracked in the NEXT session's
retro (closing the loop on the loop).
