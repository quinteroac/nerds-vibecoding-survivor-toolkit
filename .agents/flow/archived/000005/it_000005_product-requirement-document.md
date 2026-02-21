# Requirement: Execute Test Plan Command

## Context
The `nvst` CLI currently supports creating, refining, and approving test plans, but lacks a command to actually execute them. Once a test plan is approved and its structured JSON is generated, there is no automated way to run the tests (both automated and exploratory/manual) through an agent. This gap forces users to manually coordinate test execution outside the toolkit workflow, breaking the iterative cycle.

## Goals
- Provide an `nvst execute test-plan` command that runs all tests from an approved test plan via an agent
- Execute tests one by one, updating each test case's status (pass/fail) in a progress/results file
- Generate a summary report with pass/fail counts and details upon completion
- Follow the existing command patterns (skill invocation, progress tracking, state management)
- Support all agent providers (claude, codex, gemini)

## User Stories

### US-001: Execute Approved Test Plan
**As a** developer using the CLI, **I want** to run `nvst execute test-plan --agent <provider>` **so that** the agent executes all test cases from the approved test plan and I can track their results.

**Acceptance Criteria:**
- [ ] Command fails with a descriptive error if the test plan has not been approved (i.e., `tp_generation.status` is not `"created"`)
- [ ] Command reads the approved test plan JSON from the path in `state.phases.prototype.tp_generation.file`
- [ ] Command reads the project context to follow project-specific execution constraints (test runner, environment, quality checks)
- [ ] Command invokes the agent for each test case (automated and exploratory/manual) one by one
- [ ] Execution order is verifiable: recorded executed test IDs match the source TP JSON order
- [ ] Each test case execution attempt produces a structured result payload containing `status`, `evidence`, and `notes`; pass/fail is derived from payload status, while non-zero agent exit code is treated as invocation failure
- [ ] Each test case execution attempt uses exactly one agent invocation and includes project-context reference in the invocation input
- [ ] Command accepts `--agent <provider>` flag supporting `claude`, `codex`, and `gemini`
- [ ] Typecheck / lint passes

### US-002: Track Per-Test-Case Progress
**As a** developer, **I want** each test case's execution status to be persisted to a progress file **so that** I can resume or review test execution at any time.

**Acceptance Criteria:**
- [ ] A progress file `it_{iteration}_test-execution-progress.json` is created/updated in `.agents/flow/`
- [ ] Each test case entry includes: `id`, `type` (automated | exploratory_manual), `status` (pending | in_progress | passed | failed), `attempt_count`, `last_agent_exit_code`, `last_error_summary`, `updated_at`
- [ ] Progress file is updated after each test case execution attempt
- [ ] If the command is re-run, it resumes from pending/failed test cases (does not re-execute passed tests)
- [ ] Typecheck / lint passes

### US-003: Update State on Execution
**As a** developer, **I want** `state.json` to reflect the test execution status **so that** the workflow state is consistent with the rest of the CLI.

**Acceptance Criteria:**
- [ ] A new `test_execution` field is added to the prototype phase in the state schema with `status` (`pending` | `in_progress` | `completed` | `failed`) and `file` (path to progress file)
- [ ] State is set to `in_progress` when execution begins
- [ ] State is set to `completed` when all test cases pass
- [ ] State is set to `failed` if any test cases remain in `failed` status after execution completes
- [ ] Typecheck / lint passes

### US-004: Generate Test Execution Summary Report
**As a** developer, **I want** a summary report printed to the console and saved to a file after execution completes **so that** I can quickly assess the test results.

**Acceptance Criteria:**
- [ ] A summary report file `it_{iteration}_test-execution-report.md` is written to `.agents/flow/`
- [ ] Report includes: total tests, passed count, failed count, and a table with per-test-case results (id, description, status, correlated requirements)
- [ ] A concise summary is printed to stdout upon completion (e.g., "12/15 tests passed, 3 failed")
- [ ] Per-test raw execution artifacts are persisted in `.agents/flow/it_{iteration}_test-execution-artifacts/` and each test case result includes references to its stored artifacts
- [ ] Typecheck / lint passes

### US-005: Create Agent Skill for Test Execution
**As a** developer, **I want** a dedicated skill prompt that guides the agent to execute a single test case **so that** the agent has clear instructions for running and verifying each test.

**Acceptance Criteria:**
- [ ] A new skill `execute-test-case` is created in `.agents/skills/execute-test-case/SKILL.md`
- [ ] The skill prompt instructs the agent to: read the test case definition, execute it following project context constraints, report pass/fail with details
- [ ] The skill is loaded and used by the `execute test-plan` command for each test case invocation
- [ ] Typecheck / lint passes

## Functional Requirements
- FR-1: The command signature is `nvst execute test-plan --agent <provider>` where provider is `claude | codex | gemini`
- FR-2: The command validates that `tp_generation.status === "created"` before proceeding; otherwise exits with an error
- FR-3: The command reads the approved TP JSON file and the project context file to build the execution context
- FR-4: Automated tests and exploratory/manual tests are executed sequentially, one by one, following the order in the TP JSON
- FR-5: For each test case, the command loads the `execute-test-case` skill, builds a prompt with test case details and project context, and invokes the agent
- FR-6: After each test case, the command parses a structured result payload (`status`, `evidence`, `notes`) to determine pass/fail, and treats non-zero agent exit code as invocation failure
- FR-7: The progress file follows the schema `test-execution-progress` and is validated via `write-json`
- FR-8: On completion, a markdown summary report is generated with total, passed, and failed counts, and the state is updated to `completed` or `failed`
- FR-9: Re-running the command skips test cases already marked as `passed` and retries `pending` or `failed` ones
- FR-10: The command follows the existing command implementation pattern: read state, validate preconditions, load skill, invoke agent per item, update progress, update state
- FR-11: The command persists per-test raw execution artifacts under `.agents/flow/it_{iteration}_test-execution-artifacts/` and stores artifact references in execution results

## Non-Goals (Out of Scope)
- Parallel test execution (tests run sequentially)
- Integration with specific test frameworks (the agent interprets and runs tests based on project context)
- Retry limits or configurable retry counts (can be added in a future iteration)
- UI or dashboard for test results
- Automatic fix of failing tests
- `--dry-run` flag for previewing execution
- `--stop-on-fail` flag for halting execution on the first failure
