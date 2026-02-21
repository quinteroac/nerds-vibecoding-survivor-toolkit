# Test Plan - Iteration 000005

## Scope

- Validate the `nvst execute test-plan` command end-to-end: precondition checks, sequential test case execution via agent, progress tracking, state transitions, report generation, and artifact persistence
- Verify CLI routing and `--agent <provider>` flag parsing for all supported providers (claude, codex, gemini)
- Verify state schema extensions (`test_execution` field) and state transitions (pending → in_progress → completed/failed)
- Verify progress file creation, per-test updates, and resume behaviour (skip passed tests on re-run)
- Verify summary report (markdown + JSON) generation with correct pass/fail counts and per-test details
- Verify per-test artifact persistence under `.agents/flow/it_{iteration}_test-execution-artifacts/`
- Verify the `execute-test-case` skill exists, contains correct instructions, and is loaded during execution
- Verify robust failure handling for invalid/missing input files, malformed agent outputs, and mid-execution interruptions
- Verify quality gates (typecheck, lint, and command-specific tests) for the `execute test-plan` implementation

## Environment and data

- Runtime: Bun v1+ with `bun:test` runner
- Working directory: project root
- Fixtures: mock `state.json` with `tp_generation.status = "created"` and a valid test plan JSON file; mock `PROJECT_CONTEXT.md`
- Dependencies: all tests use dependency injection (mocked file I/O, agent invocation, skill loading) — no real agent calls required
- File system: tests create temporary directories/files for artifact and progress file assertions; cleanup after each test
- Skills: `.agents/skills/execute-test-case/SKILL.md` must be present
- Mocks: agent responses mocked to simulate pass, fail, malformed output, and invocation error scenarios
- Determinism: use fixed timestamps (clock stub) and stable fixture IDs to assert ordering, `updated_at`, and attempt-count transitions across reruns

## User Story: US-001 - Execute Approved Test Plan

| Test Case ID | Description | Type (unit/integration/e2e) | Mode (automated/manual) | Correlated Requirements (US-XXX, FR-X) | Expected Result |
|---|---|---|---|---|---|
| TC-US001-01 | Command rejects execution when `tp_generation.status` is not `"created"` | unit | automated | US-001, FR-2 | Throws descriptive error and does not invoke agent |
| TC-US001-02 | Command reads the approved test plan JSON from the path in `state.phases.prototype.tp_generation.file` | unit | automated | US-001, FR-3 | Test plan content is loaded and parsed without error |
| TC-US001-03 | Command reads `PROJECT_CONTEXT.md` and includes it in the agent invocation prompt | unit | automated | US-001, FR-3, FR-5 | Project context content appears in the built prompt passed to the agent |
| TC-US001-04 | Command invokes the agent once per test case sequentially | integration | automated | US-001, FR-4, FR-5 | Agent is invoked exactly N times for N test cases, in order |
| TC-US001-05 | Execution order matches the order of test cases in the source TP JSON | unit | automated | US-001, FR-4 | Recorded test IDs in results match TP JSON order |
| TC-US001-06 | Each agent invocation produces a structured result payload with `status`, `evidence`, and `notes` | unit | automated | US-001, FR-6 | Valid payloads are parsed correctly; pass/fail derived from status field |
| TC-US001-07 | Non-zero agent exit code is treated as invocation failure | unit | automated | US-001, FR-6 | Test case is marked as `failed` with error summary referencing exit code |
| TC-US001-08 | Each test case uses exactly one agent invocation with project-context in the prompt | unit | automated | US-001, FR-5 | Agent called once per test; prompt includes project context reference |
| TC-US001-09 | Command accepts `--agent claude`, `--agent codex`, and `--agent gemini` flags | unit | automated | US-001, FR-1 | Each provider value is accepted and forwarded to agent invocation |
| TC-US001-10 | Command rejects invalid or missing `--agent` flag | unit | automated | US-001, FR-1 | Exits with descriptive error for missing or unsupported provider |
| TC-US001-11 | Command follows the existing command pattern: read state, validate, load skill, invoke agent, update progress, update state | integration | automated | US-001, FR-10 | Execution sequence matches the standard NVST command lifecycle |
| TC-US001-12 | Typecheck passes on `execute-test-plan.ts` | unit | automated | US-001, FR-10 | `bun tsc --noEmit` reports no errors for the command file |
| TC-US001-13 | Command fails fast when test plan file path is missing or unreadable | unit | automated | US-001, FR-3 | Throws descriptive file-path error, does not invoke agent, and does not create partial results |
| TC-US001-14 | Command rejects invalid test plan JSON/schema at `tp_generation.file` | unit | automated | US-001, FR-3 | Throws parse/schema validation error with test plan context and does not start execution |
| TC-US001-15 | Behavior when `PROJECT_CONTEXT.md` is missing/unreadable is deterministic and explicit | unit | automated | US-001, FR-3, FR-5 | Either fails with descriptive error before agent invocation or applies documented fallback; assertion matches documented behavior |
| TC-US001-16 | Malformed agent output (non-JSON, truncated JSON, or missing required keys with exit code 0) is treated as test-case failure | integration | automated | US-001, FR-6 | Current test case marked `failed`, `last_error_summary` populated, raw output persisted to artifact, and execution continues to next test case |

