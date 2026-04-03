# Requirement: Lessons Learned File per User Story in Create Prototype

## Context
When `nvst create prototype` executes user stories sequentially, each invoked agent has no memory of what previous agents discovered, tried, or encountered. This causes repeated mistakes, redundant exploration, and loss of valuable implementation insights across stories within the same iteration. A shared, incrementally updated `it_{iteration}_lessons-learned.md` file in `.agents/flow/` gives each agent access to prior context, improving consistency and reducing errors across the iteration.

## Goals
- Enable knowledge transfer between agent invocations within a single `nvst create prototype` run.
- Ensure each agent appends its discoveries, decisions, and observations after completing a user story.
- Ensure each subsequent agent reads the accumulated lessons before starting its own story.

## User Stories

### US-001: Agent writes lessons learned after completing a user story
**As an** AI agent invoked by `nvst create prototype`, **I want** to create or append to `it_{iteration}_lessons-learned.md` in `.agents/flow/` after finishing my user story, **so that** subsequent agents have access to my discoveries and decisions.

**Acceptance Criteria:**
- [ ] The `create-prototype` SKILL.md instructs the agent to write (create or append) a lessons-learned entry to `.agents/flow/it_{iteration}_lessons-learned.md` upon completing its user story.
- [ ] The entry includes: the user story ID, a brief summary of what was implemented, key decisions made, pitfalls encountered, and any useful context for future agents.
- [ ] The instruction is placed at the end of the SKILL.md checklist / output section, after all implementation steps.
- [ ] The file uses the naming convention `it_{iteration}_lessons-learned.md` (iteration prefix, kebab-case, `.md` extension) consistent with other flow artifacts.
- [ ] Typecheck / lint passes.

### US-002: Agent reads lessons learned before starting a user story
**As an** AI agent invoked by `nvst create prototype`, **I want** to read `it_{iteration}_lessons-learned.md` from `.agents/flow/` before beginning implementation, **so that** I can leverage prior agents' insights and avoid repeating known mistakes.

**Acceptance Criteria:**
- [ ] `create-prototype.ts` reads `.agents/flow/it_{iteration}_lessons-learned.md` (if it exists) before building the prompt for each story, and passes its content as a `lessons_learned` context variable to `buildPrompt`.
- [ ] The `create-prototype` SKILL.md includes a step instructing the agent to review the `lessons_learned` context variable (when present and non-empty) before planning implementation.
- [ ] When the file does not exist yet (e.g. first story), the context variable is passed as an empty string and the SKILL.md instruction is skipped gracefully (no error, no noise).
- [ ] The lessons learned content is shown to the agent as a clearly labelled section in the prompt (e.g. `## Lessons Learned from Previous Stories`).
- [ ] Typecheck / lint passes.
- [ ] Manually verified: running `nvst create prototype` (IDE mode) for a multi-story PRD shows the lessons-learned section populated in the second story's prompt after the first story's output is written.

## Functional Requirements
- FR-1: `create-prototype.ts` must read `.agents/flow/it_{iteration}_lessons-learned.md` before building each story's prompt. If the file does not exist, pass an empty string for `lessons_learned`.
- FR-2: `buildPrompt` in `create-prototype.ts` must include `lessons_learned` as a named context variable alongside `iteration`, `project_context`, and `user_story`.
- FR-3: The `create-prototype` SKILL.md must include a pre-implementation step: "If `lessons_learned` is non-empty, read it and incorporate its insights into your implementation plan."
- FR-4: The `create-prototype` SKILL.md must include a post-implementation step: "Append a lessons-learned entry to `.agents/flow/it_{iteration}_lessons-learned.md`. Include: story ID, summary of implementation, key decisions, pitfalls, and notes for future agents."
- FR-5: The lessons-learned file must live at `.agents/flow/it_{iteration}_lessons-learned.md` (e.g. `.agents/flow/it_000043_lessons-learned.md`).
- FR-6: The `lessons_learned` placeholder in SKILL.md must follow the same `{{variable}}` pattern used by other context variables in the skill template.

## Non-Goals (Out of Scope)
- Parsing or validating the structure of the lessons-learned file (free-form markdown is acceptable).
- Surfacing lessons-learned content in the audit, refactor, or approval phases.
- Providing a dedicated `nvst` command to view or reset the lessons-learned file.
- Cross-iteration lessons (file is scoped to the current iteration only).

## Open Questions
- None
