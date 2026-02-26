# Test Plan - Iteration 000016

## Scope

- Behaviour of the new command `bun nvst approve prototype`: CLI registration, state validation, guardrail enforcement, git operations (stage, commit, push), optional `gh pr create`, and state update.
- All functional requirements FR-1 through FR-8 and user stories US-001 through US-004.
- Exit code semantics: success (0), failure (exitCode = 1), and the guarantee that `process.exit()` is never called.
- Schema and typecheck: `state.json` structure and TypeScript strict mode remain valid after any code changes.

## Environment and data

- Runtime: Bun v1+; tests run via `bun test` (Bun built-in runner).
- Isolated git repo for integration tests: temporary directory with `git init`, optional `git remote add`, and controllable working tree state (clean vs dirty).
- Optional `gh` CLI: tests that depend on `gh` must either mock subprocess/exit code or be skipped when `gh` is not installed; tests for "gh not available" use a mocked or overridden check.
- Fixtures: `.agents/state.json` with configurable `current_phase`, `phases.prototype.prototype_approved`, and `flow_guardrail`; copies or in-memory state used so real project state is not mutated by tests.
- Test location: `src/commands/approve-prototype.test.ts` for unit/command tests; `tests/` for integration/e2e if needed.

---

## User Story: US-001 - Commit pending changes

| Test Case ID | Description | Type | Mode | Correlated Requirements | Expected Result |
|--------------|-------------|------|------|-------------------------|-----------------|
| TC-US001-01 | CLI routes `approve prototype` to `runApprovePrototype` in `src/commands/approve-prototype.ts` | unit | automated | US-001, FR-1 | Invoking the CLI with `approve prototype` triggers the handler; no other command is invoked. |
| TC-US001-02 | With dirty working tree, command runs `git add -A` and creates a commit with message `feat: approve prototype it_<iteration>` using iteration from state | integration | automated | US-001, US-001-AC01, FR-3 | After run, working tree is clean; latest commit message matches pattern; staged files are committed. |
| TC-US001-03 | With clean working tree, command prints an informative message and does not create an empty commit | integration | automated | US-001, US-001-AC02, FR-3 | Stdout contains an informative message (e.g. no changes to commit); commit count does not increase. |
| TC-US001-04 | When commit fails due to pre-commit hook, error message includes `Pre-commit hook failed:\n` plus hook output | integration | automated | US-001, FR-3 | Thrown error message matches pattern; exitCode set to 1; no state update. |
| TC-US001-05 | Typecheck passes for the codebase (e.g. `bun run tsc --noEmit` or equivalent) | unit | automated | US-001, US-001-AC03 | TypeScript compilation exits with code 0. |

---

## User Story: US-002 - Push the branch to the remote

| Test Case ID | Description | Type | Mode | Correlated Requirements | Expected Result |
|--------------|-------------|------|------|-------------------------|-----------------|
| TC-US002-01 | After a successful commit, command runs `git push -u origin <current-branch>` | integration | automated | US-002, US-002-AC01, FR-4 | Push is invoked with correct branch; remote receives the commit (or mock confirms correct args). |
| TC-US002-02 | When push fails (e.g. no remote), command throws a descriptive error, sets process.exitCode to 1, and does not update state.json | integration | automated | US-002, US-002-AC02, FR-4, FR-7 | Error is thrown; exitCode is 1; `phases.prototype.prototype_approved` remains false. |
| TC-US002-03 | Typecheck passes for the codebase | unit | automated | US-002, US-002-AC03 | TypeScript compilation exits with code 0. |

---

## User Story: US-003 - Create a PR via `gh` CLI (when available)

| Test Case ID | Description | Type | Mode | Correlated Requirements | Expected Result |
|--------------|-------------|------|------|-------------------------|-----------------|
| TC-US003-01 | When `gh` is available, command runs `gh pr create` with title `feat: prototype it_<iteration>` and body referencing iteration | integration | automated | US-003, US-003-AC01, FR-5 | Subprocess or mock shows `gh pr create` called with correct title and body. |
| TC-US003-02 | When `gh` is not available, command prints a clear skip message to stdout and exits with code 0 | unit/integration | automated | US-003, US-003-AC02, FR-5 | Stdout contains skip message (e.g. "gh CLI not found"); exitCode is 0; state is still updated after commit+push. |
| TC-US003-03 | When `gh pr create` fails (e.g. PR already exists), error is surfaced as non-fatal warning and state.json is still updated | integration | automated | US-003, US-003-AC03, FR-5, FR-6 | Warning printed or logged; `prototype_approved` is set to true; exitCode is 0. |
| TC-US003-04 | Typecheck passes for the codebase | unit | automated | US-003, US-003-AC04 | TypeScript compilation exits with code 0. |

---

## User Story: US-004 - Mark prototype as approved in `state.json`

| Test Case ID | Description | Type | Mode | Correlated Requirements | Expected Result |
|--------------|-------------|------|------|-------------------------|-----------------|
| TC-US004-01 | After successful commit and push, state.json is updated: `phases.prototype.prototype_approved` is true and `last_updated` is refreshed | integration | automated | US-004, US-004-AC01, FR-6 | Read state after run; `prototype_approved === true`; `last_updated` is a recent ISO timestamp. |
| TC-US004-02 | When `prototype_approved` is already true, command throws a descriptive error and exits with code 1 | unit/integration | automated | US-004, US-004-AC02, FR-2, FR-7 | Error thrown before any git/gh operations; exitCode 1; state unchanged. |
| TC-US004-03 | When current phase is not "prototype", assertGuardrail blocks execution with a descriptive message | unit | automated | US-004, US-004-AC03, FR-8 | With state `current_phase !== "prototype"`, guardrail blocks (warn/prompt/throw per mode); no commit/push/state update. |
| TC-US004-04 | Handler calls assertGuardrail at the start with correct context | unit | automated | FR-8 | Mock or spy confirms assertGuardrail is invoked before git/state operations. |
| TC-US004-05 | All error paths set process.exitCode = 1 and never call process.exit() | unit/integration | automated | FR-7 | Code review or test: no process.exit() in handler or cli.ts for this command; on thrown error, exitCode is 1. |
| TC-US004-06 | Typecheck passes for the codebase | unit | automated | US-004, US-004-AC04 | TypeScript compilation exits with code 0. |

---

## Checklist (for author/approver)

- [x] Read `it_000016_PRD.json`
- [x] Read `.agents/PROJECT_CONTEXT.md`
- [x] Plan includes **Scope** section with at least one bullet
- [x] Plan includes **Environment and data** section with at least one bullet
- [x] Test cases are grouped by user story
- [x] Every FR-N (FR-1 through FR-8) is covered by automated test cases
- [x] Every test case includes correlated requirement IDs (US-XXX, FR-X)
- [x] Manual tests: none required; all cases are verifiable via state, stdout, exit code, or mocks (no UI/UX nuance)
- [x] File written to `.agents/flow/it_000016_test-plan.md`
