# Test Plan - Iteration 000008

## Scope

- `nvst create issue --agent <provider>` command: agent-driven interactive issue creation flow (US-001)
- `nvst create issue --test-execution-report` command: derivation of issues from test execution results (US-002)
- CLI argument validation: exactly one of `--agent` or `--test-execution-report` must be provided (FR-1)
- Output schema validation: ISSUES file must conform to `{ id, title, description, status }` with unique IDs (FR-6)
- State integration: `current_iteration` from `state.json` drives output path and input file lookup (FR-2, FR-3)
- Test result mapping: `failed`, `skipped`, `invocation_failed` statuses map to open issues (FR-5)

## Environment and data

- Runtime: Bun v1+ (run `bun test` for automated tests)
- Project root must contain `.agents/state.json` with valid `current_iteration` (e.g. `"000008"`)
- For `--agent` flow: skill `.agents/skills/create-issue/SKILL.md` must exist; agent provider must be configured
- For `--test-execution-report` flow: `.agents/flow/it_{iteration}_test-execution-results.json` or archived path must exist (or tests expect file-not-found error)
- Fixtures: use in-memory or temp-dir test execution results for isolated unit/integration tests
- `write-json` command must support `--schema issues` (issues schema registered in scaffold/schemas)

## User Story: US-001 - Create issue via agent interaction

| Test Case ID | Description | Type | Mode | Correlated Requirements | Expected Result |
|---|---|---|---|---|---|
| TC-US001-01 | Command `bun nvst create issue` without `--agent` exits with code 1 and stderr mentions `--agent` | unit | automated | US-001-AC01, FR-1 | Exit code 1; stderr contains "Missing" or "--agent" |
| TC-US001-02 | Command `bun nvst create issue --agent invalid-provider` exits with code 1 and stderr mentions unknown provider | unit | automated | US-001-AC01, FR-1 | Exit code 1; stderr contains "Unknown agent provider" |
| TC-US001-03 | Command `bun nvst create issue --agent claude --unknown-flag` exits with code 1 and stderr mentions unknown option | unit | automated | US-001-AC01, FR-1 | Exit code 1; stderr contains "Unknown option" |
| TC-US001-04 | Agent output shape (title, description) is validated; invalid shape causes error before write | unit | automated | US-001-AC02, US-001-AC03, FR-4, FR-6 | Invalid agent output throws; no file written |
| TC-US001-05 | Valid agent output produces issues with auto-generated `id` (ISSUE-{iteration}-{seq}) and `status: "open"` | unit | automated | US-001-AC02, FR-6 | Issues have unique sequential IDs and status "open" |
| TC-US001-06 | Output file path follows `.agents/flow/it_{iteration}_ISSUES.json` convention | unit | automated | US-001-AC04, FR-2, FR-3 | Path is `.agents/flow/it_{current_iteration}_ISSUES.json` |
| TC-US001-07 | Generated issues pass ISSUES schema validation (id, title, description, status; unique IDs) | unit | automated | US-001-AC03, FR-6 | `IssuesSchema.safeParse(issues)` succeeds |
| TC-US001-08 | `extractJson` correctly parses JSON from markdown fences and raw array text | unit | automated | US-001-AC03 | Extracted JSON parses to valid array |
| TC-US001-09 | Command exits with code 0 on successful agent flow; exits with code 1 on failure | integration | automated | US-001-AC05 | Exit codes match success/failure |
| TC-US001-10 | `write-json --schema issues` accepts valid issues data and rejects invalid data | unit | automated | US-001-AC03, FR-6 | Valid data: exit 0; invalid data: exit 1 |
| TC-US001-11 | Typecheck passes (tsc) | unit | automated | US-001-AC06 | `bun run tsc --noEmit` exits 0 |

## User Story: US-002 - Create issues from test execution results

