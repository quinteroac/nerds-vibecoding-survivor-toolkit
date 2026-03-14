# Requirement: Ideation Phase — `nvst ideate` Command

## Context

The NVST roadmap lists an optional Ideation Phase before each iteration. Currently there is no command to support structured brainstorming: developers jump straight into `nvst define requirement` without a guided way to explore what to build next or how to evolve their project's roadmap. This gap is felt for both greenfield projects (deciding what to build) and ongoing projects (deciding which feature to tackle next). The `nvst ideate` command fills this gap by running an interview-driven skill prompt (following the existing prompt-output pattern) that guides the developer through a structured conversation, then proposes concrete updates to `ROADMAP.md` and optionally `PROJECT_CONTEXT.md`.

## Goals

- Provide a CLI-native ideation workflow via `bun nvst ideate --agent <provider>`.
- Follow the existing prompt-output architecture (no internal agent calls; output is a skill prompt consumed by the IDE/AI environment).
- Support both new projects and feature ideation for ongoing projects.
- Track ideation state in `state.json` so it is visible in the workflow history.
- Add the skill template to `scaffold/` so new projects get it on `nvst init`.

## User Stories

### US-001: Wire `nvst ideate` command in CLI

**As a** developer, **I want** `bun nvst ideate --agent <provider>` to be a recognised CLI command **so that** I can start an ideation session without getting an "Unknown command" error.

**Acceptance Criteria:**
- [ ] `bun nvst ideate --agent ide` routes to `runIdeate` without error.
- [ ] `bun nvst ideate --agent claude` routes to `runIdeate` without error.
- [ ] The command appears in `bun nvst --help` output under the workflow section.
- [ ] `--force` flag is accepted and passed through to the guardrail.
- [ ] Passing `nvst ideate` without `--agent` throws a clear "Missing --agent" error (consistent with other commands).
- [ ] Typecheck passes (`bun tsc --noEmit`).

### US-002: Create `ideate` skill (SKILL.md)

**As a** developer, **I want** `.agents/skills/ideate/SKILL.md` to exist with a structured interview guide **so that** the agent can lead a focused ideation conversation and produce actionable ROADMAP.md updates.

**Acceptance Criteria:**
- [ ] `.agents/skills/ideate/SKILL.md` exists with valid YAML front matter (`name`, `description`, `user-invocable`).
- [ ] The skill instructs the agent to read `ROADMAP.md` and `PROJECT_CONTEXT.md` from context (if provided) before starting the interview.
- [ ] The skill follows a one-question-at-a-time interview with at minimum these steps:
  1. Detect context (new project vs. existing project with roadmap).
  2. Ask about motivation / goal for this ideation session.
  3. Ask about target user or use-case niche.
  4. Ask about the key pain point or gap to address.
  5. Ask about desired project format or technical constraints (if a new project).
- [ ] After the interview, the skill instructs the agent to propose 2–4 concrete feature/project ideas with rationale, effort estimate (S/M/L), and differentiation notes.
- [ ] The skill ends by instructing the agent to write or update `ROADMAP.md` with the proposed items marked as new candidates.
- [ ] The skill optionally instructs the agent to flag if `PROJECT_CONTEXT.md` needs updating (e.g. new stack or audience shift).
- [ ] Running `bun nvst ideate --agent ide` does not throw "Skill 'ideate' not found".
- [ ] Typecheck passes.

### US-003: Add ideation scaffold template

**As a** developer using `nvst init` on a new project, **I want** `scaffold/.agents/skills/ideate/tmpl_SKILL.md` to exist **so that** new projects get the ideation skill out of the box.

**Acceptance Criteria:**
- [ ] `scaffold/.agents/skills/ideate/tmpl_SKILL.md` exists and mirrors `.agents/skills/ideate/SKILL.md` (same content, `tmpl_` prefix convention).
- [ ] Running `bun nvst init` on a fresh directory produces `.agents/skills/ideate/SKILL.md` from the template.
- [ ] Typecheck passes.

