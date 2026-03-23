# Requirement: Standalone Skill Invocation (NVST-agnostic skills)

## Context

NVST skills are currently authored for invocation via `nvst <command>`, which injects context variables (iteration, file paths, user story data) and validates `state.json` before and after each step. When a developer invokes a skill directly from an AI agent CLI (e.g. `/define-requirement` in Claude Code, Cursor, or any agent that supports skills installed via `npx skills add`), the skill fails or behaves unexpectedly because it assumes NVST orchestration is active.

The fix must live entirely in the skill files (`nvst-skills/*/SKILL.md`). The NVST command handlers and their state validation logic remain unchanged.

## Goals

- Any NVST skill can be successfully invoked from any AI agent CLI that supports skills, without NVST being installed or the NVST flow being active.
- Skills that currently depend on `state.json` or NVST-injected context variables self-detect their absence and prompt the user for the missing information instead.
- Skills that currently write to `state.json` skip that step when running standalone (state management remains NVST's responsibility).
- All workflow skills are discoverable by agent CLIs (`user-invocable: true` in frontmatter).

## User Stories

### US-001: Skills that read `state.json` detect NVST absence and ask user for required context

**As a** developer invoking an NVST skill directly from an agent CLI,
**I want** the skill to detect whether `state.json` is present and, if not, ask me for the required information (e.g. iteration number, PRD file path),
**so that** I can complete the skill's job without needing to run `nvst` or have a valid `state.json`.

**Affected skills:** `define-requirement`, `refine-requirement`, `create-project-context`

**Acceptance Criteria:**
- [ ] Each affected skill's "The Job" section is updated so that the first step reads: "Check if `.agents/state.json` exists. If it does, read it to obtain `current_iteration` (and any other required fields). If it does not exist, ask the user to provide the required information (e.g. iteration number as a 6-digit string, or the PRD filename)."
- [ ] `refine-requirement` specifically: when `state.json` is absent, asks the user for the path to the existing PRD file (e.g. `it_000037_product-requirement-document.md`) instead of reading `requirement_definition.file` from state.
- [ ] The fallback prompts use the same lettered-options format used in the rest of the skill's Questions Flow.
- [ ] Typecheck / lint passes (no code changes required; SKILL.md is a markdown file).

---

### US-002: Skills that write to `state.json` skip that step when running standalone

**As a** developer invoking an NVST skill directly from an agent CLI,
**I want** the skill to update `state.json` only when it already exists (i.e. NVST is managing the workflow),
**so that** the skill does not fail or leave a corrupt/unexpected `state.json` behind when run standalone.

**Affected skills:** `define-requirement`, `create-project-context`

**Acceptance Criteria:**
- [ ] Each affected skill's final step (state update) is rewritten as: "If `.agents/state.json` exists, update `<field>` = `<value>`. If it does not exist (standalone mode), skip this step and notify the user that state was not persisted."
- [ ] The notification message is clear and non-blocking (e.g. "Running standalone — state.json not found, skipping state update.").
- [ ] Typecheck / lint passes.

---

### US-003: Skills that receive NVST context variables prompt user for them when invoked standalone

**As a** developer invoking a workflow skill directly from an agent CLI (without NVST injecting context),
**I want** the skill to detect that required context variables are missing and ask me for them interactively,
**so that** I can use the skill without NVST's orchestration layer.

**Affected skills:** `create-prototype`, `refactor-prototype`, `approve-prototype`, `audit-prototype`

**Acceptance Criteria:**
- [ ] Each affected skill's "Context" / "Inputs" section is updated with a standalone fallback that follows the lookup order: (1) injected context variable → (2) `state.json` → (3) artifact files → (4) ask user.
- [ ] `create-prototype`: when `user_story` or `iteration` are absent, reads `state.json` (if present) to get `current_iteration`, then reads `.agents/flow/it_{iteration}_PRD.json` (preferred) or `.agents/flow/it_{iteration}_product-requirement-document.md` to discover available user stories and asks the user which story to implement. Only asks for the iteration number if neither `state.json` nor any PRD file can be found.
- [ ] `refactor-prototype`: when `iteration` or `audit_json_path` are absent, reads `state.json` (if present) to get `current_iteration`, then reads `.agents/flow/it_{iteration}_audit.json` or `.agents/flow/it_{iteration}_audit.md` directly. Only asks the user for the iteration number if no artifact can be found.
- [ ] `approve-prototype`: when `iteration` is absent, reads `state.json` (if present) to get `current_iteration`. Only asks the user if `state.json` is also absent.
- [ ] `audit-prototype`: when `iteration` is absent, reads `state.json` (if present) to get `current_iteration`, then resolves `.agents/flow/it_{iteration}_PRD.json` or `.agents/flow/it_{iteration}_product-requirement-document.md`. Only asks the user if no artifact can be found.
- [ ] Typecheck / lint passes.

---

### US-004: All workflow skills are marked `user-invocable: true` in frontmatter

**As a** developer using an AI agent CLI that loads skills via `npx skills add`,
**I want** all NVST workflow skills to appear as invocable slash commands in my agent,
**so that** I can discover and invoke them without knowing they were originally orchestrated by NVST.

**Affected skills:** `audit-prototype`, `create-prototype`, `refactor-prototype`, `approve-prototype` (currently `user-invocable: false`)

**Acceptance Criteria:**
- [ ] The frontmatter field `user-invocable` is set to `true` in all four affected skills.
- [ ] No other frontmatter fields are modified.
- [ ] Typecheck / lint passes.

---

## Functional Requirements

- FR-1: Each skill that reads `state.json` must first check for the file's existence before attempting to read it.
- FR-2: When `state.json` is absent, skills must interactively ask the user for any required fields (iteration number, file paths) using the lettered-options format.
- FR-3: Each skill that writes to `state.json` must wrap that step in a conditional: execute only if `state.json` already exists.
- FR-4: Skills that receive context variables from NVST must declare a standalone fallback with the following lookup order: (1) injected context variable → (2) `state.json` → (3) artifact files (PRD json/md, audit json/md) → (4) ask user. Skills must not ask the user for information that can be resolved by reading existing files.
- FR-5: All four workflow skills currently marked `user-invocable: false` must be updated to `user-invocable: true`.
- FR-6: No changes may be made to `src/` files, NVST command handlers, or `.agents/state.json` schema — only `nvst-skills/*/SKILL.md` files may be modified.

## Non-Goals (Out of Scope)

- Modifying NVST command handlers (`src/commands/`) or their state validation logic.
- Changing how `nvst init` installs skills (installation is already multi-agent via `npx skills add`).
- Adding new NVST commands or CLI flags.
- Updating design/impeccable skills (adapt, animate, bolder, clarify, colorize, critique, delight, distill, extract, frontend-design, harden, normalize, onboard, optimize, polish, quieter, teach-impeccable) — these are already standalone by nature.
- Updating `ideate` and `create-project-context` standalone behavior beyond what FR-1 through FR-4 require.
- Automated testing of skill markdown content.

## Open Questions

- None