| Test Case ID | Description | Type | Mode | Correlated Requirements | Expected Result |
|---|---|---|---|---|---|
| TC-US002-01 | `isActionableStatus` returns true for `failed`, `skipped`, `invocation_failed` | unit | automated | US-002-AC02, FR-5 | All three statuses return true |
| TC-US002-02 | `isActionableStatus` returns false for `passed` and unknown values | unit | automated | US-002-AC02, FR-5 | Non-actionable statuses return false |
| TC-US002-03 | `buildIssuesFromTestResults` converts failed/skipped/invocation_failed tests to issues with status "open" | unit | automated | US-002-AC02, FR-5 | Each actionable result becomes one issue; status "open" |
| TC-US002-04 | `buildIssuesFromTestResults` includes `notes` and `evidence` in issue description | unit | automated | US-002-AC02, FR-5 | Description contains payload.notes and payload.evidence |
| TC-US002-05 | `buildIssuesFromTestResults` filters out passing tests | unit | automated | US-002-AC02, FR-5 | Passing tests do not appear in output |
| TC-US002-06 | `buildIssuesFromTestResults` returns empty array when all tests pass | unit | automated | US-002-AC04, FR-5 | Empty array; valid per ISSUES schema |
| TC-US002-07 | Generated issues from test results pass ISSUES schema validation | unit | automated | US-002-AC06, FR-6 | `IssuesSchema.safeParse(issues)` succeeds |
| TC-US002-08 | Issue IDs are unique and sequential (ISSUE-{iteration}-{seq}) | unit | automated | FR-6 | Unique IDs; no duplicates |
| TC-US002-09 | Command reads test-execution-results from `.agents/flow/` first | integration | automated | US-002-AC01, FR-2 | Flow path preferred when file exists |
| TC-US002-10 | Command falls back to archived path from `state.json` history when flow file absent | integration | automated | US-002-AC01, FR-2 | Archived path used when flow file missing |
| TC-US002-11 | Command fails with clear error when file missing in both flow and archived paths | integration | automated | US-002-AC05 | Exit 1; stderr contains "test-execution-results" |
| TC-US002-12 | Command writes `it_{iteration}_ISSUES.json` to `.agents/flow/` on success | integration | automated | US-002-AC03, FR-3 | File created at correct path |
| TC-US002-13 | `create issue --test-execution-report --extra-flag` exits with code 1 and unknown option error | unit | automated | FR-1 | Exit 1; stderr contains "Unknown option" |
| TC-US002-14 | `create issue --test-execution-report` does not require `--agent` (no "Missing --agent" error) | unit | automated | FR-1 | Error (if any) is file-not-found, not --agent |
| TC-US002-15 | Typecheck passes | unit | automated | US-002-AC07 | `bun run tsc --noEmit` exits 0 |

## Cross-cutting: FR-1 (exactly one mode)

| Test Case ID | Description | Type | Mode | Correlated Requirements | Expected Result |
|---|---|---|---|---|---|
| TC-FR1-01 | `create issue` without `--agent` and without `--test-execution-report` fails with usage error | unit | automated | FR-1 | Exit 1; stderr mentions --agent or usage |
| TC-FR1-02 | `create issue --agent claude --test-execution-report` fails (both modes) | unit | automated | FR-1 | Exit 1; stderr mentions unknown option |
| TC-FR1-03 | `create issue --test-execution-report --agent claude` fails (both modes) | unit | automated | FR-1 | Exit 1; stderr mentions unknown option |

## Cross-cutting: ISSUES schema (FR-6)

| Test Case ID | Description | Type | Mode | Correlated Requirements | Expected Result |
|---|---|---|---|---|---|
| TC-FR6-01 | ISSUES schema accepts valid array with id, title, description, status | unit | automated | FR-6 | `IssuesSchema.safeParse` succeeds |
| TC-FR6-02 | ISSUES schema rejects duplicate IDs | unit | automated | FR-6 | `safeParse` fails with duplicate ID message |
| TC-FR6-03 | ISSUES schema rejects invalid status (e.g. "closed") | unit | automated | FR-6 | `safeParse` fails |
| TC-FR6-04 | ISSUES schema rejects missing required fields | unit | automated | FR-6 | `safeParse` fails |
| TC-FR6-05 | ISSUES schema rejects non-array input | unit | automated | FR-6 | `safeParse` fails |
