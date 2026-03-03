# Test Plan - Iteration 000020

## Scope

- `runExecuteAutomatedFix` default behavior change: when `--iterations` is omitted, all open issues are processed instead of only 1 (FR-1).
- `runExecuteRefactor` mode change: agent is invoked with `interactive: false` instead of `interactive: true` (FR-2).
- Verification that no new flags, options, or dependencies are introduced by either change (FR-3).
- Verification that all pre-existing unit tests continue to pass and that new or updated tests cover the changed default behavior (FR-4).

## Environment and data

- Runtime: Bun v1+ with `bun:test` runner.
- TypeScript: strict mode; type checking via `bun tsc --noEmit` (or equivalent).
- Test files: `src/commands/execute-automated-fix.test.ts` and `src/commands/execute-refactor.test.ts` (co-located with source per project convention).
- Fixtures: temporary directories created with `mkdtemp`; seeded with `writeState` and inline issues/refactor-PRD files; cleaned up in `afterEach`.
- No external services required; all agent and commit calls are replaced by injectable test doubles (dependency injection via the `deps` parameter).
- Command run with: `bun test src/commands/execute-automated-fix.test.ts` and `bun test src/commands/execute-refactor.test.ts`.

---

## User Story: US-001 - Automated-Fix Processes All Open Issues by Default

| Test Case ID | Description | Type | Mode | Correlated Requirements | Expected Result |
|---|---|---|---|---|---|
| TC-001 | When `--iterations` is **not** provided, `runExecuteAutomatedFix` processes **all** open issues (e.g., 3 open issues → 3 agent invocations, all marked `fixed`) | unit | automated | US-001, US-001-AC01, FR-1, FR-4 | `invokeAgentFn` is called 3 times; all open issues end up with status `fixed`; summary log reads `Summary: Fixed=3 Failed=0` |
| TC-002 | Update existing test "defaults --iterations to 1…" to reflect the new default: no `--iterations` → all open issues processed, not just 1 | unit | automated | US-001, US-001-AC01, FR-1, FR-4 | The updated test asserts `invokeCount` equals the total number of open issues (not 1); remaining issues are all `fixed`, not `open` |
| TC-003 | When `--iterations N` is provided, only up to N open issues are processed (existing explicit-flag behavior preserved) | unit | automated | US-001, US-001-AC02, FR-1, FR-3 | With 3 open issues and `iterations: 2`, `invokeAgentFn` is called exactly 2 times; 3rd issue stays `open` |
| TC-004 | Issues are processed in sorted order by ID regardless of their order in the file | unit | automated | US-001, US-001-AC03, FR-1 | Given issues with IDs `ISSUE-002`, `ISSUE-001`, `ISSUE-003` (all open), prompts arrive in the order `ISSUE-001`, `ISSUE-002`, `ISSUE-003` |
| TC-005 | Summary log line (`Summary: Fixed=X Failed=Y`) correctly reflects totals across all processed issues when no `--iterations` is passed | unit | automated | US-001, US-001-AC04, FR-1, FR-4 | With 2 open issues where one succeeds and one fails (git commit returns non-zero), log contains `Summary: Fixed=1 Failed=1` |
| TC-006 | Command exits cleanly with the expected message when there are no open issues | unit | automated | US-001, US-001-AC05, FR-1 | `logFn` receives `"No open issues to process. Exiting without changes."`; `invokeAgentFn` is never called; function resolves without error |
| TC-007 | TypeScript strict-mode typecheck passes after the FR-1 change (`bun tsc --noEmit`) | unit | automated | US-001, US-001-AC06, FR-1, FR-3, FR-4 | `tsc` exits with code 0; no type errors reported |

---

## User Story: US-002 - Execute Refactor Runs Non-Interactively

| Test Case ID | Description | Type | Mode | Correlated Requirements | Expected Result |
|---|---|---|---|---|---|
| TC-008 | `invokeAgentFn` is called with `interactive: false` inside `runExecuteRefactor` (replaces the current `interactive: true` call at line ~257) | unit | automated | US-002, US-002-AC01, FR-2, FR-4 | Captured `invokeAgentFn` options show `interactive === false`; the existing test that asserted `interactive: true` is updated to assert `false` |
| TC-009 | Each refactor item is processed in order and its result is recorded in the progress file after the agent call | unit | automated | US-002, US-002-AC02, FR-2, FR-4 | With items `RI-001` and `RI-002`, agent is invoked in order; progress file entries reflect `completed`/`failed` status per invocation |
| TC-010 | State transition `in_progress` → `completed` occurs when all refactor items succeed | unit | automated | US-002, US-002-AC03, FR-2 | After `runExecuteRefactor` with all items succeeding, `state.phases.refactor.refactor_execution.status` equals `"completed"` |
| TC-011 | State remains `in_progress` when any refactor item fails | unit | automated | US-002, US-002-AC03, FR-2 | After `runExecuteRefactor` with one item failing, `state.phases.refactor.refactor_execution.status` equals `"in_progress"` |
| TC-012 | Refactor execution report (`it_XXXXXX_refactor-execution-report.md`) is generated after all items are processed, even when some fail | unit | automated | US-002, US-002-AC04, FR-2 | Report file exists; contains `**Total:**`, `**Completed:**`, `**Failed:**`, and a table row per item |
| TC-013 | TypeScript strict-mode typecheck passes after the FR-2 change (`bun tsc --noEmit`) | unit | automated | US-002, US-002-AC05, FR-2, FR-3 | `tsc` exits with code 0; no type errors reported |
| TC-014 | No new CLI flags or options are introduced: `--agent` and `--force` are the only accepted flags for `execute refactor` | unit | automated | US-002, FR-3 | Source of `src/cli.ts` contains the original `execute refactor --agent <provider>` help text and does not reference any new flag for this command |
| TC-015 | All pre-existing tests in `execute-refactor.test.ts` pass after the FR-2 change (regression guard) | integration | automated | US-002, FR-4 | `bun test src/commands/execute-refactor.test.ts` exits with code 0; all previously green tests remain green |
| TC-016 | All pre-existing tests in `execute-automated-fix.test.ts` pass after the FR-1 change (regression guard), except the one updated per TC-002 | integration | automated | US-001, FR-4 | `bun test src/commands/execute-automated-fix.test.ts` exits with code 0; every test case that exercised explicit `--iterations` values still passes |
