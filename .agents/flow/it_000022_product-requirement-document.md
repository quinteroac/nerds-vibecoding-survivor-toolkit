# Requirement: Refactored NVST Main Development Loop

## Context
The current NVST workflow exposes multiple commands and phases that do not strictly align with a single, opinionated development loop. This can make it harder for developers to understand and follow a consistent end-to-end process when using NVST to build products. The goal is to streamline the main loop so that all core activities fit into a clear, linear sequence: Define/Refine/Approve Requirement → Create Prototype → Audit Prototype → Refactor Prototype → Approve Prototype.

## Goals
- Provide a single, coherent main development loop that developers can follow end to end.
- Remove commands, skills, and schemas that are not part of the new loop to reduce cognitive load and maintenance surface.
- Introduce stub commands for the new loop steps so the CLI surface area accurately reflects the intended process even before full implementation.
- Update the state schema so `state.json` models the new loop phases and passes Zod validation.
- Ensure the documentation clearly describes the new main loop and how to use it via `bun nvst` commands.

## User Stories
Each story is scoped to fit in one focused implementation session.

### US-001: CLI Surface Matches the New Loop
**As a** developer using NVST, **I want** the available `bun nvst` commands to only reflect the new main loop steps **so that** I am guided through a clear, opinionated development process without outdated or irrelevant commands.

**Acceptance Criteria:**
- [ ] The main loop is represented explicitly by the following commands: `nvst define requirement`, `nvst refine requirement`, `nvst approve requirement`, `nvst create prototype`, `nvst audit prototype`, `nvst refactor prototype`, `nvst approve prototype`.
- [ ] Utility and supporting commands such as `nvst init`, `nvst destroy`, and `nvst write-json` remain available and retain their current behavior (no loss of functionality), even if their role in the workflow documentation is updated.
- [ ] Commands related to the previous standalone test-plan and refactor-plan workflows (e.g. `nvst create test-plan`, `nvst refine test-plan`, `nvst approve test-plan`, `nvst define refactor-plan`, `nvst refine refactor-plan`, `nvst approve refactor-plan`) are removed from the public CLI surface, with any useful behavior folded into the new main-loop commands where applicable.
- [ ] Commands that do not belong to the new loop and are not required as utilities are removed from the CLI entrypoints, with their useful behavior folded into the new loop commands where applicable.
- [ ] Help output (e.g. `bun nvst --help` or equivalent) shows the above main-loop commands as the primary workflow, and lists only the explicitly retained utility commands alongside them.
- [ ] Invoking any removed command name fails with a clear error or is no longer routed by the CLI.
- [ ] Typecheck / lint passes.

### US-002: Stub Commands for New Loop Phases
**As a** developer using NVST, **I want** stub commands for each step in the new main loop **so that** I can invoke them and integrate them into workflows, even before their full internal logic is implemented.

**Acceptance Criteria:**
- [ ] Dedicated CLI commands exist for each step in the loop with these names: `nvst define requirement`, `nvst refine requirement`, `nvst approve requirement`, `nvst create prototype`, `nvst audit prototype`, `nvst refactor prototype`, `nvst approve prototype`, following existing naming and file conventions.
- [ ] Any of these commands that do not yet have full behavior (especially `nvst audit prototype`, `nvst refactor prototype`, `nvst approve prototype`) are implemented as stubs that can be invoked without crashing and return a clear “not implemented yet” or equivalent placeholder message.
- [ ] Each of the above commands is wired into `src/cli.ts` according to project conventions.
- [ ] Any new skills or skill references for these stub commands are either created as minimal placeholders or explicitly avoided until needed, with no broken skill lookups.
- [ ] Typecheck / lint passes.

### US-003: State Schema Reflects the New Loop
**As a** developer using NVST, **I want** the `state.json` schema and runtime state to model the new main development loop **so that** iteration state always reflects where I am in the process and passes validation.

**Acceptance Criteria:**
- [ ] The Zod schema that validates `.agents/state.json` is updated to include the new loop structure (requirement definition, prototype creation, prototype audit, prototype refactor, prototype approval).
- [ ] Any obsolete fields or sub-phases related to removed commands are deleted or clearly deprecated from the schema and example state.
- [ ] A freshly initialized state for a new iteration matches the updated schema and validates successfully.
- [ ] Existing state-transition logic is updated so that it cannot enter phases or statuses that no longer exist.
- [ ] Typecheck / lint passes.

