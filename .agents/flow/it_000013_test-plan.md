# Test Plan - Iteration 000013

## Scope

- `define refactor-plan` command: state guards, agent invocation, state mutation, and CLI routing (`src/commands/define-refactor-plan.ts`, `src/cli.ts`)
- `refine refactor-plan` command: state and file guards, skill loading, prompt context construction, `--challenge` mode, no-mutation guarantee (`src/commands/refine-refactor-plan.ts`, `src/cli.ts`)
- `approve refactor-plan` command: state and file guards, `write-json` invocation, failure atomicity, state mutation, and CLI routing (`src/commands/approve-refactor-plan.ts`, `src/cli.ts`)
- `RefactorPrdSchema` Zod schema: field validation, `RI-NNN` id format enforcement, rejection of invalid objects (`scaffold/schemas/tmpl_refactor-prd.ts`)
- `write-json` schema registry: registration and resolution of the `refactor-prd` schema identifier (`src/commands/write-json.ts`)
- SKILL.md artifacts: existence and structural content of `.agents/skills/plan-refactor/SKILL.md` and `.agents/skills/refine-refactor-plan/SKILL.md`
- Error-handling convention: none of the three new command handlers may call `process.exit()`

## Environment and data

- Runtime: Bun v1+ (`bun test` via `bun:test`)
- Language: TypeScript strict mode; test files co-located alongside source (e.g. `src/commands/define-refactor-plan.test.ts`)
- State fixtures: in-memory `state.json` objects covering valid and invalid `current_phase` / `refactor.refactor_plan.status` values, injected via module mocking or helper factories
- File-system fixtures: temporary files for the refactor plan markdown (`.agents/flow/it_000013_refactor-plan.md`) used to test file-existence guards
- Skill file fixtures: actual `.agents/skills/plan-refactor/SKILL.md` and `.agents/skills/refine-refactor-plan/SKILL.md` on disk (tests read them directly)
- Agent mocking: `invokeAgent` stubbed to return `{ exitCode: 0 }` (success) or `{ exitCode: 1 }` (failure) as required per test case
- `writeState` mocking: spy/stub to capture state writes without touching the real `.agents/state.json`

---

## User Story: US-001 - Define Refactor Plan

| Test Case ID | Description | Type | Mode | Correlated Requirements | Expected Result |
|---|---|---|---|---|---|
| TC-001-01 | Command handler rejects when `current_phase` is not `"refactor"` (e.g. `"prototype"`) | unit | automated | US-001, FR-7, FR-8 | Throws an `Error` with a descriptive message; `process.exitCode` is set to `1`; `writeState` is not called |
| TC-001-02 | Command handler rejects when `refactor.refactor_plan.status` is not `"pending"` (e.g. `"pending_approval"`) | unit | automated | US-001, FR-8 | Throws an `Error` with a descriptive message; `process.exitCode` is set to `1`; `writeState` is not called |
| TC-001-03 | Skill is loaded from `.agents/skills/plan-refactor/SKILL.md` and `buildPrompt` receives `{ current_iteration }` | unit | automated | US-001, FR-1 | Skill file path matches `.agents/skills/plan-refactor/SKILL.md`; prompt context object contains `current_iteration` |
| TC-001-04 | `invokeAgent` is called with `interactive: true` | unit | automated | US-001, FR-1 | Stub receives call with `interactive: true` |
| TC-001-05 | On agent `exitCode === 0`, `refactor_plan.status` is set to `"pending_approval"` and `refactor_plan.file` to `"it_000013_refactor-plan.md"` | unit | automated | US-001, FR-1 | `writeState` spy receives state with the updated fields |
| TC-001-06 | On agent success, `state.last_updated` and `state.updated_by` are set to `"nvst:define-refactor-plan"` and `writeState` is called once | unit | automated | US-001, FR-1, FR-7 | `writeState` spy called exactly once; captured state has correct `last_updated` timestamp and `updated_by` |
| TC-001-07 | `src/cli.ts` routes `["define", "refactor-plan"]` to the `runDefineRefactorPlan` handler | integration | automated | US-001, FR-1 | Handler stub is invoked when argv contains `define refactor-plan` |
| TC-001-08 | Handler does not call `process.exit()` under any code path | unit | automated | US-001, FR-8 | Static grep/AST check on `src/commands/define-refactor-plan.ts` finds zero occurrences of `process.exit(` |
| TC-001-09 | `.agents/skills/plan-refactor/SKILL.md` contains required structure: objectives, inputs, output filename pattern, `## Refactor Items` section, `### RI-NNN: <Title>` subsection format, `**Description:**` and `**Rationale:**` fields | unit | automated | US-001, FR-9 | File exists; content includes `## Refactor Items`, `RI-`, `**Description:**`, `**Rationale:**`, and references the expected output filename pattern |

---

## User Story: US-002 - Refine Refactor Plan

