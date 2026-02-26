# Test Plan - Iteration 000015

## Scope

- Flow guardrail behavior: schema field `flow_guardrail` (optional `"strict"` | `"relaxed"`), default `"strict"`, and its effect on phase/status violations.
- Shared utility `assertGuardrail` in `src/guardrail.ts`: throw (strict, no force), warn+prompt (relaxed, no force), warn+skip (force).
- Relaxed mode: warning and confirmation prompt on stderr; only `y`/`Y` continues; otherwise exit code 1 and "Aborted." with no state/file changes; non-TTY/closed stdin treated as no confirmation.
- `--force` flag: accepted by all phase-guarded commands; bypasses confirmation and (in strict mode) the check; warning still printed to stderr.
- All phase-guarded commands (`define-requirement`, `create-prototype`, `execute-refactor`, `define-refactor-plan`, and any other with phase guard) use `assertGuardrail` only; no inline phase-guard throws.
- Schema parity: `schemas/` copy mirrors `scaffold/schemas/tmpl_state.ts` for `flow_guardrail`.

## Environment and data

- Bun runtime (v1+); TypeScript strict mode; no build step (Bun runs `.ts` directly).
- Valid `.agents/state.json` (with/without `flow_guardrail`; with `"strict"` or `"relaxed"` as needed).
- Isolated state fixtures or temp dirs for phase/status violation scenarios (e.g. wrong `current_phase` / `current_status` for the command under test).
- Stdin controllable (e.g. piped input or mock) for confirmation flows; non-TTY simulation for "Aborted." behavior.

## User Story: US-001 - Warning and confirmation instead of error

| Test Case ID | Description | Type (unit/integration/e2e) | Mode (automated/manual) | Correlated Requirements (US-XXX, FR-X) | Expected Result |
|---|---|---|---|---|---|
| TC-001 | When phase/status violation is detected and `flow_guardrail` is `"relaxed"` (no `--force`), the command prints a warning to stderr describing the violation. | unit | automated | US-001, FR-3, FR-6 | Warning text appears on stderr (e.g. current_phase/required phase); stdout unchanged. |
| TC-002 | After the warning in relaxed mode, the command prints exactly `Proceed anyway? [y/N]` to stderr. | unit | automated | US-001, FR-4, FR-6 | Prompt string present on stderr. |
| TC-003 | In relaxed mode, when user enters `y` or `Y` and Enter, the command continues (no exit, no "Aborted."). | integration | automated | US-001, FR-4 | Command completes with exit code 0; no "Aborted." on stderr. |
| TC-004 | In relaxed mode, when user enters `n`, empty line, or other input and Enter, the command exits with `process.exitCode = 1`, prints `Aborted.` to stderr, and makes no changes to state or files. | integration | automated | US-001, FR-4 | exitCode 1; "Aborted." on stderr; state and relevant files unchanged. |
| TC-005 | In relaxed mode without `--force`, when stdin is closed or not a TTY, the command exits with code 1, prints `Aborted.` to stderr, and does not modify state or files. | integration | automated | US-001, FR-4 | exitCode 1; "Aborted." on stderr; no state/file changes. |
| TC-006 | Warning and confirmation prompt are written to stderr only; normal command output remains on stdout. | unit | automated | US-001, FR-6 | No guardrail text on stdout; stderr contains warning and prompt. |

## User Story: US-002 - `--force` flag bypasses confirmation prompt

| Test Case ID | Description | Type (unit/integration/e2e) | Mode (automated/manual) | Correlated Requirements (US-XXX, FR-X) | Expected Result |
|---|---|---|---|---|---|
| TC-007 | With `--force` and a phase/status violation, the command prints the warning to stderr but does not show the confirmation prompt and proceeds. | integration | automated | US-002, FR-3, FR-5 | Warning on stderr; no "Proceed anyway?"; command continues (exit 0 where applicable). |
| TC-008 | With `--force` and `flow_guardrail` `"strict"`, a phase violation does not throw; command proceeds after warning. | integration | automated | US-002, FR-5 | No throw; warning on stderr; command runs. |
| TC-009 | Commands that perform phase/status validation accept `--force` in argv and forward it to `assertGuardrail`; commands without guardrail ignore unknown flags and do not exit with parse error. | unit/integration | automated | US-002, FR-5, FR-7 | Guarded commands accept `--force`; unguarded commands run successfully with `--force` (no exit ≠ 0 from parsing). |

