# Requirement: Implement Refactor Prototype Command

## Context

The NVST workflow includes a Refactor phase (`nvst refactor prototype`) that is currently a stub. After running `nvst audit prototype`, the user has an audit artifact (`it_{iteration}_audit.md` and optionally `it_{iteration}_audit.json`) containing a refactor plan. This requirement implements the full refactor flow: the CLI spawns a single agent that reads the refactor plan and applies the necessary code changes, then reports when the refactor is finished.

**Execution pattern and scope:** The command must follow the same skill-based pattern as other agent-backed commands (`audit-prototype`, `create-prototype`): a CLI handler in `src/commands/` reads state, applies a flow guardrail, loads the skill from `.agents/skills/refactor-prototype/`, builds the prompt (injecting iteration and the path to the audit JSON artifact), and invokes the agent via `src/agent.ts`. Implementation must update both the runtime layout (`.agents/skills/refactor-prototype/SKILL.md`) and the project template (`scaffold/.agents/skills/refactor-prototype/tmpl_SKILL.md`) so that new projects created with `nvst init` exhibit the same refactor behaviour.

## Goals

- Enable the user to run `nvst refactor prototype` only after `nvst audit prototype` has been completed, ensuring the refactor is grounded in a validated audit artifact.
- Spawn a single agent invocation that reads the refactor plan from `it_{iteration}_audit.json` and applies code changes end-to-end.
- Persist a completion report in `.agents/flow/` once the agent signals that the refactor is done.
- Keep runtime skills and scaffold templates in sync so both existing and newly scaffolded projects benefit from the full refactor behaviour.

## User Stories

Each story is scoped to be implementable in one focused session.

### US-001: State guard — command only runs after audit is complete

**As a** developer running the NVST CLI, **I want** `nvst refactor prototype` to refuse to run if the audit phase has not been completed for the current iteration **so that** the refactor always has a valid audit artifact to work from.

**Acceptance Criteria:**
- [ ] The command reads `state.json` and checks that `phases.prototype.prototype_audit.status` is not `"pending"` (i.e. audit was run for this iteration).
- [ ] If the guard fails, the command prints a descriptive error message (e.g. _"Cannot refactor prototype: audit prototype must be run for this iteration first."_) and exits with a non-zero code (via `process.exitCode`, never `process.exit()`).
- [ ] The guard respects the `--force` flag and `flow_guardrail` mode via `assertGuardrail` (same pattern as `audit-prototype.ts`).
- [ ] Typecheck / lint passes.

### US-002: Load audit JSON artifact and invoke agent

**As a** developer running the NVST CLI, **I want** the command to load the refactor plan from `it_{iteration}_audit.json` and pass it to the agent via the skill prompt **so that** the agent has all the context needed to perform the refactor.

**Acceptance Criteria:**
- [ ] The command loads `it_{iteration}_audit.json` from `.agents/flow/` (where `{iteration}` = `state.current_iteration`).
- [ ] The skill prompt receives at minimum: `iteration` and the path to `it_{iteration}_audit.json` (injected as template variables via `buildPrompt`).
- [ ] The skill `SKILL.md` instructs the agent to read the audit JSON, understand the refactor plan, and apply the code changes.
- [ ] The command invokes the agent via `invokeAgent` from `src/agent.ts` with `interactive: true`.
- [ ] Typecheck / lint passes.

### US-003: Single agent performs the refactor

**As a** developer running the NVST CLI, **I want** one agent invocation to carry out the entire refactor **so that** I do not have to orchestrate multiple steps manually.

**Acceptance Criteria:**
- [ ] The `SKILL.md` for `refactor-prototype` instructs the agent to read the refactor plan, apply all recommended code changes, run the quality checks defined in the plan, and report completion.
- [ ] The skill does not exit mid-way to ask the user questions; it performs the full refactor autonomously in one session.
- [ ] If the agent exits with a non-zero code, the command throws an `Error` with a descriptive message (same pattern as `audit-prototype.ts`).
- [ ] Typecheck / lint passes.

### US-004: Completion report artifact in `.agents/flow/`

**As a** developer running the NVST CLI, **I want** the command to produce a completion indicator in `.agents/flow/` after the agent finishes **so that** I can verify the refactor happened and downstream steps can detect it.

**Acceptance Criteria:**
- [ ] The `SKILL.md` instructs the agent to write a file `it_{iteration}_refactor-report.md` in `.agents/flow/` upon completion. The file must contain at minimum: a summary of changes made, quality checks performed, and any deviations from the original refactor plan.
- [ ] The mandatory sections in `it_{iteration}_refactor-report.md` are: **Summary of changes**, **Quality checks**, **Deviations from refactor plan** (can be "None").
- [ ] Typecheck / lint passes.

### US-005: Runtime skill and scaffold template updated

**As a** developer scaffolding a new NVST project, **I want** the `refactor-prototype` skill to be available in both the runtime directory and the scaffold template **so that** projects initialised with `nvst init` have the full refactor behaviour out of the box.

**Acceptance Criteria:**
- [ ] `.agents/skills/refactor-prototype/SKILL.md` is replaced with the full implementation (no longer a placeholder).
- [ ] `scaffold/.agents/skills/refactor-prototype/tmpl_SKILL.md` is updated to match the runtime skill (no longer a placeholder).
- [ ] Both files are identical in content (modulo any template-variable syntax that applies only to the scaffold copy).
- [ ] Typecheck / lint passes.

## Functional Requirements

- **FR-1:** `nvst refactor prototype` must only run when `state.phases.prototype.prototype_audit.status` is not `"pending"` for the current iteration. It must call `assertGuardrail` with an appropriate message and respect `--force` and `flow_guardrail` mode.
- **FR-2:** The command must resolve the path `<projectRoot>/.agents/flow/it_{iteration}_audit.json` and pass it as a template variable (`auditFile` or equivalent) to `buildPrompt`.
- **FR-3:** The command must load the skill from `.agents/skills/refactor-prototype/` via `loadSkill`, build the prompt via `buildPrompt`, and invoke the agent via `invokeAgent` with `interactive: true` — exactly the same pattern as `audit-prototype.ts`.
- **FR-4:** The `refactor-prototype` SKILL.md must instruct the agent to: (a) read `it_{iteration}_audit.json`, (b) apply all refactor plan items to the codebase, (c) run quality checks (typecheck at minimum), and (d) write `it_{iteration}_refactor-report.md` with the mandatory sections.
- **FR-5:** If `invokeAgent` returns a non-zero exit code, the command must throw `new Error(...)` with a descriptive message.
- **FR-6:** Both the runtime skill (`.agents/skills/refactor-prototype/SKILL.md`) and the scaffold template (`scaffold/.agents/skills/refactor-prototype/tmpl_SKILL.md`) must be updated from placeholder to full implementation.

## Non-Goals (Out of Scope)

- Implementing interactive Q&A during the refactor: the agent performs the entire refactor in one session without pausing to ask the user.
- Modifying the PRD or audit artifact during the refactor; those are read-only inputs.
- Updating `state.json` from within the skill itself (state transitions are handled by CLI commands, not by agent skills directly).
- Supporting refactor without a completed audit phase — this is blocked by FR-1.
- Auto-generating `it_{iteration}_audit.json` if it does not exist; the audit phase is responsible for that file.

## Open Questions

- None
