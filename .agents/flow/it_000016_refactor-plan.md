# Refactor Plan — Iteration 000016

## Refactor Items

### RI-001: Implement `gh` detection and PR creation in `approve prototype`

**Description:** The `approve prototype` command does not implement US-003 or FR-5: it never checks for the `gh` CLI, never runs `gh pr create`, and never prints a skip message when `gh` is unavailable. The flow should, after a successful push, detect `gh` (e.g. via `gh --version` exit code); if available, run `gh pr create --title "feat: prototype it_<iteration>" --body "Prototype for iteration it_<iteration>"`; if unavailable, print a clear skip message to stdout; and if `gh pr create` fails, surface the error as a non-fatal warning and still update `state.json`. This change completes the iteration scope and removes the PROJECT_CONTEXT/PRD violation.

**Rationale:** This is the critical blocker: the current prototype does not meet the approved PRD. Prioritising it first ensures the command is feature-complete before other refinements.

### RI-002: Add unit tests for `gh` behaviour in `approve prototype`

**Description:** Once RI-001 is implemented, add co-located unit tests in `approve-prototype.test.ts` that cover: (1) when `gh` is available and `gh pr create` succeeds, the command runs it with the correct title and body and still updates state; (2) when `gh` is not available, the command prints the skip message and exits with code 0 and still updates state; (3) when `gh pr create` fails (e.g. PR already exists), the command logs a non-fatal warning and still updates state. Use the existing dependency-injection pattern (e.g. `checkGhAvailableFn`, `runGhPrCreateFn`) so tests do not require a real `gh` binary.

**Rationale:** Prevents regressions and documents the intended behaviour for PR creation and skip/warning paths. Quick win after RI-001 because the same deps used for implementation can be mocked in tests.

### RI-003: Set `process.exitCode = 1` on generic commit failure in `approve prototype`

**Description:** In `approve-prototype.ts`, when the commit fails and the failure is not attributed to a pre-commit hook (the branch that throws `Failed to create prototype approval commit: …`), the handler does not set `process.exitCode = 1` before throwing. The CLI top-level catch does set it, so behaviour is correct. For consistency with the pre-commit and push-failure paths in the same file, set `process.exitCode = 1` in that branch before throwing.

**Rationale:** Low-effort consistency improvement; all error exits from the handler then explicitly set exit code, aligning with FR-7 and making the contract clearer for future readers.
