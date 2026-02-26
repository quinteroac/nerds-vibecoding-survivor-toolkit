# Test Plan - Iteration 000010

## Scope

- Validation of the `execute-manual-fix` command implementation and argument parsing.
- Verification of issue filtering logic to correctly identify `manual-fix` items.
- Testing of the interactive session flow, including agent context injection and sequential issue processing.
- Verification of issue status updates (persistence of `closed` or `skipped` states) to the local JSON file.

## Environment and data

- **Runtime:** Bun v1+ environment.
- **Data:** A mock `it_{iteration}_ISSUES.json` file specifically seeded with issues in `manual-fix`, `open`, and `closed` states to verify filtering.
- **Mocks:** A mocked `Agent` class/interface to simulate AI responses and avoid network dependency during automated testing.

## User Story: US-001 - CLI Command & Issue Filtering

| Test Case ID | Description | Type (unit/integration/e2e) | Mode (automated/manual) | Correlated Requirements (US-XXX, FR-X) | Expected Result |
|---|---|---|---|---|---|
| TC-001 | Verify `execute manual-fix` command registration and argument parsing | unit | automated | US-001, FR-1 | Command accepts `--agent` arg; fails gracefully if invalid args provided. |
| TC-002 | Verify filtering of `manual-fix` issues from issue file | unit | automated | US-001, FR-2 | Only issues with status `manual-fix` are loaded; `open` or `closed` issues are ignored. |
| TC-003 | Verify behavior when no matching issues are found | unit | automated | US-001, FR-2 | Command exits cleanly with a "No manual-fix issues found" message. |

## User Story: US-002 - Interactive Guidance Session

| Test Case ID | Description | Type (unit/integration/e2e) | Mode (automated/manual) | Correlated Requirements (US-XXX, FR-X) | Expected Result |
|---|---|---|---|---|---|
| TC-004 | Verify sequential processing loop for multiple issues | integration | automated | US-002, FR-4 | Command iterates through the list of filtered issues one by one. |
| TC-005 | Verify agent is initialized with correct issue context | unit | automated | US-002, FR-3 | The prompt sent to the agent includes the specific issue title and description. |
| TC-006 | Verify interactive chat mechanism (mocked input/output) | integration | automated | US-002, FR-3 | System accepts user input, sends to agent, and displays agent response (mocked). |
| TC-007 | Assess UX of the interactive guidance flow | e2e | manual | US-002 | The interactive session feels natural; prompts are clear; Ctrl+C handles exit gracefully. |

## User Story: US-003 - Issue Status Update

| Test Case ID | Description | Type (unit/integration/e2e) | Mode (automated/manual) | Correlated Requirements (US-XXX, FR-X) | Expected Result |
|---|---|---|---|---|---|
| TC-008 | Verify "Mark as fixed" updates issue status | integration | automated | US-003, FR-2 | Selecting "Fixed" updates the in-memory status to `closed` and writes to file. |
| TC-009 | Verify "Skip" preserves issue status | integration | automated | US-003, FR-2 | Selecting "Skip" leaves the status as `manual-fix` and proceeds to the next issue. |
| TC-010 | Verify file persistence of status changes | integration | automated | US-003, FR-2 | Changes made during the session are correctly saved to `it_{iteration}_ISSUES.json` on disk. |
