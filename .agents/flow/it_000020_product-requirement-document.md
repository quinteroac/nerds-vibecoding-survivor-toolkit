# Requirement: Fix Automated-Fix Loop and Non-Interactive Refactor Execution

## Context

Two existing commands have behavioral bugs that reduce their usefulness in the NVST CLI workflow:

1. **`nvst execute automated-fix`** stops after processing a single issue by default (`opts.iterations ?? 1`), even when multiple open issues exist. The intended behavior is to process all open issues in a loop until none remain.
2. **`nvst execute refactor`** invokes the agent with `interactive: true`, which causes it to pause for user input mid-execution. This is inconsistent with `nvst create prototype`, which runs non-interactively (`interactive: false`), and breaks unattended automation.

## Goals

- `nvst execute automated-fix` processes all open issues sequentially without requiring an explicit `--iterations` flag.
- `nvst execute refactor` runs fully non-interactively, consistent with `nvst create prototype`.
- Neither command's external interface (flags, state transitions, file outputs) is altered.

## User Stories

### US-001: Automated-Fix Processes All Open Issues by Default

**As a** developer running `nvst execute automated-fix`, **I want** the command to process every open issue in sequence **so that** I do not have to re-run the command multiple times or pass `--iterations` to fix all issues.

**Acceptance Criteria:**
- [ ] When `--iterations` is not provided, `runExecuteAutomatedFix` processes all open issues (equivalent to `--iterations <count of open issues>`).
- [ ] When `--iterations N` is provided, only up to N open issues are processed (existing behavior preserved).
- [ ] Issues are still processed in sorted order by ID.
- [ ] The summary log line (`Summary: Fixed=X Failed=Y`) correctly reflects the total across all processed issues.
- [ ] The command exits cleanly when there are no open issues (`"No open issues to process. Exiting without changes."`).
- [ ] Typecheck / lint passes.

### US-002: Execute Refactor Runs Non-Interactively

**As a** developer running `nvst execute refactor`, **I want** the agent to be invoked without interactive mode **so that** the command completes autonomously without waiting for user input, consistent with how `nvst create prototype` works.

**Acceptance Criteria:**
- [ ] The `invokeAgentFn` call inside `runExecuteRefactor` passes `interactive: false`.
- [ ] The command still processes each refactor item in order and records results in the progress file.
- [ ] State transitions (`in_progress` → `completed` on success, `in_progress` on partial failure) remain unchanged.
- [ ] The refactor execution report is still generated after all items are processed.
- [ ] Typecheck / lint passes.

## Functional Requirements

- FR-1: In `src/commands/execute-automated-fix.ts`, change `const maxIssuesToProcess = opts.iterations ?? 1` to `const maxIssuesToProcess = opts.iterations ?? openIssues.length`, so that by default all open issues are processed.
- FR-2: In `src/commands/execute-refactor.ts`, change `interactive: true` to `interactive: false` in the `invokeAgentFn` call (line ~257).
- FR-3: No new flags, options, or dependencies are introduced by either fix.
- FR-4: Existing unit tests must continue to pass; new or updated tests must cover the changed default behavior of FR-1.

## Non-Goals (Out of Scope)

- Changing the `--iterations` flag's behavior when explicitly supplied.
- Modifying `execute-manual-fix` or any other command.
- Adding retry logic, concurrency, or progress persistence beyond what already exists.
- Any UI or output format changes beyond what is strictly required by the fixes.

## Open Questions

- None.
