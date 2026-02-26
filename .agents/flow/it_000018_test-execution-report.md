# Test Execution Report (Iteration 000018)

- Test Plan: `it_000018_TP.json`
- Total Tests: 20
- Passed: 20
- Failed: 0

| Test ID | Description | Status | Correlated Requirements | Artifacts |
| --- | --- | --- | --- | --- |
| TC-001 | When the phase-transition dirty-tree check detects uncommitted changes, the command invokes confirmFn with the message containing "Working tree has uncommitted changes. Stage and commit them now to proceed? [y/N]". | passed | US-001, FR-3 | `.agents/flow/it_000018_test-execution-artifacts/TC-001_attempt_001.json` |
| TC-002 | When the post-transition dirty-tree check detects uncommitted changes, the command invokes confirmFn with the same prompt message. | passed | US-001, FR-4 | `.agents/flow/it_000018_test-execution-artifacts/TC-002_attempt_001.json` |
| TC-003 | Default confirmFn (or a mock simulating it): trimmed stdin line "y" or "Y" returns true. | passed | US-001, FR-1 | `.agents/flow/it_000018_test-execution-artifacts/TC-003_attempt_001.json` |
| TC-004 | Default confirmFn (or mock): input other than "y"/"Y", or empty line, is treated as No (return false). | passed | US-001, FR-1 | `.agents/flow/it_000018_test-execution-artifacts/TC-004_attempt_001.json` |
| TC-005 | When stdin is not a TTY (or confirmFn simulates non-TTY), confirmFn returns false immediately without waiting for input. | passed | US-001, FR-6 | `.agents/flow/it_000018_test-execution-artifacts/TC-005_attempt_001.json`<br>`.agents/flow/it_000018_test-execution-artifacts/TC-005_attempt_002.json` |
| TC-006 | Codebase does not contain the old hard-error string "Git working tree is dirty. Commit your changes" at the two previous check sites. | passed | US-001, FR-3, FR-4 | `.agents/flow/it_000018_test-execution-artifacts/TC-006_attempt_001.json` |
| TC-007 | Typecheck passes after implementation (`bun tsc --noEmit`). | passed | US-001, FR-1, FR-2 | `.agents/flow/it_000018_test-execution-artifacts/TC-007_attempt_003.json` |
| TC-008 | On confirm (confirmFn returns true), gitAddAndCommitFn is invoked with cwd equal to the project root and message "chore: pre-prototype commit it_&lt;iteration&gt;" where &lt;iteration&gt; is state.current_iteration. | passed | US-002, FR-2, FR-5 | `.agents/flow/it_000018_test-execution-artifacts/TC-008_attempt_001.json` |
| TC-009 | When gitAddAndCommitFn rejects (e.g. pre-commit hook failure), the handler throws an Error whose message starts with "Pre-prototype commit failed:" and includes stderr; process.exitCode is set to 1 by CLI layer. | passed | US-002, FR-3 | `.agents/flow/it_000018_test-execution-artifacts/TC-009_attempt_001.json` |
| TC-010 | After a successful gitAddAndCommitFn resolve, the prototype build continues (no second dirty-tree error); state transition and build flow proceed. | passed | US-002, FR-3, FR-4 | `.agents/flow/it_000018_test-execution-artifacts/TC-010_attempt_001.json` |
| TC-011 | Typecheck passes. | passed | US-002 | `.agents/flow/it_000018_test-execution-artifacts/TC-011_attempt_003.json` |
| TC-012 | On decline (confirmFn returns false), the handler logs the abort message containing "Aborted. Commit or discard your changes and re-run \`bun nvst create prototype\`." and returns without throwing. | passed | US-003, FR-3, FR-4 | `.agents/flow/it_000018_test-execution-artifacts/TC-012_attempt_001.json` |
| TC-013 | On decline, process.exitCode is not set to 1 (clean exit). | passed | US-003 | `.agents/flow/it_000018_test-execution-artifacts/TC-013_attempt_001.json` |
| TC-014 | On decline, no state changes are written to .agents/state.json (state write functions not called, or state file unchanged). | passed | US-003 | `.agents/flow/it_000018_test-execution-artifacts/TC-014_attempt_001.json` |
| TC-015 | Typecheck passes. | passed | US-003 | `.agents/flow/it_000018_test-execution-artifacts/TC-015_attempt_003.json` |
| TC-016 | Confirm path: mock confirmFn returns true; mock gitAddAndCommitFn is called with the correct commit message; no error thrown; build continues (e.g. next step or return value indicates progression). | passed | US-004, FR-3, FR-5 | `.agents/flow/it_000018_test-execution-artifacts/TC-016_attempt_001.json` |
| TC-017 | Decline path: mock confirmFn returns false; gitAddAndCommitFn is never called; handler returns cleanly (no throw). | passed | US-004, FR-3, FR-4 | `.agents/flow/it_000018_test-execution-artifacts/TC-017_attempt_001.json` |
| TC-018 | Git commit failure path: confirmFn returns true; gitAddAndCommitFn rejects with stderr; handler throws an error whose message includes "Pre-prototype commit failed" and stderr. | passed | US-004, FR-3 | `.agents/flow/it_000018_test-execution-artifacts/TC-018_attempt_001.json` |
| TC-019 | All tests in the project pass (`bun test`); existing create-prototype tests that hit the dirty-tree path use an injected confirmFn (e.g. returning false) so they still pass. | passed | US-004, FR-7 | `.agents/flow/it_000018_test-execution-artifacts/TC-019_attempt_003.json` |
| TC-020 | Typecheck passes. | passed | US-004 | `.agents/flow/it_000018_test-execution-artifacts/TC-020_attempt_003.json` |

