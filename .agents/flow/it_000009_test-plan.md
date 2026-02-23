# Test Plan - Iteration 000009

## Scope

- `bun nvst execute automated-fix` command: CLI registration, argument parsing, agent invocation, and end-to-end fix workflow.
- Reading and parsing `it_{iteration}_ISSUES.json` from the current iteration flow directory.
- Sequential processing of open issues with agent-based fix attempts.
- Configuration flags: `--agent`, `--iterations`, `--retry-on-fail`.
- Status transitions: fixed, retry, manual-fix; git commit integration.
- Network error handling (no retry consumption) and graceful degradation.
- Per-issue and summary reporting in stdout.

## Environment and data

- Runtime: Bun v1+.
- Test project roots: temporary directories created via `mkdtemp`; seeded with `.agents/state.json` and `it_{iteration}_ISSUES.json` fixtures.
- Git: command uses `git add -A && git commit`; tests may mock `runCommitFn` to avoid real git operations.
- Skill: `.agents/skills/automated-fix/SKILL.md` must exist when invoking the agent; tests may mock `loadSkillFn` and `invokeAgentFn`.

## User Story: US-001 - Run Automated Fix

| Test Case ID | Description | Type | Mode | Correlated Requirements | Expected Result |
|---|---|---|---|---|---|
| TC-US001-01 | Command `bun nvst execute automated-fix` exists and is registered in CLI | unit | automated | US-001-AC01, FR-1 | CLI source imports `runExecuteAutomatedFix` and dispatches on subcommand `automated-fix` |
| TC-US001-02 | Command reads `it_{iteration}_ISSUES.json` from current iteration flow | integration | automated | US-001-AC02, US-004-AC01, FR-2 | When issues file exists, issues are parsed and processed; file path is `.agents/flow/it_{current_iteration}_ISSUES.json` |
| TC-US001-03 | Command identifies and processes only open issues | integration | automated | US-001-AC03, US-004-AC02 | Issues with status `open` are processed; `fixed`, `retry`, `manual-fix` are skipped |
| TC-US001-04 | Issues are processed sequentially (one at a time) | integration | automated | US-001-AC04 | Agent invocations occur one per issue in order; no parallel processing |
| TC-US001-05 | Agent invoked with automated-fix skill following structured debugging workflow | integration | automated | US-001-AC05, FR-1 | `loadSkillFn` called with `automated-fix`; prompt includes issue JSON; skill content describes workflow steps |
| TC-US001-06 | On fix success: updates issue status to fixed in ISSUES.json and commits | integration | automated | US-001-AC06 | Issue status set to `fixed`; `runCommitFn` invoked with message `fix: automated-fix {issueId} -> fixed` |
| TC-US001-07 | On hypothesis not confirmed with retries remaining: marks issue as retry | integration | automated | US-001-AC07, US-003-AC03 | Issue status set to `retry`; agent invoked again up to `--retry-on-fail` times |
| TC-US001-08 | On hypothesis not confirmed with no retries: updates to manual-fix and commits | integration | automated | US-001-AC08 | Issue status set to `manual-fix`; commit executed |
| TC-US001-09 | On unrecoverable/network error: updates to manual-fix, commits, does not consume retries | integration | automated | US-001-AC09, FR-3, FR-4 | Issue status set to `manual-fix`; commit executed; `invokeAgentFn` not retried for network errors |
| TC-US001-10 | On git commit failure: prints error, marks as Failed in summary, continues to next issue | integration | automated | US-001-AC10 | Log contains `Error: git commit failed for {issueId}`; issue shown as Failed; next issue processed |
| TC-US001-11 | Typecheck and lint pass | unit | automated | US-001-AC11 | `bun run typecheck` and any lint commands exit 0 |

## User Story: US-002 - Specify Agent

