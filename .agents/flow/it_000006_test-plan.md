# Test Plan - Iteration 000006

## Scope

- **Batch Automated Execution**: verification of the new logic to group all automated tests into a single agent invocation.
- **Manual Test Interaction**: verification of the sequential, interactive CLI flow for manual/exploratory tests.
- **Skill Updates**: verification that the `execute-test-case` skill is correctly updated to handle batch inputs and outputs.
- **State & Artifacts**: verification that all existing progress tracking, JSON artifacts, and reports are preserved and compatible.

## Environment and data

- **Runtime**: Bun v1+ environment.
- **Test Data**: A mock `test-plan.json` containing a mix of `automated` (unit/integration) and `manual` (exploratory) test cases.
- **Mocking**: `Bun.spawn` (or equivalent agent invocation) must be mocked to simulate:
    - Successful batch JSON response.
    - Partial batch JSON response.
    - Malformed/Failed agent response.
- **State**: A clean `it_000006_progress.json` and a partially filled one (for resume testing).

## User Story: US-001 - Batch Automated Tests in a Single Agent Session

| Test Case ID | Description | Type (unit/integration/e2e) | Mode (automated/manual) | Correlated Requirements (US-XXX, FR-X) | Expected Result |
|---|---|---|---|---|---|
| TC-001 | Execute all pending automated tests in a single batch. | Unit | Automated | US-001, FR-1, FR-2, FR-4 | The command sends a single prompt containing all automated tests and correctly parses the returned JSON array of results. |
| TC-002 | Handle partial results from the agent (e.g., 5 sent, 3 returned). | Unit | Automated | US-001, FR-4, FR-6 | The 3 returned tests are updated; the missing 2 are marked as failed or retried (depending on logic, usually failed in batch mode). |
| TC-003 | Handle total agent failure (non-zero exit or invalid JSON). | Unit | Automated | US-001, FR-5 | All tests in the batch are marked as `failed` with `invocation_failed` payload. |
| TC-004 | Resume execution: Skip already passed automated tests. | Integration | Automated | US-001, FR-8 | Only tests with status `pending` or `failed` are included in the batch; `passed` tests are ignored. |
| TC-005 | Verify batch prompt structure. | Unit | Automated | US-001, FR-3 | The prompt sent to the agent contains the JSON array of test cases and instructions to return a JSON array. |

## User Story: US-002 - Execute Manual Tests One-by-One with User Interaction

| Test Case ID | Description | Type (unit/integration/e2e) | Mode (automated/manual) | Correlated Requirements (US-XXX, FR-X) | Expected Result |
|---|---|---|---|---|---|
| TC-006 | Sequential presentation of manual tests. | Unit | Automated | US-002, FR-1, FR-6, FR-7 | Manual tests are presented one by one *after* automated tests complete. Input (pass/fail) is correctly recorded. |
| TC-007 | User input validation (status, evidence, notes). | Unit | Automated | US-002, FR-6 | System accepts valid statuses (`passed`, `failed`, `skipped`) and records provided evidence/notes. |
| TC-008 | Resume execution: Skip passed manual tests. | Integration | Automated | US-002, FR-8 | Previously passed manual tests are not presented to the user. |
| TC-009 | Manual UX Sanity Check. | E2E | Manual | US-002, FR-6 | Run the CLI and verify the prompts are readable, clear, and the input flow feels natural (UI/UX nuance). |

## User Story: US-003 - Update Execute-Test-Case Skill for Batch Mode

| Test Case ID | Description | Type (unit/integration/e2e) | Mode (automated/manual) | Correlated Requirements (US-XXX, FR-X) | Expected Result |
|---|---|---|---|---|---|
| TC-010 | Verify `execute-test-case` skill prompt update. | Unit | Automated | US-003, FR-9, FR-3 | The loaded skill content explicitly mentions accepting an *array* of test cases and returning an *array* of results. |

## User Story: US-004 - Preserve Report and State Tracking Compatibility

| Test Case ID | Description | Type (unit/integration/e2e) | Mode (automated/manual) | Correlated Requirements (US-XXX, FR-X) | Expected Result |
|---|---|---|---|---|---|
| TC-011 | Verify progress JSON integrity after batch execution. | Integration | Automated | US-004, FR-8 | `it_XXXXXX_test-execution-progress.json` matches the schema, with correct timestamps and result payloads for all tests. |
| TC-012 | Verify individual artifact generation. | Integration | Automated | US-004, FR-8 | Even in batch mode, individual result files (e.g., `test-results/TC-001.json`) are created for each test case. |
| TC-013 | Verify final report generation. | Integration | Automated | US-004, FR-8 | The generated markdown report correctly summarizes both batch-automated and interactive-manual results. |
