---
name: create-pr-document
description: "Gathers the requirement from the user and produces it_{iteration}_product-requirement-document.md. Triggered by: bun nvst define requirement."
user-invocable: true
---

# Create Product Requirement Document

Produce `it_{current_iteration}_product-requirement-document.md` in `.agents/flow/` by interviewing the user about the feature or change they want to build.

**Important:** Do NOT start implementing. Just gather the requirement and write the document.

---

## The Job

1. Read `state.json` to get `current_iteration` (6-digit string, e.g. `"000001"`).
2. Ask 3–5 clarifying questions (see Questions Flow).
3. Generate the document following the Output Structure.
4. Write to `.agents/flow/it_{current_iteration}_product-requirement-document.md`.
5. Update `state.json`: `requirement_definition.status` = `"in_progress"`, `requirement_definition.file` = filename.

---

## Questions Flow

Ask only questions where the initial prompt is ambiguous. Present lettered options so the user can reply with short codes (e.g. "1A, 2C").

```
1. What problem does this solve or goal does it achieve?
   A. [inferred option]
   B. [inferred option]
   C. Other: [please specify]

2. Who is the primary user or actor?
   A. End user / customer
   B. Internal operator / admin
   C. Another system or automated process
   D. Other: [specify]

3. MVP scope — what is the minimum set of use cases needed to validate the idea?
   List only the user stories you consider strictly necessary.
   (The agent will include no more than what is listed here.)
   [Open answer — e.g. "UC-1: user can log in, UC-2: user can view dashboard"]

4. Are there hard constraints (deadline, platform, dependencies)?
   [Open answer — skip if none]

5. What does "done" look like? How will we know it works?
   [Open answer — or describe acceptance criteria]
```

---

## Output Structure

```markdown
# Requirement: [Feature or Change Name]

## Context
Brief description of the problem or opportunity this addresses.

## Goals
- [Specific, measurable objective]
- …

## User Stories
Each story must be small enough to implement in one focused session.

### US-001: [Title]
**As a** [actor], **I want** [capability] **so that** [benefit].

**Acceptance Criteria:**
- [ ] [Specific, verifiable criterion — not vague]
- [ ] [Another criterion]
- [ ] Typecheck / lint passes
- [ ] **[UI stories only]** Visually verified in browser

### US-002: …

## Functional Requirements
- FR-1: …
- FR-2: …

## Non-Goals (Out of Scope)
- …

## Open Questions
- …
```

---

## Writing Guidelines

- **MVP first:** include only the user stories from the answer to question 3. If the user did not list explicit stories, propose the smallest set possible and confirm before writing. Do not pad scope.
- Be explicit and unambiguous — the reader may be a junior developer or an AI agent.
- Acceptance criteria must be verifiable: "button shows confirmation dialog before deleting" ✓ — "works correctly" ✗.
- Every story with a UI change must include browser verification as an acceptance criterion.
- Number requirements (`FR-N`) for easy cross-reference with `it_{iteration}_PRD.json`.

---

## Checklist

Before saving:

- [ ] Clarifying questions asked and answered
- [ ] Each user story has verifiable acceptance criteria
- [ ] Functional requirements are numbered and unambiguous
- [ ] Non-goals define clear scope boundaries
- [ ] File written to `.agents/flow/it_{current_iteration}_product-requirement-document.md`
- [ ] `state.json` → `requirement_definition.status` = `"in_progress"`, `requirement_definition.file` set