## User Story: US-003 - `flow_guardrail="strict"` restores hard-error behavior

| Test Case ID | Description | Type (unit/integration/e2e) | Mode (automated/manual) | Correlated Requirements (US-XXX, FR-X) | Expected Result |
|---|---|---|---|---|---|
| TC-010 | `StateSchema` in `scaffold/schemas/tmpl_state.ts` accepts optional top-level `flow_guardrail: z.enum(["strict", "relaxed"]).optional()`; existing fields unchanged. | unit | automated | US-003, FR-1 | `.safeParse()` succeeds for state with `flow_guardrail` "strict"/"relaxed" or absent; no field renames/removals. |
| TC-011 | The schema copy in `schemas/` matches the `flow_guardrail` definition in `scaffold/schemas/tmpl_state.ts`. | unit | automated | US-003, FR-8 | Same optional enum; parity validated by test or schema export. |
| TC-012 | When `flow_guardrail` is `"strict"` and a violation is detected (no `--force`), the command throws an `Error` with the same message as before (no prompt). | unit/integration | automated | US-003, FR-2, FR-3 | Error thrown; message matches pre-iteration behavior; no prompt. |
| TC-013 | When `flow_guardrail` is absent, behavior defaults to `"strict"` (hard error, no prompt). | unit/integration | automated | US-003, FR-2 | Violation causes throw; same as strict. |
| TC-014 | Existing `state.json` without `flow_guardrail` parses successfully. | unit | automated | US-003, FR-1 | State parse succeeds; no required `flow_guardrail`. |

## User Story: US-004 - Shared guardrail utility used by all commands

| Test Case ID | Description | Type (unit/integration/e2e) | Mode (automated/manual) | Correlated Requirements (US-XXX, FR-X) | Expected Result |
|---|---|---|---|---|---|
| TC-015 | A new exported function (e.g. `assertGuardrail(state, condition, message, options: { force: boolean })`) exists in `src/guardrail.ts`. | unit | automated | US-004, FR-3 | Module exports function with expected signature; callable from tests. |
| TC-016 | `assertGuardrail`: when effective mode is strict and `force` is false, it throws. | unit | automated | US-004, FR-3 | Throws Error with given message. |
| TC-017 | `assertGuardrail`: when effective mode is relaxed and `force` is false, it writes warning and prompt to stderr and (when stdin confirms) does not throw; when stdin denies, caller exits with code 1. | unit/integration | automated | US-004, FR-3, FR-4 | Warning + prompt on stderr; behavior matches FR-4 for y/n. |
| TC-018 | `assertGuardrail`: when `force` is true, it writes warning to stderr and does not prompt; does not throw. | unit | automated | US-004, FR-3 | Warning on stderr; no prompt; no throw. |
| TC-019 | Commands `define-requirement`, `create-prototype`, `execute-refactor`, `define-refactor-plan` (and any other with phase guard) call `assertGuardrail` for phase/status checks and do not inline `throw new Error(...)` for phase guards. | unit/integration | automated | US-004, FR-7 | No inline phase-guard throw in these modules; guardrail module is used. |
| TC-020 | No command retains an inline phase-guard `throw`; all phase violations route through `assertGuardrail`. | unit | automated | US-004, FR-7 | Grep/code scan finds no phase-guard throw outside guardrail. |

---

## Checklist

- [x] Read `it_000015_PRD.json`
- [x] Read `.agents/PROJECT_CONTEXT.md`
- [x] Plan includes **Scope** section with at least one bullet
- [x] Plan includes **Environment and data** section with at least one bullet
- [x] Test cases are grouped by user story
- [x] Every `FR-N` (FR-1 through FR-8) is covered by automated test cases
- [x] Every test case includes correlated requirement IDs (`US-XXX`, `FR-X`)
- [x] Manual tests: none required; all cases can be validated via assertions on exit code, stderr/stdout, state, and code structure
- [x] File written to `.agents/flow/it_000015_test-plan.md`
