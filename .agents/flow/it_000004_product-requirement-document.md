# Requirement: New CLI Command `execute test-plan`

## Context
The CLI currently lacks a dedicated command to execute the test plan defined during the prototype phase. This requirement introduces `bun nvst execute test-plan` to trigger an automated multi-step loop that runs tests and verifies the implementation, following the same pattern as `create-prototype`.

## Goals
- Register `bun nvst execute test-plan` in the CLI.
- Implement the command as a multi-step loop: iterate over test commands from `TP.json`'s `automatedTests` array, invoke the agent per test, verify results, track pass/fail, and support retries.
- Produce a persistent results file (`test-results.json`) tracking per-test outcomes.

## User Stories

### US-001: Register Command
**As a** developer, **I want** to execute `bun nvst execute test-plan --agent <provider>` **so that** I can start the automated verification phase.

**Acceptance Criteria:**
- [ ] `execute test-plan` is a valid command in the CLI.
- [ ] Command requires `--agent <provider>` flag, consistent with other agent-backed commands.
- [ ] Running `bun nvst execute test-plan` without required args prints usage to stderr.
- [ ] Command exits with an error if `phases.prototype.test_plan.status` in `state.json` is not `"created"`.
- [ ] Command exits with an error if `it_{iteration}_TP.json` does not exist in `.agents/flow/`.
- [ ] Typecheck / lint passes.

### US-002: Automated Test Execution (Multi-Step Loop)
**As a** developer, **I want** the command to iterate over test commands and execute them **so that** each test is independently verified and results are tracked.

**Acceptance Criteria:**
- [ ] Command reads `it_{iteration}_TP.json` from `.agents/flow/` and iterates over the `automatedTests` string array.
- [ ] Before execution starts, command validates that `it_{iteration}_TP.json` exists, parses as valid JSON, and contains a non-empty `automatedTests` array. If validation fails, command prints a human-readable error message to stderr and exits with code 1.
- [ ] For each entry in `automatedTests`, command invokes the agent and records the test command string, raw exit code, and normalized status (`passed`|`failed`) in `it_{iteration}_test-results.json`.
- [ ] Command logs structured output per test: `iteration=it_NNNNNN test_index=N attempt=N outcome=passed|failed`, matching the `create-prototype` logging pattern.
- [ ] Command supports `--iterations` and `--retry-on-fail` flags for retry behavior on failed tests.
- [ ] Command writes a results file (`it_{iteration}_test-results.json`) to `.agents/flow/` tracking per-test outcomes.
- [ ] Each test command execution is subject to a default timeout (60 seconds). If a test exceeds the timeout, it is recorded as `failed`.
- [ ] If `it_{iteration}_test-results.json` already exists, the command overwrites it with fresh results.

## Functional Requirements
- FR-1: Update `src/cli.ts` to include the `execute test-plan` command.
- FR-2: Create `src/commands/execute-test-plan.ts` to handle the command logic.
- FR-3: Invoke the agent via `invokeAgent()` from `src/agent.ts` for each test command in the loop.
- FR-4: Create `.agents/skills/execute-test-plan/SKILL.md` with the prompt template for test execution.

## Non-Goals (Out of Scope)
- Modifying the requirement or project context files.
- Git operations (branching, committing) — test execution does not modify the repository history.
- Modifying production application source code as part of test-plan execution.
- Automatically fixing or modifying source code in response to test failures.

## Open Questions
- None.
