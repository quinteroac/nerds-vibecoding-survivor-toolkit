# Test Plan - Iteration 000014

## Scope

- `execute refactor` command: precondition guards, refactor-prd read/validation, progress file lifecycle, agent invocation, state mutation, and report generation (`src/commands/execute-refactor.ts`, `src/cli.ts`)
- Resume behaviour: loading and validating existing progress file, skipping completed items, re-attempting pending/failed items, and rejecting when progress item IDs do not match the current refactor-prd
- Progress file schema: structure and validation for `.agents/flow/it_{iteration}_refactor-execution-progress.json` (entries with `id`, `title`, `status`, `attempt_count`, `last_agent_exit_code`, `updated_at`)
- Report generation: markdown report path, content (iteration, counts, table with RI ID | Title | Status | Agent Exit Code), and writing regardless of success/failure
- `execute-refactor-item` skill: existence, front-matter, and content requirements at `.agents/skills/execute-refactor-item/SKILL.md`
- Error-handling convention: command handler must not call `process.exit()`; use `process.exitCode` and throw `Error` with descriptive messages

## Environment and data

- Runtime: Bun v1+ (`bun test` via `bun:test`)
- Language: TypeScript strict mode; test files co-located alongside source (e.g. `src/commands/execute-refactor.test.ts`)
- State fixtures: in-memory `state.json` objects with valid/invalid `current_phase`, `refactor_plan.status`, and `refactor_execution.status`; injected via module mocking or helper factories
- File-system fixtures: temporary or in-memory `it_{iteration}_refactor-prd.json` and `it_{iteration}_refactor-execution-progress.json` for schema and path tests
- Agent mocking: `invokeAgent` stubbed to return `{ exitCode: 0 }` or `{ exitCode: 1 }` as required; `write-json` subprocess stubbed where progress writes are tested
- Skill file: actual `.agents/skills/execute-refactor-item/SKILL.md` on disk for existence and content assertions

---

## User Story: US-001 - Execute approved refactor items via agent

| Test Case ID | Description | Type (unit/integration/e2e) | Mode (automated/manual) | Correlated Requirements (US-XXX, FR-X) | Expected Result |
|---|---|---|---|---|---|
| TC-001-01 | Command accepts `bun nvst execute refactor --agent <provider>` for provider in `claude`, `codex`, `gemini`, `cursor` | unit | automated | US-001, FR-1 | Handler is invoked with correct provider; no throw for valid provider |
| TC-001-02 | Command rejects with clear error when `current_phase !== "refactor"` (e.g. `"prototype"`) | unit | automated | US-001, FR-2 | Throws `Error` with descriptive message; `process.exitCode` set to 1; no state write |
| TC-001-03 | Command rejects with clear error when `refactor_plan.status !== "approved"` | unit | automated | US-001, FR-2 | Throws `Error` with descriptive message; `process.exitCode` set to 1; no state write |
| TC-001-04 | Command rejects with clear error when `refactor_execution.status === "completed"` | unit | automated | US-001, FR-2 | Throws `Error` with descriptive message; `process.exitCode` set to 1; no state write |
| TC-001-05 | Command rejects when `it_{iteration}_refactor-prd.json` is missing | unit | automated | US-001, FR-3 | Throws `Error` with clear message; exit code 1 |
| TC-001-06 | Command rejects when refactor-prd file fails `RefactorPrdSchema.safeParse()` (schema mismatch) | unit | automated | US-001, FR-3 | Throws `Error` with clear message; exit code 1 |
| TC-001-07 | Before processing, `refactor_execution.status` is set to `"in_progress"` in state | unit | automated | US-001, FR-9 | `writeState` (or equivalent) receives state with `refactor_execution.status === "in_progress"` |
| TC-001-08 | For each RI-NNN item, agent is invoked with skill `execute-refactor-item` and prompt variables `current_iteration`, `item_id`, `item_title`, `item_description`, `item_rationale` | unit | automated | US-001, FR-6 | `invokeAgent`/`buildPrompt` receive skill name and context object containing the five variables with values from the refactor item |
| TC-001-09 | Agent is invoked with `interactive: true` (same as create prototype) | unit | automated | US-001, FR-6 | Stub receives call with `interactive: true` |
| TC-001-10 | After each agent invocation, item result is recorded to progress file via schema-validated write (e.g. `nvst write-json`) before next item | unit | automated | US-001, FR-7 | Progress write is triggered after each invocation; write uses expected schema/path; order is correct |
| TC-001-11 | Non-zero agent exit code marks the item as `failed` in progress file; execution continues to next item | unit | automated | US-001, FR-7, FR-9 | Progress entry for that item has `status: "failed"` and `last_agent_exit_code` set; handler proceeds to next item without throwing |
| TC-001-12 | When all items complete successfully, `refactor_execution.status` is set to `"completed"` in state | unit | automated | US-001, FR-9 | `writeState` receives state with `refactor_execution.status === "completed"` |
| TC-001-13 | When any item failed, `refactor_execution.status` remains `"in_progress"` | unit | automated | US-001, FR-9 | Final state has `refactor_execution.status === "in_progress"` |
| TC-001-14 | `refactor_execution.file` is set to progress file name (e.g. `it_{iteration}_refactor-execution-progress.json`) | unit | automated | US-001, FR-9 | Captured state has `refactor_execution.file` matching the progress file name |
| TC-001-15 | After run, `state.last_updated` and `state.updated_by = "nvst:execute-refactor"` are written | unit | automated | US-001, FR-9 | `writeState` receives state with correct `last_updated` and `updated_by` |
| TC-001-16 | Progress file path is `.agents/flow/it_{iteration}_refactor-execution-progress.json` | unit | automated | US-001, FR-5 | Path used for read/write matches the required pattern |
| TC-001-17 | Progress file schema has entries with `id`, `title`, `status`, `attempt_count`, `last_agent_exit_code`, `updated_at` | unit | automated | US-001, FR-4 | Schema or serialized object conforms to the required shape; `safeParse` accepts valid payloads |
| TC-001-18 | `src/commands/execute-refactor.ts` exists and exports `runExecuteRefactor` | unit | automated | US-001, FR-10 | File exists; exported symbol is a function |
| TC-001-19 | Handler does not call `process.exit()` under any code path | unit | automated | US-001, FR-10 | No occurrence of `process.exit(` in `src/commands/execute-refactor.ts` |
| TC-001-20 | Typecheck and lint pass for the codebase | unit | automated | US-001 | `bun run typecheck` (or equivalent) and lint pass |

