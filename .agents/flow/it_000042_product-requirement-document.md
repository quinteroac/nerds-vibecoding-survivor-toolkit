# Requirement: Auto Mode — Chain Prototype Phases

## Context

Currently, after approving a requirement, a developer must manually trigger three consecutive commands:
`nvst create prototype`, `nvst audit prototype`, and `nvst refactor prototype`. Each phase must be
invoked separately and the developer must wait for agent completion before moving to the next step.
This is repetitive and interrupts flow. A new `nvst auto` command will chain all three phases in
sequence automatically, stopping if any phase fails, so the developer can hand off and return to
a fully refactored prototype.

Additionally, `audit prototype` currently does not update `state.json` upon completion, which means
`refactor prototype`'s state guard always sees the audit as "pending". This must be fixed so the
state transitions work correctly both in auto mode and standalone use.

## Goals

- Allow a developer to run the full prototype pipeline (create → audit → refactor) with a single command after requirement approval.
- Enforce that `nvst auto` can only be invoked when the requirement is in `approved` status.
- Respect the existing guardrail system (`flow_guardrail` mode and `--force` flag) for out-of-order invocations.
- Fix `audit prototype` so it updates `state.json` on completion, enabling `refactor prototype` to detect a completed audit.

## User Stories

### US-001: Run full prototype pipeline automatically

**As a** developer, **I want** to run `nvst auto --agent <provider>` **so that** the create, audit, and
refactor prototype phases execute in sequence without requiring manual phase transitions.

**Acceptance Criteria:**
- [ ] `nvst auto --agent <provider>` is a valid command registered in `src/cli.ts`
- [ ] The command sequentially calls `runCreatePrototype`, `runAuditPrototype`, and `runRefactorPrototype` with the given provider
- [ ] If `runCreatePrototype` fails (throws or exits non-zero), execution stops and the error is surfaced — audit and refactor do not run
- [ ] If `runAuditPrototype` fails, execution stops and refactor does not run
- [ ] After all 3 phases complete successfully, the process exits with code 0
- [ ] `--force` and `--yolo` flags are passed through to each sub-command
- [ ] `runAuditPrototype` is invoked with `interactive: false` when called from `runAuto` (agent runs non-interactively, no TTY hand-off)
- [ ] `runCreatePrototype` and `runRefactorPrototype` retain their default interactive behaviour
- [ ] Typecheck / lint passes

### US-002: Enforce requirement-approved guard on `nvst auto`

**As a** developer, **I want** `nvst auto` to fail with a clear error if the requirement has not been approved **so that** auto mode cannot run on an unapproved or missing requirement.

**Acceptance Criteria:**
- [ ] `nvst auto` throws/exits with an error if `state.phases.define.requirement_definition.status !== "approved"`
- [ ] The error message clearly states that the requirement must be approved before running auto mode
- [ ] The guardrail respects the `flow_guardrail` mode in `state.json` (strict = throw, relaxed = warn + confirm)
- [ ] `--force` bypasses the confirmation prompt (warning is still printed)
- [ ] Typecheck / lint passes

### US-003: Fix `audit prototype` state update on completion

**As a** developer, **I want** `audit prototype` to update `state.phases.prototype.prototype_audit.status` to `"completed"` in `state.json` after a successful agent invocation **so that** `refactor prototype` (and auto mode) can detect a completed audit via the existing `refactorAllowed` guard.

**Acceptance Criteria:**
- [ ] After a successful `nvst audit prototype` run, `state.phases.prototype.prototype_audit.status` equals `"completed"` in `.agents/state.json`
- [ ] `state.last_updated` and `state.updated_by` are set after the audit completes
- [ ] `refactor prototype` can be run immediately after `audit prototype` without requiring `--force`
- [ ] The fix does not break the existing `auditAllowed` guard logic
- [ ] Typecheck / lint passes

## Functional Requirements

- FR-1: A new command `auto` is registered at the top level of the Commander program in `src/cli.ts`, accepting `--agent <provider>`, `--force`, and `--yolo` options.
- FR-2: A new handler `runAuto` is implemented in `src/commands/auto.ts` following the existing one-file-per-command convention.
- FR-3: `runAuto` reads state and checks that `state.phases.define.requirement_definition.status === "approved"` before proceeding, using `assertGuardrail`.
- FR-4: `runAuto` sequentially calls `runCreatePrototype`, `runAuditPrototype`, and `runRefactorPrototype`, propagating `provider`, `force`, and `yolo` to each.
- FR-5: Any error thrown by a sub-phase bubbles up and stops the chain; `runAuto` does not swallow errors.
- FR-5b: `AuditPrototypeOptions` gains an optional `interactive` field (default `true`); `runAuditPrototype` passes it to `invokeAgent`. `runAuto` calls `runAuditPrototype` with `interactive: false`; standalone `nvst audit prototype` continues to use `interactive: true`.
- FR-6: `runAuditPrototype` writes `state.phases.prototype.prototype_audit.status = "completed"` and calls `writeState` after a successful agent invocation.
- FR-7: `runAuditPrototype` sets `state.last_updated` and `state.updated_by = "nvst:audit-prototype"` on the state write.

## Non-Goals (Out of Scope)

- `--dry-run` flag or preview mode for `nvst auto`
- Interactive confirmation prompts between phases in auto mode
- A summary report of phases run at the end of `nvst auto`
- Modifying `create prototype` or `refactor prototype` state-update logic (only `audit prototype` is changed)
- Adding `nvst auto` to the `approve prototype` flow or any other workflow step
- CI/CD headless mode (no special non-TTY handling beyond what already exists)

## Open Questions

- None
