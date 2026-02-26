# Test Execution Report (Iteration 000015)

- Test Plan: `it_000015_TP.json`
- Total Tests: 20
- Passed: 20
- Failed: 0

| Test ID | Description | Status | Correlated Requirements | Artifacts |
| --- | --- | --- | --- | --- |
| TC-001 | When phase/status violation is detected and `flow_guardrail` is `"relaxed"` (no `--force`), the command prints a warning to stderr describing the violation. | passed | US-001, FR-3, FR-6 | `.agents/flow/it_000015_test-execution-artifacts/TC-001_attempt_001.json` |
| TC-002 | After the warning in relaxed mode, the command prints exactly `Proceed anyway? [y/N]` to stderr. | passed | US-001, FR-4, FR-6 | `.agents/flow/it_000015_test-execution-artifacts/TC-002_attempt_001.json` |
| TC-003 | In relaxed mode, when user enters `y` or `Y` and Enter, the command continues (no exit, no "Aborted."). | passed | US-001, FR-4 | `.agents/flow/it_000015_test-execution-artifacts/TC-003_attempt_001.json` |
| TC-004 | In relaxed mode, when user enters `n`, empty line, or other input and Enter, the command exits with `process.exitCode = 1`, prints `Aborted.` to stderr, and makes no changes to state or files. | passed | US-001, FR-4 | `.agents/flow/it_000015_test-execution-artifacts/TC-004_attempt_001.json` |
| TC-005 | In relaxed mode without `--force`, when stdin is closed or not a TTY, the command exits with code 1, prints `Aborted.` to stderr, and does not modify state or files. | passed | US-001, FR-4 | `.agents/flow/it_000015_test-execution-artifacts/TC-005_attempt_001.json` |
| TC-006 | Warning and confirmation prompt are written to stderr only; normal command output remains on stdout. | passed | US-001, FR-6 | `.agents/flow/it_000015_test-execution-artifacts/TC-006_attempt_001.json` |
| TC-007 | With `--force` and a phase/status violation, the command prints the warning to stderr but does not show the confirmation prompt and proceeds. | passed | US-002, FR-3, FR-5 | `.agents/flow/it_000015_test-execution-artifacts/TC-007_attempt_001.json` |
| TC-008 | With `--force` and `flow_guardrail` `"strict"`, a phase violation does not throw; command proceeds after warning. | passed | US-002, FR-5 | `.agents/flow/it_000015_test-execution-artifacts/TC-008_attempt_001.json` |
| TC-009 | Commands that perform phase/status validation accept `--force` in argv and forward it to `assertGuardrail`; commands without guardrail ignore unknown flags and do not exit with parse error. | passed | US-002, FR-5, FR-7 | `.agents/flow/it_000015_test-execution-artifacts/TC-009_attempt_001.json` |
| TC-010 | `StateSchema` in `scaffold/schemas/tmpl_state.ts` accepts optional top-level `flow_guardrail: z.enum(["strict", "relaxed"]).optional()`; existing fields unchanged. | passed | US-003, FR-1 | `.agents/flow/it_000015_test-execution-artifacts/TC-010_attempt_001.json` |
| TC-011 | The schema copy in `schemas/` matches the `flow_guardrail` definition in `scaffold/schemas/tmpl_state.ts`. | passed | US-003, FR-8 | `.agents/flow/it_000015_test-execution-artifacts/TC-011_attempt_001.json` |
| TC-012 | When `flow_guardrail` is `"strict"` and a violation is detected (no `--force`), the command throws an `Error` with the same message as before (no prompt). | passed | US-003, FR-2, FR-3 | `.agents/flow/it_000015_test-execution-artifacts/TC-012_attempt_001.json` |
| TC-013 | When `flow_guardrail` is absent, behavior defaults to `"strict"` (hard error, no prompt). | passed | US-003, FR-2 | `.agents/flow/it_000015_test-execution-artifacts/TC-013_attempt_001.json` |
| TC-014 | Existing `state.json` without `flow_guardrail` parses successfully. | passed | US-003, FR-1 | `.agents/flow/it_000015_test-execution-artifacts/TC-014_attempt_001.json` |
| TC-015 | A new exported function (e.g. `assertGuardrail(state, condition, message, options: { force: boolean })`) exists in `src/guardrail.ts`. | passed | US-004, FR-3 | `.agents/flow/it_000015_test-execution-artifacts/TC-015_attempt_001.json` |
| TC-016 | `assertGuardrail`: when effective mode is strict and `force` is false, it throws. | passed | US-004, FR-3 | `.agents/flow/it_000015_test-execution-artifacts/TC-016_attempt_001.json` |
| TC-017 | `assertGuardrail`: when effective mode is relaxed and `force` is false, it writes warning and prompt to stderr and (when stdin confirms) does not throw; when stdin denies, caller exits with code 1. | passed | US-004, FR-3, FR-4 | `.agents/flow/it_000015_test-execution-artifacts/TC-017_attempt_001.json` |
| TC-018 | `assertGuardrail`: when `force` is true, it writes warning to stderr and does not prompt; does not throw. | passed | US-004, FR-3 | `.agents/flow/it_000015_test-execution-artifacts/TC-018_attempt_001.json` |
| TC-019 | Commands `define-requirement`, `create-prototype`, `execute-refactor`, `define-refactor-plan` (and any other with phase guard) call `assertGuardrail` for phase/status checks and do not inline `throw new Error(...)` for phase guards. | passed | US-004, FR-7 | `.agents/flow/it_000015_test-execution-artifacts/TC-019_attempt_001.json` |
| TC-020 | No command retains an inline phase-guard `throw`; all phase violations route through `assertGuardrail`. | passed | US-004, FR-7 | `.agents/flow/it_000015_test-execution-artifacts/TC-020_attempt_001.json` |