---

## User Story: US-002 - Resume interrupted execution

| Test Case ID | Description | Type (unit/integration/e2e) | Mode (automated/manual) | Correlated Requirements (US-XXX, FR-X) | Expected Result |
|---|---|---|---|---|---|
| TC-002-01 | When `refactor_execution.status === "in_progress"` and progress file exists, command loads the existing progress file | unit | automated | US-002, FR-4, FR-5 | Progress file is read; entries are used to determine which items to skip vs re-run |
| TC-002-02 | Progress file is validated against its schema on load; command rejects with clear error on schema mismatch | unit | automated | US-002, FR-4 | Invalid JSON or schema failure results in thrown `Error` and exit code 1 |
| TC-002-03 | Items whose progress entry is `"completed"` are skipped (agent not invoked for them) | unit | automated | US-002, FR-4 | `invokeAgent` is not called for entries with `status: "completed"`; only pending/failed items are invoked |
| TC-002-04 | Items whose progress entry is `"pending"` or `"failed"` are re-attempted | unit | automated | US-002, FR-4 | Agent is invoked for each such item; progress is updated after each attempt |
| TC-002-05 | Command rejects with clear error when existing progress item IDs do not match IDs in current `refactor-prd.json` | unit | automated | US-002, FR-4 | Throws `Error` with descriptive message; exit code 1; no agent invocations |
| TC-002-06 | Typecheck and lint pass | unit | automated | US-002 | `bun run typecheck` and lint pass |

---

## User Story: US-003 - Generate a markdown execution report

| Test Case ID | Description | Type (unit/integration/e2e) | Mode (automated/manual) | Correlated Requirements (US-XXX, FR-X) | Expected Result |
|---|---|---|---|---|---|
| TC-003-01 | After all items are processed, report file `it_{iteration}_refactor-execution-report.md` is written to `.agents/flow/` | unit | automated | US-003, FR-8 | File exists at `.agents/flow/it_{iteration}_refactor-execution-report.md` after run |
| TC-003-02 | Report includes iteration number, total items, count completed, count failed, and table with columns `RI ID \| Title \| Status \| Agent Exit Code` | unit | automated | US-003, FR-8 | File content contains iteration, numeric counts, and a table with the four column headers; rows match progress entries |
| TC-003-03 | Report is written even when one or more items failed | unit | automated | US-003, FR-8 | After a run with at least one failed item, report file exists and reflects failed count and status column values |
| TC-003-04 | Typecheck and lint pass | unit | automated | US-003 | `bun run typecheck` and lint pass |

---

## User Story: US-004 - Add `execute-refactor-item` agent skill

| Test Case ID | Description | Type (unit/integration/e2e) | Mode (automated/manual) | Correlated Requirements (US-XXX, FR-X) | Expected Result |
|---|---|---|---|---|---|
| TC-004-01 | File `.agents/skills/execute-refactor-item/SKILL.md` exists | unit | automated | US-004, FR-11 | File exists at the given path |
| TC-004-02 | Skill front-matter includes `name: execute-refactor-item`, `description`, and `user-invocable: false` | unit | automated | US-004, FR-11 | Parsed front-matter or regex/content check confirms the three fields with expected values |
| TC-004-03 | Skill instructs agent to read item `id`, `title`, `description`, `rationale`; locate and apply code changes; verify compile/typecheck; confirm completion | unit | automated | US-004, FR-11 | Content includes references to these instructions (e.g. id, title, description, rationale, apply changes, verify, confirm) |
| TC-004-04 | Skill references `.agents/PROJECT_CONTEXT.md` as source of conventions | unit | automated | US-004, FR-11 | Content mentions `.agents/PROJECT_CONTEXT.md` or PROJECT_CONTEXT |
| TC-004-05 | Typecheck/lint: skill is Markdown only, no compiled code change | unit | automated | US-004 | No TypeScript/lint failure introduced by the skill file |

---

## User Story: US-005 - Register command in CLI router and help text

| Test Case ID | Description | Type (unit/integration/e2e) | Mode (automated/manual) | Correlated Requirements (US-XXX, FR-X) | Expected Result |
|---|---|---|---|---|---|
| TC-005-01 | `src/cli.ts` routes `execute refactor` (with `--agent <provider>`) to `runExecuteRefactor` | integration | automated | US-005, FR-12 | When argv is `execute refactor --agent claude`, handler stub for `runExecuteRefactor` is invoked |
| TC-005-02 | `printUsage()` includes `execute refactor --agent <provider>` with a one-line description | unit | automated | US-005, FR-12 | Usage string contains the substring for execute refactor and agent provider |
| TC-005-03 | Unknown options after `--agent <provider>` cause clear error and exit code 1 (consistent with other execute subcommands) | unit | automated | US-005, FR-12 | Invoking with an unknown flag after `--agent claude` results in error message and `process.exitCode === 1` |
| TC-005-04 | Typecheck and lint pass | unit | automated | US-005 | `bun run typecheck` and lint pass |
