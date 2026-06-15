---
name: skill-creator
description: >
  Guide for creating effective skills in this project. Use when the user
  wants to create a new skill — OR update an existing one — that extends
  Claude's capabilities with specialized knowledge or workflow. Starts
  with a Step 0 "earns its place" gate per CLAUDE.md (≥3 expected uses,
  no existing skill covers it, won't violate the 5-subagent cap).
  Adapted from Anthropic's official skill-creator methodology, scoped to
  this project's conventions (hot-reload skills in .claude/skills/,
  SKILL.md only, no auxiliary docs).
---

# Skill Creator

This skill governs how new skills get built in this project. Anthropic's
bundled `anthropic-skills:skill-creator` is more general; this version
adds the project-specific guardrails so the stack doesn't bloat.

---

## Step 0 — Earns Its Place Gate

Before any other work, the answer to ALL THREE must be yes. If any is
no, stop and report. Do not build the skill.

1. **Recurrence test.** Will this work happen at least 3 times? One-off
   tasks don't deserve a skill; just do them.
2. **Coverage test.** Does an existing skill in `.claude/skills/`
   already cover this methodology? If yes, extend that skill rather
   than creating a new one. Duplication is a bigger sin than length.
3. **Architecture test.** Does this need to be a SUBAGENT (in
   `.claude/agents/`) instead of a SKILL? The project has a hard cap of
   5 subagents (per CLAUDE.md → Operating Contract). If yes-subagent
   and you're already at 5, this STOPS unless you simultaneously demote
   an existing subagent. If skill, proceed.

If Step 0 passes, continue.

---

## Core Principles

### Concise is key
The context window is a public good. Skills share it with system prompt,
conversation history, other skill metadata, and the actual request.

**Default assumption: Claude is already smart.** Only add context Claude
doesn't already have. Challenge each piece: "Does Claude really need
this explanation?" and "Does this paragraph justify its token cost?"

Prefer concise examples over verbose explanations.

### Match degrees of freedom to fragility
- **High freedom (text-only):** when multiple approaches are valid and
  context-dependent.
- **Medium freedom (pseudocode or parameterized scripts):** when there's
  a preferred pattern but variation is fine.
- **Low freedom (specific scripts, few params):** when consistency is
  critical or operations are fragile.

A narrow bridge needs guardrails. An open field doesn't.

### Progressive disclosure
Three loading levels:
1. **Metadata (name + description)** — always in context (~100 words).
   Make the description specific enough that Claude triggers it
   correctly.
2. **SKILL.md body** — loads when triggered. Keep under 500 lines.
3. **Bundled resources** (scripts/, references/, assets/) — load on
   demand.

Move detailed reference material into `references/<topic>.md` and link
from SKILL.md. Don't duplicate.

---

## Anatomy of a Skill

```
.claude/skills/<name>/
├── SKILL.md (required)
│   ├── YAML frontmatter: name, description, optional version
│   └── Markdown body
├── references/        (optional — domain docs loaded as needed)
└── assets/            (optional — templates/files used in output)
```

**Add `scripts/` only when determinism is required** (e.g., a parser
that must produce identical output every time). For most work, markdown
instructions are enough.

### Frontmatter convention

```yaml
---
name: <kebab-case-skill-name>
description: >
  One paragraph. Specific enough for accurate triggering. Include "Use
  when..." and "NOT for..." clauses. Reference the skills that route in
  and out. Keep under ~200 words.
---
```

### What NOT to include
- README.md inside the skill folder
- INSTALLATION_GUIDE.md, QUICK_REFERENCE.md, CHANGELOG.md
- Setup/testing process docs
- Auxiliary user-facing documentation

The skill folder should only contain what an AI agent needs to do the
job.

---

## Skill Creation Process

### Step 1 — Understand the skill with concrete examples
Skip if patterns are already obvious. Otherwise ask:
- "What functionality should this skill support?"
- "Give me 2–3 examples of how it'll be used."
- "What would the user say that should trigger this skill?"

Don't ask more than 2 questions at a time.

### Step 2 — Plan reusable contents
For each concrete example, identify:
1. How would Claude execute this from scratch?
2. What scripts, references, or assets would be reusable?

Common reusable patterns:
- Workflow phases (PHASE 0 = load references, PHASE 1+ = execution)
- A definition-of-done block with objective booleans
- A `references/` subfolder with domain knowledge (schemas, examples,
  prior reports)

### Step 3 — Initialize the skill
Create the directory tree directly. Twenty lines of work:

```bash
mkdir -p .claude/skills/<name>/references
cat > .claude/skills/<name>/SKILL.md <<'EOF'
---
name: <name>
description: >
  TODO: write a triggering description per the conventions above.
---

# <Name>

TODO: body
EOF
```

Once the file lands, the skill is LIVE in the next invocation. No
install step. Edits to SKILL.md hot-reload.

### Step 4 — Edit the skill
Write for another instance of Claude. Include non-obvious procedural
knowledge. Cut anything Claude already knows.

**Always use imperative voice** in instructions.

### Step 5 — Test live (no packaging)
Test by:
1. Triggering the skill via a real prompt
2. Confirming the description triggers it correctly
3. Running the workflow on a real input
4. Adjusting based on what broke

### Step 6 — Iterate
After real use, refine. The `skill-auto-improve` skill tracks per-skill
failure patterns and patches SKILL.md after 3+ similar failures. Manual
refinement also happens via observations in
`.claude/observations/{date}.ndjson` and at session end via `/debrief`.

---

## Anti-Patterns — Kill on Sight

- **Building a 6th subagent without removing one.** Hard cap is 5.
  Skills have no cap; favor skills.
- **Duplicating logic across skills.** If two skills both check for the
  same pattern, pick one and reference from the other.
- **Skill descriptions that are too vague to trigger.** "Helps with
  content" is bad. "Use when reviewing any draft for AI-fluff before
  publish — runs the structural sweep CLAUDE.md's banned-word list
  doesn't cover" is good.
- **Embedding shared lists in 3 places.** Pick a single source of
  truth — usually CLAUDE.md or one canonical skill. Other skills
  reference it; they don't copy.
- **Adding scripts/ when markdown instructions would work.** Add
  scripts only when determinism is required (a parser that must
  produce identical output every time).
- **Building a skill for work that happens once.** That's a one-off
  task. Just do it.

---

## When in doubt, extend instead of create

The most common mistake is creating a new skill when you should be
adding a section to an existing one.

| Need | Don't create | Extend instead |
|---|---|---|
| New variant of an existing workflow | new `<workflow>-v2` skill | the original skill, add a section |
| New banned phrase / convention | `phrase-banner` skill | CLAUDE.md + the relevant generator skill |
| New validation rule | `validator-X` skill | the relevant builder's DoD or anti-slop |

Create new ONLY when there's genuinely no existing methodology home and
the work clears Step 0.

---

## Reference: Anthropic's skill-creator

If you need the full Anthropic methodology (init scripts, packaging,
distribution via `.skill` files), the official bundled skill is
available as `anthropic-skills:skill-creator`. That one's the right
call when building a skill for distribution beyond this project. For
in-project skills, use this version — it's lighter and matches the
project's conventions.
