# Requirement: `nvst flow` — Automated Iteration Flow Orchestrator

## Context
Running an NVST iteration today requires a developer to manually invoke each step in sequence (`define requirement` → `approve requirement` → `create test-plan` → `approve test-plan` → `create prototype` → …). This is error-prone and slow. A single `nvst flow` command should inspect the current `state.json`, determine the next pending step, execute it, and keep chaining steps automatically until the iteration is complete or a human decision is required (approval / missing required param).

**Assumed pre-condition:** All existing command handlers are callable as pure functions that return or throw rather than calling `process.exit()` directly. Any handler that does call `process.exit()` must be refactored before this command can safely delegate to it.

## Goals
- Allow a developer to run an entire iteration workflow with a single repeated command (or in one shot if no approvals are needed).
- Eliminate the need to remember which command comes next after each step.
- Pause gracefully when human input is required (approval gates or missing `--agent`), and guide the user on what to do.

## User Stories

### US-001: Auto-detect and execute the next step
**As a** developer using the NVST CLI, **I want** to run `nvst flow` and have it automatically detect the current iteration state and invoke the correct next command **so that** I don't have to remember or manually trigger each step.

**Acceptance Criteria:**
- [ ] Running `nvst flow` reads `.agents/state.json` and identifies the next pending step based on phase and status fields.
- [ ] The command delegates to the appropriate existing handler (e.g. `define requirement`, `create prototype`, `execute test-plan`, etc.).
- [ ] After each delegated step completes successfully, `nvst flow` re-reads state and automatically proceeds to the next step.
- [ ] The command continues chaining steps until it reaches an approval gate or the iteration is complete.
- [ ] If `--agent` is not provided and the next step requires it, the command prints `"Enter agent provider:"` and waits for stdin input before proceeding.
- [ ] The `flow_guardrail` setting from `state.json` is respected (same behaviour as other commands).
- [ ] If a delegated sub-command throws an error, `nvst flow` stops immediately, prints the error to stderr, and exits with a non-zero code. No subsequent steps are attempted.
- [ ] If a step is found with status `in_progress` on startup, `nvst flow` treats it as the next pending step and re-executes it (same as `pending`).
- [ ] No delegated handler calls `process.exit()` directly; verified by code review before merge.
- [ ] Typecheck / lint passes.

### US-002: Pause at approval gates with a clear message
**As a** developer, **I want** `nvst flow` to stop and print a descriptive message whenever the next step is an approval that requires my decision **so that** I know exactly what action to take before re-running `nvst flow`.

**Acceptance Criteria:**
- [ ] When the next step is an approval (`approve requirement`, `approve test-plan`, `approve prototype`, `approve refactor-plan`), the command prints a message such as: `"Waiting for approval. Run: nvst approve <step> to continue, then re-run nvst flow."` and exits with code 0.
- [ ] The message identifies the exact `nvst` command the user must run.
- [ ] After the user performs the approval and re-runs `nvst flow`, execution resumes from the correct next step.
- [ ] Typecheck / lint passes.

### US-003: Completion message when the iteration is finished
**As a** developer, **I want** `nvst flow` to print a clear "iteration complete" message when there are no more steps to execute **so that** I know the entire workflow is done.

**Acceptance Criteria:**
- [ ] When all phases and steps are in a terminal state (completed / approved), the command prints a summary such as: `"Iteration 000019 complete. All phases finished."` and exits with code 0.
- [ ] No further steps are attempted.
- [ ] Typecheck / lint passes.

## Functional Requirements
- FR-1: `nvst flow` is a new top-level CLI command registered in `src/cli.ts` and implemented in `src/commands/flow.ts`.
- FR-2: The step resolution order must match the order of keys as they appear in `state.json`. The implementation must not maintain a separate hard-coded list independent of the state structure; FR-3 and FR-4 below are the authoritative definition of that order.
- FR-3: The step-resolution logic must follow the canonical phase order: `define` phase fully complete → `prototype` phase → `refactor` phase.
- FR-4: Within each phase, steps are resolved in the order they appear in `state.json`: `requirement_definition` → `prd_generation` in define; `test_plan` → `tp_generation` → `prototype_build` → `test_execution` → `prototype_approved` in prototype; `evaluation_report` → `refactor_plan` → `refactor_execution` → `changelog` in refactor. Note: `prototype_approved` is a boolean field, not a status object. The resolver must treat `false` as "pending approval" and `true` as "approved", distinct from the status-object pattern used by all other steps.
- FR-5: If `--agent <provider>` is required by a sub-command and not supplied, the command must prompt the user interactively (stdin readline) and then pass the value through.
- FR-6: Existing command handlers must be called programmatically (function call), not via `Bun.spawn` / shell, to avoid double-parsing overhead and preserve the process exit-code contract.
- FR-7: Errors thrown by sub-commands must propagate and be caught by the top-level `cli.ts` error handler (consistent with all other commands).

## Non-Goals (Out of Scope)
- Parallelising steps — steps always execute sequentially.
- Modifying the behaviour of individual commands (they remain unchanged).
- Adding a `--dry-run` or `--plan` flag (not requested for this iteration).
- Forwarding `--force` or other optional flags to sub-commands (not requested for this iteration).
- Supporting multiple iterations in a single invocation.
- Automatically initialising a new iteration once the current one is complete.
- Concurrent execution safety / file locking on `state.json`.
- Handling a missing or malformed `state.json` (the command may exit with an error; recovery is out of scope).
- Any web UI or non-CLI interface.

## Open Questions
- None — all requirements are clear from the interview.