## User Story: US-002 - Track Per-Test-Case Progress

| Test Case ID | Description | Type (unit/integration/e2e) | Mode (automated/manual) | Correlated Requirements (US-XXX, FR-X) | Expected Result |
|---|---|---|---|---|---|
| TC-US002-01 | Progress file `it_{iteration}_test-execution-progress.json` is created in `.agents/flow/` on first run | unit | automated | US-002, FR-7 | File exists at the expected path after command starts |
| TC-US002-02 | Each progress entry includes required fields: `id`, `type`, `status`, `attempt_count`, `last_agent_exit_code`, `last_error_summary`, `updated_at` | unit | automated | US-002, FR-7 | All fields are present and match the `TestExecutionProgressEntrySchema` |
| TC-US002-03 | Progress file is updated after each test case execution attempt | integration | automated | US-002, FR-7 | After each agent invocation the progress file on disk reflects the latest result |
| TC-US002-04 | Re-running the command resumes from pending/failed test cases and does not re-execute passed tests | integration | automated | US-002, FR-9 | On second run, agent is invoked only for non-passed test cases |
| TC-US002-05 | Progress file validates against `TestExecutionProgressSchema` via Zod | unit | automated | US-002, FR-7 | Schema parse succeeds on generated progress file content |
| TC-US002-06 | On rerun, previously `passed` entries remain unchanged and are never reinvoked | integration | automated | US-002, FR-9 | `passed` entries keep prior status/attempt_count/updated_at and no agent call occurs for those IDs |
| TC-US002-07 | On rerun, `failed` and `pending` entries are reinvoked in original TP order | integration | automated | US-002, FR-9 | Re-executed IDs and invocation order match source TP ordering among eligible entries |
| TC-US002-08 | `attempt_count` increments exactly once per re-executed test case | integration | automated | US-002, FR-7, FR-9 | For reinvoked entries, `attempt_count` increases by 1; unchanged for skipped `passed` entries |
| TC-US002-09 | `updated_at` changes only for entries executed in the current run | integration | automated | US-002, FR-7, FR-9 | Timestamp updates occur only on reinvoked IDs, with stable values for skipped IDs |

## User Story: US-003 - Update State on Execution

| Test Case ID | Description | Type (unit/integration/e2e) | Mode (automated/manual) | Correlated Requirements (US-XXX, FR-X) | Expected Result |
|---|---|---|---|---|---|
| TC-US003-01 | State schema includes `test_execution` field with `status` and `file` under prototype phase | unit | automated | US-003, FR-10 | Schema accepts `test_execution: { status, file }` and rejects invalid shapes |
| TC-US003-02 | State is set to `in_progress` when execution begins | unit | automated | US-003, FR-10 | After initialisation, `state.phases.prototype.test_execution.status === "in_progress"` |
| TC-US003-03 | State is set to `completed` when all test cases pass | unit | automated | US-003, FR-8 | After all tests pass, state status is `"completed"` |
| TC-US003-04 | State is set to `failed` if any test cases remain in `failed` status after execution | unit | automated | US-003, FR-8 | After execution with failures, state status is `"failed"` |
| TC-US003-05 | State `test_execution.file` points to the progress file path | unit | automated | US-003, FR-7 | `state.phases.prototype.test_execution.file` equals the expected progress file path |
| TC-US003-06 | Mid-execution interruption (for example write failure during progress/report update) does not leave state stuck in `in_progress` | integration | automated | US-003, FR-8, FR-10 | Command terminates with state set to documented terminal status (`failed` expected), not `in_progress` |
| TC-US003-07 | Partial execution recovery preserves file pointer and rerun behavior | integration | automated | US-003, FR-7, FR-8, FR-9 | If progress exists after interruption, `test_execution.file` remains set and rerun resumes deterministically from non-passed entries |