### US-004: Skills and Schemas Aligned to the New Loop
**As a** developer using NVST, **I want** skills and Zod schemas to match the new main loop **so that** there are no orphaned resources or unused validation artifacts.

**Acceptance Criteria:**
- [ ] Skills (`.agents/skills/*`) that are only used by removed commands or obsolete phases are removed or refactored so that no dead skills remain in the project.
- [ ] Any new loop-aware skills needed for stub commands are added as minimal, well-named placeholders, referencing the correct iteration artifacts.
- [ ] Zod schemas that only support removed commands or flows are removed or consolidated; the remaining schemas directly support the new loop and core utilities.
- [ ] There are no unused schema imports or references in the codebase after the cleanup (verified by search or typecheck).
- [ ] Typecheck / lint passes.

### US-005: Documentation Describes the New Main Loop
**As a** developer using NVST, **I want** the documentation to describe the new main development loop and how to run it **so that** I can follow the process without needing to read the code.

**Acceptance Criteria:**
- [ ] `AGENTS.md` and any other core docs that explain the workflow describe the main loop as: Define/Refine/Approve Requirement → Create Prototype → Audit Prototype → Refactor Prototype → Approve Prototype.
- [ ] Example flows and narratives use only the updated set of commands; removed commands are no longer referenced.
- [ ] There is at least one end-to-end example that names the commands in the order they should be run for a typical iteration.
- [ ] All documentation changes are in English and follow existing style and structure conventions.
- [ ] Typecheck / lint passes (where applicable for docs-related code changes).

## Functional Requirements
- **FR-1:** The CLI command set MUST be pruned so that only the explicit main loop commands (`nvst define requirement`, `nvst refine requirement`, `nvst approve requirement`, `nvst create prototype`, `nvst audit prototype`, `nvst refactor prototype`, `nvst approve prototype`) plus explicitly retained utilities (`nvst init`, `nvst destroy`, `nvst write-json` and project-context related flows) remain available to users; test-plan and refactor-plan specific command families MUST be removed from the public CLI.
- **FR-2:** New stub commands MUST be added and/or existing commands refactored to match the main loop names listed above, following the project’s file naming, export, and routing conventions, and MUST execute without runtime errors while clearly indicating their stub status where behavior is not yet implemented.
- **FR-3:** The `.agents/state.json` schema and related Zod definitions MUST be updated to represent the new loop phases and statuses, and any generated or example state MUST validate successfully against this schema.
- **FR-4:** All skills and Zod schemas that are not used by the new loop (including those only supporting the removed test-plan and refactor-plan workflows) MUST be removed or refactored so that there are no dead, unreachable, or misleading resources remaining, while preserving the underlying behavior of useful existing commands by folding it into the new loop-aligned commands when necessary.
- **FR-5:** Documentation (including `AGENTS.md` and any other workflow descriptions) MUST be updated to clearly describe the new main loop, the intended sequence of commands, and how developers should use NVST in this mode.
- **FR-6:** All changes MUST respect the existing architectural and coding conventions documented in `.agents/PROJECT_CONTEXT.md` (TypeScript strict mode, Bun runtime, module structure, error handling, and state management patterns).

## Non-Goals (Out of Scope)
- Introducing a GUI or web interface for NVST is out of scope; the tool remains CLI-only.
- Implementing the full internal logic of the new commands (beyond stub behavior and correct wiring) is out of scope for this requirement.
- Backwards-compatible shims for removed commands (e.g. aliases or hidden compat modes) are out of scope unless explicitly added in a later requirement.
- Changes to provider integration (Claude, Codex, Gemini, Cursor) or skill invocation mechanics are out of scope, except where strictly necessary to align skills with the new loop.
- Broad refactors of unrelated modules or test infrastructure are out of scope; refactoring is limited to what is required to support the new loop structure.

## Open Questions
- None at this time.

The following decisions have been made as part of this requirement:
- Legacy commands will be removed with a clean, breaking change (no deprecated aliases or compatibility shims).
- Dedicated audit and refactor artifacts will be introduced under `.agents/flow/` (e.g. iteration-specific audit and refactor reports) to represent the “Audit Prototype” and “Refactor Prototype” steps.
- Guardrails will enforce the loop strictly, preventing step-skipping by default; any bypass behaviour, if allowed, must be explicit (e.g. via a force flag).
- No specific quantitative success metrics are defined for this iteration; evaluation of the new loop will be qualitative and based on developer experience.