| Test Case ID | Description | Type | Mode | Correlated Requirements | Expected Result |
|---|---|---|---|---|---|
| TC-US002-01 | Command accepts `--agent [name]` flag | unit | automated | US-002-AC01 | CLI parses `--agent` and passes provider to `runExecuteAutomatedFix` |
| TC-US002-02 | Without `--agent`: prints error and exits non-zero | integration | automated | US-002-AC02 | Exit code 1; stderr contains "Missing required --agent" |
| TC-US002-03 | Selected agent is invoked for fix attempt | integration | automated | US-002-AC03, FR-1 | `invokeAgentFn` called with `provider` matching `--agent` value (e.g. cursor, codex, claude, gemini) |

## User Story: US-003 - Configure Loop

| Test Case ID | Description | Type | Mode | Correlated Requirements | Expected Result |
|---|---|---|---|---|---|
| TC-US003-01 | Command accepts `--iterations [number]` (default: 1) | unit | automated | US-003-AC01 | Default processes 1 open issue; `--iterations 2` processes 2 |
| TC-US003-02 | Command accepts `--retry-on-fail [number]` (default: 0) | unit | automated | US-003-AC02 | Default retries 0; `--retry-on-fail 2` retries up to 2 times |
| TC-US003-03 | When AgentResult.exitCode !== 0: retries up to --retry-on-fail times | integration | automated | US-003-AC03 | Agent invoked repeatedly until success or max retries; status becomes `manual-fix` when exhausted |
| TC-US003-04 | Tool stops retrying after success or max retries | integration | automated | US-003-AC04 | Invocation count equals 1 + retries until success; or max retries then manual-fix |
| TC-US003-05 | When --iterations < total open issues: only first N processed | integration | automated | US-003-AC05 | With 3 open issues and `--iterations 2`, exactly 2 are processed; third remains `open` |

## User Story: US-004 - Read Issues

| Test Case ID | Description | Type | Mode | Correlated Requirements | Expected Result |
|---|---|---|---|---|---|
| TC-US004-01 | Tool parses `it_{iteration}_ISSUES.json` | integration | automated | US-004-AC01, FR-2 | Valid JSON array parsed; issues extracted |
| TC-US004-02 | Only issues with status `open` are processed | integration | automated | US-004-AC02 | Non-open issues skipped; no agent invocation for them |
| TC-US004-03 | If file does not exist: clear error, exit non-zero | integration | automated | US-004-AC03 | Error message mentions expected path; exit code non-zero (throws) |
| TC-US004-04 | If JSON is malformed: clear error, exit non-zero | integration | automated | US-004-AC04, FR-2 | Error contains "invalid issues JSON" or similar; throws |
| TC-US004-05 | If zero open issues: informative message, exit 0 | integration | automated | US-004-AC05 | Logs "No open issues to process"; returns without error |
| TC-US004-06 | If issue missing required fields (id, title, description, status): skip with warning, continue | integration | automated | US-004-AC06 | Warning logged; invalid issue skipped; remaining valid open issues processed |

## User Story: US-005 - Report Results

| Test Case ID | Description | Type | Mode | Correlated Requirements | Expected Result |
|---|---|---|---|---|---|
| TC-US005-01 | Prints `{issueId}: Fixed` or `{issueId}: Failed` per issue | integration | automated | US-005-AC01 | Log output contains lines matching pattern `{issueId}: Fixed` or `{issueId}: Failed` |
| TC-US005-02 | Summary at end with Fixed count and Failed count | integration | automated | US-005-AC02 | Log contains `Summary: Fixed=N Failed=M` |
| TC-US005-03 | Result verifiable from terminal output | integration | automated | US-005-AC03 | All status lines and summary are in stdout/log; no manual inspection of DOM required |

## Functional Requirements Coverage

| FR ID | Covered by Test Cases |
|-------|------------------------|
| FR-1 | TC-US001-01, TC-US001-05, TC-US002-03 |
| FR-2 | TC-US001-02, TC-US004-01, TC-US004-04 |
| FR-3 | TC-US001-09 |
| FR-4 | TC-US001-09 |