## User Story: US-004 - Generate Test Execution Summary Report

| Test Case ID | Description | Type (unit/integration/e2e) | Mode (automated/manual) | Correlated Requirements (US-XXX, FR-X) | Expected Result |
|---|---|---|---|---|---|
| TC-US004-01 | Summary report file `it_{iteration}_test-execution-report.md` is written to `.agents/flow/` | unit | automated | US-004, FR-8 | File exists at expected path after execution completes |
| TC-US004-02 | Report includes total tests, passed count, failed count, and a per-test-case results table | unit | automated | US-004, FR-8 | Markdown content contains counts and a table with id, description, status, and correlated requirements columns |
| TC-US004-03 | A concise summary line is printed to stdout upon completion | integration | automated | US-004, FR-8 | Captured stdout includes a line matching the pattern `N/M tests passed, K failed` |
| TC-US004-04 | Per-test raw execution artifacts are persisted in `it_{iteration}_test-execution-artifacts/` | unit | automated | US-004, FR-11 | Directory exists and contains one artifact file per executed test case |
| TC-US004-05 | Each artifact file contains full agent output, prompt, and result payload | unit | automated | US-004, FR-11 | Artifact JSON includes `prompt`, `stdout`, `stderr`, and parsed `payload` fields |
| TC-US004-06 | Test case results include references to stored artifact paths | unit | automated | US-004, FR-11 | Each result entry has an `artifactReferences` array with valid file paths |
| TC-US004-07 | Report totals are mathematically consistent with execution results data | unit | automated | US-004, FR-8 | `total = passed + failed` and all counts exactly match computed values from recorded results/progress |
| TC-US004-08 | Report row order is deterministic and traceable to TP ordering | unit | automated | US-004, FR-8 | Result table row sequence matches documented rule (expected: source TP order) |
| TC-US004-09 | Artifact references are referentially correct and ID-aligned | integration | automated | US-004, FR-11 | Every referenced artifact file exists and corresponds to the same test case ID as the result entry |
| TC-US004-10 | Artifact payloads validate against a strict schema (keys and value types) | unit | automated | US-004, FR-11 | Artifact JSON passes schema validation for `prompt`, `stdout`, `stderr`, and `payload` structure/types |

## User Story: US-005 - Create Agent Skill for Test Execution

| Test Case ID | Description | Type (unit/integration/e2e) | Mode (automated/manual) | Correlated Requirements (US-XXX, FR-X) | Expected Result |
|---|---|---|---|---|---|
| TC-US005-01 | Skill file exists at `.agents/skills/execute-test-case/SKILL.md` | unit | automated | US-005, FR-5 | File exists and is non-empty |
| TC-US005-02 | Skill prompt instructs the agent to read the test case, execute it, and report pass/fail with evidence | unit | automated | US-005, FR-5 | Skill markdown contains instructions for reading test definition, executing, and returning `status`, `evidence`, `notes` |
| TC-US005-03 | Skill is loaded and used by the `execute test-plan` command for each test case invocation | integration | automated | US-005, FR-5 | The skill loader is called with `"execute-test-case"` and the resulting body is included in every agent prompt |
| TC-US005-04 | Skill output contract requires strict JSON with `status`, `evidence`, and `notes` fields | unit | automated | US-005, FR-6 | Skill file specifies the exact JSON output schema the agent must return |

## Cross-Story Quality Gates

| Test Case ID | Description | Type (unit/integration/e2e) | Mode (automated/manual) | Correlated Requirements (US-XXX, FR-X) | Expected Result |
|---|---|---|---|---|---|
| TC-QG-01 | Lint passes for the package/scope containing `execute-test-plan` implementation and tests | integration | automated | FR-10 | Configured lint command exits successfully with zero lint errors |
| TC-QG-02 | Targeted test suite for execute-test-plan flow passes | integration | automated | FR-10 | Command-scoped unit/integration tests exit successfully |
| TC-QG-03 | CI-equivalent quality command (if defined by project scripts) passes | integration | automated | FR-10 | Aggregate quality command exits successfully and includes typecheck/lint/tests |
