# Test Plan - Iteration 000004

## User Story: US-001 - Enhanced Test Plan Schema Definition

| Test Case ID | Description | Type (unit/integration/e2e) | Mode (automated/manual) | Correlated Requirements (US-XXX, FR-X) | Expected Result |
|---|---|---|---|---|---|
| TC-001 | Verify `TestPlanSchema` accepts enhanced test plan metadata structure (new fields: `overallStatus`, `scope`, `environmentData`, `automatedTests`, `exploratoryManualTests`) | unit | automated | US-001, FR-1, FR-2, FR-3 | Schema validates objects with all new fields, correct status enums, and `correlatedRequirements` arrays. |
| TC-002 | Verify `TestPlanSchema` rejects legacy flat-list schema shape | unit | automated | US-001, FR-1 | Schema rejects payloads using the old structure (string arrays instead of object arrays, `environmentAndData` instead of `environmentData`). |
| TC-003 | Verify typecheck passes after schema updates | integration | automated | US-001 | A test spawns `bun x tsc --noEmit` (or equivalent) and asserts exit code 0, confirming no type errors in files importing `TestPlanSchema`. If executed via CI typecheck gate instead, the gate must be documented. |

## User Story: US-002 - Update Test Plan Generator Skill

| Test Case ID | Description | Type (unit/integration/e2e) | Mode (automated/manual) | Correlated Requirements (US-XXX, FR-X) | Expected Result |
|---|---|---|---|---|---|
| TC-004 | Verify `create-test-plan` skill has YAML frontmatter and required automation-first instructions | unit | automated | US-002, FR-2 | `SKILL.md` contains frontmatter with `name`, `description`, `user-invocable: true`, mandatory table format with `Correlated Requirements (US-XXX, FR-X)` column, and instructions that every `FR-N` must have automated coverage. |
| TC-005 | Verify `create-test-plan` command registers in CLI dispatch | unit | automated | US-002 | `cli.ts` imports `runCreateTestPlan` and dispatches `create test-plan` subcommand correctly. Assertion must uniquely identify the `create` branch — e.g., by verifying the `runCreateTestPlan` import and its invocation context, not just the generic `subcommand === "test-plan"` string which also appears in the `approve` branch. |
| TC-006 | Verify `create-test-plan` command loads skill, invokes agent with iteration context, and writes state | integration | automated | US-002 | Command loads the `create-test-plan` skill, invokes agent interactively with iteration number and traceability instructions in the prompt, writes test plan markdown, and updates `test_plan.status` to `pending_approval`. **Note:** This test uses a mocked skill loader that returns hard-coded content; it verifies prompt pass-through behavior, not actual `SKILL.md` content (which is covered by TC-004). TC-004 + TC-006 together provide the full skill-to-prompt coverage chain. |
| TC-007 | Verify `create-test-plan` requires `project_context.status` to be `created` | unit | automated | US-002 | Command throws when `project_context.status` is not `created`. |
| TC-008 | Verify overwrite confirmation prompt and cancel behavior | integration | automated | US-002 | When an existing test plan file is present, the command asks for confirmation; if denied, the agent is not invoked and state remains unchanged. |
| TC-009 | Verify force flag bypasses overwrite confirmation | integration | automated | US-002 | When `force: true` is passed, no confirmation is requested and the agent proceeds directly. |
| TC-010 | Verify command fails when generated markdown omits correlated requirement IDs | integration | automated | US-002, FR-2 | Command throws traceability error and state remains `pending` when the generated markdown table lacks the `Correlated Requirements` column. |
| TC-011 | Verify `parseTestPlanForValidation` maps requirement traceability into schema-compatible test items | unit | automated | US-002, FR-2 | Parser extracts `correlatedRequirements` arrays from markdown table rows and sets `overallStatus` to `pending`. |
| TC-012 | Manual verification of `bun nvst create test-plan` output | e2e | manual | US-002 | The generated markdown test plan correctly includes requirement IDs in the test case table. *Justification: Visual check of AI-generated content formatting.* |

## User Story: US-003 - Automated Validation of Traceability

| Test Case ID | Description | Type (unit/integration/e2e) | Mode (automated/manual) | Correlated Requirements (US-XXX, FR-X) | Expected Result |
|---|---|---|---|---|---|
| TC-013 | Verify `approve-test-plan.test.ts` validates parsed JSON against new schema | unit | automated | US-003, FR-1, FR-2 | Tests confirm that parsed data adheres to the new object structure and status values. |
| TC-014 | Verify `approve-test-plan.test.ts` validates `correlatedRequirements` population | unit | automated | US-003, FR-2 | Tests confirm that the parser extracts requirement IDs into the `correlatedRequirements` array. |
| TC-015 | Verify `create-test-plan.test.ts` checks skill prompt for traceability instructions | unit | automated | US-003 | Test fails if the skill prompt lacks the mandatory traceability instructions. |

