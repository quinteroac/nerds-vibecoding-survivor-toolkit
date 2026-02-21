# Requirement: Split Test Execution by Mode (Automated Batch vs Manual One-by-One)

## Context
The current test execution logic (`execute-test-plan` command) treats automated and exploratory/manual tests identically — each test case spawns a separate agent session sequentially. This is inefficient for automated tests (which could run as a batch in a single agent session) and inappropriate for manual tests (which require human involvement but currently run non-interactively through an agent).

This iteration refactors the test execution flow so that:
- **Automated tests** are sent as a single batch to one agent session, letting the agent run all of them in sequence within that session.
- **Manual/exploratory tests** are presented to the user one at a time, collecting pass/fail results interactively.

## Goals
- Reduce agent session overhead by batching all automated tests into one invocation.
- Enable proper human-in-the-loop execution for manual/exploratory tests.
- Preserve all existing tracking, artifact generation, progress persistence, and report generation.
- Maintain resume behavior (skip already-passed tests on re-run).

## User Stories

### US-001: Batch Automated Tests in a Single Agent Session
**As a** user running the test plan, **I want** all automated tests to be executed in a single agent session **so that** execution is faster and the agent has full context of all tests.

**Acceptance Criteria:**
- [ ] When the `execute-test-plan` command runs, all automated tests with status != `passed` are collected and sent to a single agent invocation.
- [ ] The agent prompt includes the full list of pending automated test cases (as JSON array) along with the skill body and project context.
- [ ] The agent returns a JSON array of results, one per test case, each with `{testCaseId, status, evidence, notes}`.
- [ ] Each individual test result is recorded in the progress file and as a separate artifact, exactly as today.
- [ ] If the agent session fails (non-zero exit code), all automated tests in the batch are marked as `failed` with an `invocation_failed` payload.
- [ ] If the agent returns partial results (fewer results than tests sent), unmatched tests are marked as `failed`.
- [ ] Resume behavior is preserved: already-passed automated tests are excluded from the batch.
- [ ] Typecheck / lint passes.

### US-002: Execute Manual Tests One-by-One with User Interaction
**As a** user running the test plan, **I want** manual/exploratory tests to be presented to me one at a time **so that** I can perform each test and report the result myself.

**Acceptance Criteria:**
- [ ] After automated tests complete, each pending manual test is presented to the user sequentially.
- [ ] For each manual test, the user sees: test ID, description, correlated requirements, and expected result.
- [ ] The user is prompted to enter: status (`passed`, `failed`, or `skipped`), evidence (what they observed), and notes (optional).
- [ ] Each manual test result is recorded in the progress file and as a separate artifact, consistent with existing format.
- [ ] Resume behavior is preserved: already-passed manual tests are skipped.
- [ ] Typecheck / lint passes.

### US-003: Update Execute-Test-Case Skill for Batch Mode
**As a** developer maintaining the agent skill, **I want** the `execute-test-case` skill to support receiving multiple test cases **so that** it can execute a batch and return an array of results.

**Acceptance Criteria:**
- [ ] The skill prompt (`.agents/skills/execute-test-case/SKILL.md`) is updated to instruct the agent to accept an array of test case definitions.
- [ ] The skill instructs the agent to return a JSON array where each element contains `{testCaseId, status, evidence, notes}`.
- [ ] The skill clearly states the agent must execute each test in order and report individual results.
- [ ] Backward references to single-test-case mode are removed or updated.
- [ ] Typecheck / lint passes.

### US-004: Preserve Report and State Tracking Compatibility
**As a** user, **I want** the test execution report, results JSON, and state transitions to work exactly as before **so that** downstream processes are not broken.

**Acceptance Criteria:**
- [ ] The progress file (`it_{iteration}_test-execution-progress.json`) tracks all tests with correct statuses and attempt counts.
- [ ] Execution artifacts are written per test case per attempt, same directory structure and schema.
- [ ] The markdown report and JSON results files are generated with identical structure.
- [ ] State transitions follow the same rules: `in_progress` during execution, `completed` if all pass, `failed` if any fail.
- [ ] Typecheck / lint passes.

## Functional Requirements
- FR-1: The `execute-test-plan` command must partition the flattened test list into two groups by `mode`: `automated` and `exploratory_manual`.
- FR-2: All pending automated tests must be sent to a single agent invocation as a batch (one prompt, one session).
- FR-3: The batch prompt must include the array of test case definitions and instruct the agent to return a JSON array of results.
- FR-4: The batch agent response must be parsed as a JSON array, matching each result to its test case by `testCaseId`.
- FR-5: If the batch agent invocation fails entirely (non-zero exit or unparseable output), all tests in the batch must be marked `failed`.
- FR-6: Each pending manual test must be presented to the user interactively, one at a time, collecting `status`, `evidence`, and `notes` from stdin.
- FR-7: Manual test execution must occur after all automated tests have been processed.
- FR-8: Progress persistence, artifact writing, resume logic, and report generation must remain functionally identical.
- FR-9: The `execute-test-case` skill must be updated to support batch input/output format.

## Non-Goals (Out of Scope)
- Parallel execution of automated tests across multiple agent sessions.
- Retry logic for failed tests (existing behavior: no auto-retry, just track attempt count).
- Changes to test plan format or schema.
- Changes to the progress file schema (only execution flow changes).
- Adding a UI or web-based interface for manual test execution.

## Open Questions
- Q1: If the agent returns results for some tests but not all in the batch, should we retry the missing ones individually, or just mark them as failed? (Current proposal: mark as failed.)
- Q2: Should there be a configurable batch size limit for automated tests, or always send all in one batch? (Current proposal: always one batch.)
