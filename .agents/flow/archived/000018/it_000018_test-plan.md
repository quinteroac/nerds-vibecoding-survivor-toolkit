# Test Plan - Iteration 000018

## Scope

- Interactive dirty-tree flow in `runCreatePrototype`: prompt on uncommitted changes instead of throwing, optional auto-commit on confirm, clean exit on decline.
- New dependency-injection fields `confirmFn` and `gitAddAndCommitFn` on `CreatePrototypeDeps`, their default behaviour and non-interactive (non-TTY) handling.
- Unit and integration coverage for confirm path, decline path, and git commit failure path; typecheck and existing test suite remain passing.

## Environment and data

- Runtime: Bun (v1+); tests executed with `bun test`; typecheck with `bun tsc --noEmit`.
- Unit tests use mocks for `confirmFn`, `gitAddAndCommitFn`, and (where needed) state I/O; integration tests may use a temporary git repo with uncommitted changes.
- Test files: co-located `src/commands/create-prototype.test.ts` (or equivalent) for unit/command tests; `tests/**/*.test.ts` for workflow/integration if needed.
- No external services required; git must be available for integration tests that run real `git add` / `git commit`.

---

## User Story: US-001 - Prompt on dirty working tree instead of throwing

| Test Case ID | Description | Type (unit/integration/e2e) | Mode (automated/manual) | Correlated Requirements (US-XXX, FR-X) | Expected Result |
|---|---|---|---|---|---|
| TC-001 | When the phase-transition dirty-tree check detects uncommitted changes, the command invokes confirmFn with the message containing "Working tree has uncommitted changes. Stage and commit them now to proceed? [y/N]". | unit | automated | US-001, FR-3 | confirmFn is called with the expected prompt string; no hard error is thrown before the prompt. |
| TC-002 | When the post-transition dirty-tree check detects uncommitted changes, the command invokes confirmFn with the same prompt message. | unit | automated | US-001, FR-4 | confirmFn is called with the expected prompt; no hard error is thrown before the prompt. |
| TC-003 | Default confirmFn (or a mock simulating it): trimmed stdin line "y" or "Y" returns true. | unit | automated | US-001, FR-1 | confirmFn returns true for "y" and "Y"; caller proceeds to commit flow. |
| TC-004 | Default confirmFn (or mock): input other than "y"/"Y", or empty line, is treated as No (return false). | unit | automated | US-001, FR-1 | confirmFn returns false; caller performs decline path (abort message, no commit). |
| TC-005 | When stdin is not a TTY (or confirmFn simulates non-TTY), confirmFn returns false immediately without waiting for input. | unit | automated | US-001, FR-6 | No hang; false returned so non-interactive/piped runs default to decline. |
| TC-006 | Codebase does not contain the old hard-error string "Git working tree is dirty. Commit your changes" at the two previous check sites. | unit | automated | US-001, FR-3, FR-4 | Grep or static assertion: message removed from phase-transition and post-transition blocks. |
| TC-007 | Typecheck passes after implementation (`bun tsc --noEmit`). | unit | automated | US-001, FR-1, FR-2 | Exit code 0; no type errors. |

---

## User Story: US-002 - Auto-commit on confirmation

| Test Case ID | Description | Type (unit/integration/e2e) | Mode (automated/manual) | Correlated Requirements (US-XXX, FR-X) | Expected Result |
|---|---|---|---|---|---|
| TC-008 | On confirm (confirmFn returns true), gitAddAndCommitFn is invoked with cwd equal to the project root and message "chore: pre-prototype commit it_&lt;iteration&gt;" where &lt;iteration&gt; is state.current_iteration. | unit | automated | US-002, FR-2, FR-5 | gitAddAndCommitFn called once with correct cwd and message format. |
| TC-009 | When gitAddAndCommitFn rejects (e.g. pre-commit hook failure), the handler throws an Error whose message starts with "Pre-prototype commit failed:" and includes stderr; process.exitCode is set to 1 by CLI layer. | unit | automated | US-002, FR-3 | Descriptive error thrown; no further build steps run; exit code 1. |
| TC-010 | After a successful gitAddAndCommitFn resolve, the prototype build continues (no second dirty-tree error); state transition and build flow proceed. | unit | automated | US-002, FR-3, FR-4 | With mocks: after confirm and successful commit, build logic is invoked (e.g. no early return). |
| TC-011 | Typecheck passes. | unit | automated | US-002 | Exit code 0 from `bun tsc --noEmit`. |

---

## User Story: US-003 - Clean exit on decline

| Test Case ID | Description | Type (unit/integration/e2e) | Mode (automated/manual) | Correlated Requirements (US-XXX, FR-X) | Expected Result |
|---|---|---|---|---|---|
| TC-012 | On decline (confirmFn returns false), the handler logs the abort message containing "Aborted. Commit or discard your changes and re-run \`bun nvst create prototype\`." and returns without throwing. | unit | automated | US-003, FR-3, FR-4 | No throw; console/log or write stream receives the expected message. |
| TC-013 | On decline, process.exitCode is not set to 1 (clean exit). | unit | automated | US-003 | When run via test harness that simulates decline, exitCode remains 0 (or unchanged to 1). |
| TC-014 | On decline, no state changes are written to .agents/state.json (state write functions not called, or state file unchanged). | unit | automated | US-003 | Mock or read state file before/after; content unchanged after decline path. |
| TC-015 | Typecheck passes. | unit | automated | US-003 | Exit code 0 from `bun tsc --noEmit`. |

---

## User Story: US-004 - Unit tests for confirm and decline branches

| Test Case ID | Description | Type (unit/integration/e2e) | Mode (automated/manual) | Correlated Requirements (US-XXX, FR-X) | Expected Result |
|---|---|---|---|---|---|
| TC-016 | Confirm path: mock confirmFn returns true; mock gitAddAndCommitFn is called with the correct commit message; no error thrown; build continues (e.g. next step or return value indicates progression). | unit | automated | US-004, FR-3, FR-5 | gitAddAndCommitFn called with "chore: pre-prototype commit it_&lt;iteration&gt;"; test passes. |
| TC-017 | Decline path: mock confirmFn returns false; gitAddAndCommitFn is never called; handler returns cleanly (no throw). | unit | automated | US-004, FR-3, FR-4 | gitAddAndCommitFn call count 0; no exception; test passes. |
| TC-018 | Git commit failure path: confirmFn returns true; gitAddAndCommitFn rejects with stderr; handler throws an error whose message includes "Pre-prototype commit failed" and stderr. | unit | automated | US-004, FR-3 | Error thrown with expected message; test passes. |
| TC-019 | All tests in the project pass (`bun test`); existing create-prototype tests that hit the dirty-tree path use an injected confirmFn (e.g. returning false) so they still pass. | unit | automated | US-004, FR-7 | Full `bun test` exits with code 0; no regressions. |
| TC-020 | Typecheck passes. | unit | automated | US-004 | Exit code 0 from `bun tsc --noEmit`. |