## User Story: US-004 - Update Approve Test Plan Parser

| Test Case ID | Description | Type (unit/integration/e2e) | Mode (automated/manual) | Correlated Requirements (US-XXX, FR-X) | Expected Result |
|---|---|---|---|---|---|
| TC-016 | Verify `approve-test-plan` command registers in CLI dispatch | unit | automated | US-004 | `cli.ts` imports `runApproveTestPlan` and dispatches `approve test-plan` subcommand correctly. |
| TC-017 | Verify `approve-test-plan` requires `test_plan.status` to be `pending_approval` | unit | automated | US-004 | Command throws when `test_plan.status` is not `pending_approval`. |
| TC-018 | Verify `parseTestPlan()` extracts objects from markdown tables with correct field mapping | unit | automated | US-004, FR-2 | Parser converts table rows into objects with `id`, `description`, `status`, and `correlatedRequirements`; correctly splits automated vs. manual tests based on Mode column. |
| TC-019 | Verify parser initializes all statuses to `pending` | unit | automated | US-004, FR-4 | All test items have `status: "pending"` and `overallStatus` is set to `"pending"` upon parsing. |
| TC-020 | Verify parser normalizes requirement IDs and filters invalid entries | unit | automated | US-004, FR-2 | Requirement IDs are uppercased (e.g., `us-004` → `US-004`) and entries not matching `US-XXX` or `FR-X` patterns are excluded. |
| TC-021 | Verify full approve flow: parse markdown, validate schema, and update state | integration | automated | US-004, FR-1, FR-2, FR-4 | Running approve on a valid markdown produces a `it_XXXXXX_TP.json` that validates against `TestPlanSchema`; state updates `test_plan.status` to `created`, `tp_generation.status` to `created`, and records the JSON file path. **Note:** The `write-json` subprocess is mocked; schema validation is performed in-process by the test. The full production `write-json` path is only exercised by TC-023 (manual e2e). |
| TC-022 | Verify parser extracts `scope` and `environmentData` sections from markdown | unit | automated | US-004, FR-3 | Parser reads `## Scope` bullet items into `scope` array and `## Environment and data` bullet items into `environmentData` array. **Note:** These sections are optional; iterations without them will produce empty arrays, which is schema-valid. |
| TC-023 | Manual verification of `bun nvst approve test-plan` with sample markdown | e2e | manual | US-004 | Running the command on a sample MD produces a `it_000004_TP.json` matching the new schema. This is the only test that exercises the full production path including the real `write-json` subprocess. *Justification: End-to-end verification of command behavior and file I/O.* |
| TC-024 | Verify parser handles rows where all requirement IDs are invalid | unit | automated | US-004, FR-2 | When a table row contains only invalid requirement IDs (e.g., `GARBAGE, INVALID`), the resulting `correlatedRequirements` array is empty. The test asserts this edge case is detected — either the row is excluded or downstream validation rejects it. **Known limitation:** The current schema (`z.array(z.string())`) accepts empty arrays; if non-empty enforcement is desired, the schema must add `.min(1)`. |
| TC-025 | Verify `approve-test-plan` rejects markdown with zero valid test table rows | integration | automated | US-004, FR-2 | When the input markdown contains no valid test table rows (e.g., missing table header or all rows malformed), `runApproveTestPlan` must throw an error or reject the approval rather than producing a functionally empty `TP.json` with zero test items. |
| TC-026 | Verify `parseTestPlan` and `parseTestPlanForValidation` produce identical output | unit | automated | US-004, US-002 | Given the same markdown input, both `parseTestPlan` (approve-test-plan.ts) and `parseTestPlanForValidation` (create-test-plan.ts) return identical JSON structures. **Note:** These functions are currently duplicated; this test guards against divergence. Consolidation into a shared function is recommended as future technical debt reduction. |

## Scope

- Schema updates to `TestPlanSchema` (new object-based structure with `overallStatus`, `scope`, `environmentData`, `automatedTests`, `exploratoryManualTests`)
- CLI command registration and dispatch for `create test-plan` and `approve test-plan`
- Markdown-to-JSON parser logic (`parseTestPlan`, `parseTestPlanForValidation`)
- Requirement traceability enforcement (FR-2) through `correlatedRequirements` arrays
- State machine transitions (`test_plan.status`, `tp_generation.status`)
- SKILL.md content and automation-first instruction validation

## Environment and data

- Runtime: Bun (latest stable)
- Test framework: `bun:test`
- File system access required for reading SKILL.md, cli.ts, markdown test plan files, and writing JSON output
- State file: `.agents/state.json` (mocked in unit/integration tests)
- Test fixtures: inline markdown strings containing test plan tables with valid, invalid, and edge-case requirement IDs