### US-004: Implement `runIdeate` command handler

**As a** developer, **I want** `src/commands/ideate.ts` to orchestrate the ideation skill **so that** the command reads context files, builds the prompt, and invokes the agent correctly.

**Acceptance Criteria:**
- [ ] `src/commands/ideate.ts` exports `runIdeate(opts: IdeateOptions): Promise<void>`.
- [ ] The handler reads `ROADMAP.md` and `.agents/PROJECT_CONTEXT.md` from the project root (if they exist) and passes their content as context to `buildPrompt`.
- [ ] The handler loads the skill via `loadSkill(projectRoot, "ideate")`.
- [ ] The handler uses `invokeAgent` with `interactive: true`.
- [ ] After successful invocation, `state.phases.define.ideation.status` is set to `"completed"` and `state.last_updated` is refreshed before writing state.
- [ ] If the agent exits with a non-zero code, an Error is thrown.
- [ ] Guardrail: warns (does not hard-block) if `current_phase !== "define"` or `ideation.status === "completed"`, respecting `--force`.
- [ ] Typecheck passes.

### US-005: Add `ideation` field to state schema and `createInitialState`

**As a** developer, **I want** `state.json` to track ideation status **so that** the workflow history reflects whether ideation was done for each iteration.

**Acceptance Criteria:**
- [ ] `src/schemas/tmpl_state.ts` includes an optional `ideation` field inside `definePhase` with `status` enum `["pending", "in_progress", "completed"]` and a nullable `file` field.
- [ ] `src/commands/start-iteration.ts` → `createInitialState` initialises `phases.define.ideation` as `{ status: "pending", file: null }`.
- [ ] Existing iterations without the `ideation` field continue to parse without error (field is optional in Zod schema).
- [ ] `bun nvst start-iteration` followed by `bun nvst ideate --agent ide` does not throw a schema validation error.
- [ ] Typecheck passes.

## Functional Requirements

- FR-1: `src/cli.ts` must import `runIdeate` from `./commands/ideate` and route `ideate [--agent <provider>] [--force]` to it.
- FR-2: `printUsage()` in `cli.ts` must list `ideate --agent <provider>` with a one-line description under the workflow section.
- FR-3: `src/commands/ideate.ts` must pass the following keys to `buildPrompt`: `current_iteration`, `roadmap` (content of `ROADMAP.md` or empty string), `project_context` (content of `.agents/PROJECT_CONTEXT.md` or empty string).
- FR-4: `.agents/skills/ideate/SKILL.md` must instruct the agent to use a strict one-question-at-a-time interview (same UX pattern as `create-pr-document` skill).
- FR-5: `.agents/skills/ideate/SKILL.md` must instruct the agent to propose 2–4 concrete ideas with effort estimates (S/M/L) after the interview.
- FR-6: `.agents/skills/ideate/SKILL.md` must instruct the agent to write proposed items to `ROADMAP.md` as new candidate entries.
- FR-7: `src/schemas/tmpl_state.ts` `definePhase` must include an optional `ideation` object: `{ status: z.enum(["pending", "in_progress", "completed"]), file: z.string().nullable() }`.
- FR-8: `scaffold/.agents/skills/ideate/tmpl_SKILL.md` must mirror the live skill file (same body, `tmpl_` prefix naming only).
- FR-9: No new `npm`/`bun` runtime dependencies may be added.

## Non-Goals (Out of Scope)

- Automatically applying ROADMAP.md or PROJECT_CONTEXT.md changes from within the command handler (the agent/IDE does that after reading the prompt output).
- Adding a hard-blocking guardrail that prevents `nvst define requirement` if ideation was not run (it remains fully optional).
- Creating a new `current_phase` value of `"ideate"` — ideation stays within the `"define"` phase.
- Building a web UI or interactive TUI for the interview (the skill prompt drives it in the AI environment).
- Modifying any command other than `cli.ts`, `start-iteration.ts`, and the new `ideate.ts`.

## Open Questions

- None
