# Requirement: Restore and Wire Create Project Context Command

## Context

The `create project-context`, `approve project-context`, and `refine project-context` commands were implemented as TypeScript handlers (`src/commands/create-project-context.ts`, `src/commands/approve-project-context.ts`, `src/commands/refine-project-context.ts`) but were never wired into `src/cli.ts`. Their corresponding skill files (`.agents/skills/create-project-context/SKILL.md` and `.agents/skills/refine-project-context/SKILL.md`) were accidentally deleted in commit `7a61d3e` as part of a loop alignment refactor. Additionally, the `create-project-context` command only passes `PROJECT_CONTEXT.md` as context to the agent — `AGENTS.md` is missing. The roadmap item was marked `[DONE]` prematurely; none of these commands are functional.

## Goals

- Make `bun nvst create project-context --agent <provider>` fully operational.
- Make `bun nvst approve project-context` and `bun nvst refine project-context --agent <provider>` fully operational.
- Ensure the `create project-context` skill prompt includes `AGENTS.md` content alongside `PROJECT_CONTEXT.md`.
- Restore skill templates to the scaffold so new projects get them on `nvst init`.

## User Stories

### US-001: Wire project-context commands in CLI

**As a** developer, **I want** `bun nvst create project-context`, `bun nvst approve project-context`, and `bun nvst refine project-context` to be recognised by the CLI **so that** I can run the project context workflow without getting "Unknown command" errors.

**Acceptance Criteria:**
- [ ] `bun nvst create project-context --agent ide` routes to `runCreateProjectContext` without error.
- [ ] `bun nvst approve project-context` routes to `runApproveProjectContext` without error.
- [ ] `bun nvst refine project-context --agent ide` routes to `runRefineProjectContext` without error.
- [ ] All three commands appear in `bun nvst --help` output under the primary workflow section.
- [ ] Passing an unknown subcommand to `create`, `approve`, or `refine` still prints a usage error (no regression).
- [ ] Typecheck passes (`bun tsc --noEmit`).

### US-002: Restore `create-project-context` skill

**As a** developer, **I want** `.agents/skills/create-project-context/SKILL.md` to exist **so that** `bun nvst create project-context` can load the skill and build a valid agent prompt.

**Acceptance Criteria:**
- [ ] `.agents/skills/create-project-context/SKILL.md` exists and contains the full skill recovered from commit `8f1c14f`.
- [ ] `scaffold/.agents/skills/create-project-context/tmpl_SKILL.md` exists (scaffold template mirror).
- [ ] Running `bun nvst create project-context --agent ide` does not throw "Skill 'create-project-context' not found".
- [ ] Typecheck passes.

### US-003: Restore `refine-project-context` skill

**As a** developer, **I want** `.agents/skills/refine-project-context/SKILL.md` to exist **so that** `bun nvst refine project-context` can load the skill and build a valid agent prompt.

**Acceptance Criteria:**
- [ ] `.agents/skills/refine-project-context/SKILL.md` exists and contains the full skill recovered from commit `8f1c14f`.
- [ ] `scaffold/.agents/skills/refine-project-context/tmpl_SKILL.md` exists (scaffold template mirror).
- [ ] Running `bun nvst refine project-context --agent ide` does not throw "Skill 'refine-project-context' not found".
- [ ] Typecheck passes.

### US-004: Include `AGENTS.md` in create-project-context prompt context

**As a** developer, **I want** the `create project-context` command to read `AGENTS.md` and pass it as context to the agent prompt **so that** the agent can produce a `PROJECT_CONTEXT.md` that is consistent with the project's agent entry point.

**Acceptance Criteria:**
- [ ] `src/commands/create-project-context.ts` reads `AGENTS.md` from the project root if it exists.
- [ ] When `AGENTS.md` exists, its content is included in the prompt context under the key `agents_md`.
- [ ] When `AGENTS.md` is absent, the command proceeds without error (graceful skip, same pattern as `existing_project_context`).
- [ ] The `create-project-context` skill (`SKILL.md`) documents `AGENTS.md` as an input source in its Inputs table.
- [ ] Running `bun nvst create project-context --agent ide` outputs a prompt that contains the `AGENTS.md` content when the file is present.
- [ ] Typecheck passes.

## Functional Requirements

- FR-1: `src/cli.ts` must import `runCreateProjectContext`, `runApproveProjectContext`, and `runRefineProjectContext` and route the following command patterns:
  - `create project-context [--agent <provider>] [--force]`
  - `approve project-context [--force]`
  - `refine project-context [--agent <provider>] [--challenge] [--force]`
- FR-2: `printUsage()` in `cli.ts` must list all three project-context commands with their flags.
- FR-3: `.agents/skills/create-project-context/SKILL.md` must be restored from git history (commit `8f1c14f`) and updated to list `AGENTS.md` as an input.
- FR-4: `.agents/skills/refine-project-context/SKILL.md` must be restored from git history (commit `8f1c14f`), unchanged.
- FR-5: `scaffold/.agents/skills/create-project-context/tmpl_SKILL.md` and `scaffold/.agents/skills/refine-project-context/tmpl_SKILL.md` must mirror the restored skill files.
- FR-6: `src/commands/create-project-context.ts` must read `AGENTS.md` from `process.cwd()` (if it exists) and add it to the `context` object as `agents_md` before calling `buildPrompt`.

## Non-Goals (Out of Scope)

- Changing the behaviour or content of the `approve-project-context` handler beyond wiring it to the CLI.
- Modifying the `refine-project-context` handler logic.
- Adding new dependencies.
- Updating `state.json` schema (the `project_context` sub-object already exists in the schema).
- Creating or modifying any other skills beyond `create-project-context` and `refine-project-context`.

## Open Questions

- None