| Test Case ID | Description | Type | Mode | Correlated Requirements | Expected Result |
|---|---|---|---|---|---|
| TC-002-01 | Command handler rejects when `refactor.refactor_plan.status` is not `"pending_approval"` | unit | automated | US-002, FR-2, FR-8 | Throws an `Error` with a descriptive message; `process.exitCode` is set to `1`; agent is not invoked |
| TC-002-02 | Command handler rejects when `refactor_plan.file` is missing from state | unit | automated | US-002, FR-2, FR-8 | Throws an `Error`; `process.exitCode` is set to `1`; agent is not invoked |
| TC-002-03 | Command handler rejects when `refactor_plan.file` points to a non-existent file on disk | unit | automated | US-002, FR-2, FR-8 | Throws an `Error` with a descriptive message; `process.exitCode` is set to `1` |
| TC-002-04 | Skill is loaded from `.agents/skills/refine-refactor-plan/SKILL.md` | unit | automated | US-002, FR-2, FR-4 | Skill path resolved to `.agents/skills/refine-refactor-plan/SKILL.md` |
| TC-002-05 | Prompt context includes `current_iteration`, `refactor_plan_file`, and `refactor_plan_content` (content of the plan file) | unit | automated | US-002, FR-2 | `buildPrompt` stub receives a context object with all three keys populated; `refactor_plan_content` matches the file contents |
| TC-002-06 | Without `--challenge` flag, `context.mode` is absent from the prompt context | unit | automated | US-002, FR-2 | Prompt context object does not contain a `mode` key |
| TC-002-07 | With `--challenge` flag, `context.mode = "challenger"` is included in the prompt context | unit | automated | US-002, FR-2 | Prompt context object contains `mode: "challenger"` |
| TC-002-08 | State is not mutated after agent invocation (status stays `"pending_approval"`) | unit | automated | US-002, FR-2 | `writeState` is never called; state object remains unchanged after handler returns |
| TC-002-09 | `src/cli.ts` routes `["refine", "refactor-plan"]` to the `runRefineRefactorPlan` handler and passes `challenge: true` when `--challenge` is present | integration | automated | US-002, FR-2 | Handler stub is invoked with `challenge: true` when `--challenge` is in argv; `challenge: false` otherwise |
| TC-002-10 | Handler does not call `process.exit()` under any code path | unit | automated | US-002, FR-8 | Static grep/AST check on `src/commands/refine-refactor-plan.ts` finds zero occurrences of `process.exit(` |
| TC-002-11 | `.agents/skills/refine-refactor-plan/SKILL.md` exists and contains instructions for both edit and challenge modes | unit | automated | US-002, FR-4 | File exists at `.agents/skills/refine-refactor-plan/SKILL.md`; content contains edit-mode and challenger-mode sections |

---

## User Story: US-003 - Approve Refactor Plan

| Test Case ID | Description | Type | Mode | Correlated Requirements | Expected Result |
|---|---|---|---|---|---|
| TC-003-01 | Command handler rejects when `refactor.refactor_plan.status` is not `"pending_approval"` | unit | automated | US-003, FR-3, FR-8 | Throws an `Error` with a descriptive message; `process.exitCode` is set to `1`; `writeState` is not called |
| TC-003-02 | Command handler rejects when `refactor_plan.file` is missing from state | unit | automated | US-003, FR-3, FR-8 | Throws an `Error`; `process.exitCode` is set to `1`; `writeState` is not called |
| TC-003-03 | Command handler rejects when `refactor_plan.file` points to a non-existent file on disk | unit | automated | US-003, FR-3, FR-8 | Throws an `Error`; `process.exitCode` is set to `1`; `writeState` is not called |
| TC-003-04 | `RefactorPrdSchema` accepts a valid object with `refactorItems` array where each item has `id` (`RI-NNN` format), `title`, `description`, and `rationale` | unit | automated | US-003, FR-5 | `safeParse` returns `{ success: true }` |
| TC-003-05 | `RefactorPrdSchema` rejects objects missing any required field (`id`, `title`, `description`, or `rationale`) | unit | automated | US-003, FR-5 | `safeParse` returns `{ success: false }` with relevant Zod error paths |
| TC-003-06 | `RefactorPrdSchema` rejects items where `id` does not match `RI-NNN` format (e.g. `"RI-1"`, `"R-001"`, `""`) | unit | automated | US-003, FR-5 | `safeParse` returns `{ success: false }` |
| TC-003-07 | `nvst write-json --schema refactor-prd` resolves `RefactorPrdSchema` without throwing a "schema not found" error | integration | automated | US-003, FR-6 | Schema lookup succeeds; output file would be written if input is valid |
| TC-003-08 | If `write-json` subprocess exits with non-zero code, state is NOT mutated and command exits with `process.exitCode = 1` | unit | automated | US-003, FR-3, FR-8 | `writeState` is not called; `process.exitCode` is `1` |
| TC-003-09 | On `write-json` success, `refactor_plan.status` is set to `"approved"` and state is persisted via `writeState` | unit | automated | US-003, FR-3 | `writeState` spy receives state with `status: "approved"` |
| TC-003-10 | On success, `state.last_updated` is refreshed and `state.updated_by` is set to `"nvst:approve-refactor-plan"` | unit | automated | US-003, FR-3 | `writeState` spy receives state with correct `last_updated` and `updated_by` fields |
| TC-003-11 | `src/cli.ts` routes `["approve", "refactor-plan"]` to the `runApproveRefactorPlan` handler | integration | automated | US-003, FR-3 | Handler stub is invoked when argv contains `approve refactor-plan` |
| TC-003-12 | Handler does not call `process.exit()` under any code path | unit | automated | US-003, FR-8 | Static grep/AST check on `src/commands/approve-refactor-plan.ts` finds zero occurrences of `process.exit(` |
