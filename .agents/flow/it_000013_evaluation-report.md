# Evaluation Report — Iteration 000013

## Strengths

- All three new commands (`define-refactor-plan`, `refine-refactor-plan`, `approve-refactor-plan`) use the constructor-injected dependencies (DI) pattern — `invokeAgentFn`, `loadSkillFn`, `readFileFn`, `existsFn`, `nowFn` — making them fully unit-testable without real filesystem or process-spawning side effects.
- `parseRefactorPlan` in `approve-refactor-plan.ts` correctly handles multi-line field continuations, case-insensitive section/field matching, and mixed-case `RI-NNN` ids (uppercased on capture).
- `RefactorPrdSchema` is correctly registered in `write-json.ts`'s `SCHEMA_REGISTRY` so `nvst write-json --schema refactor-prd` resolves immediately.
- CLI routing in `src/cli.ts` mirrors the existing `define`, `refine`, `approve` verb pattern and covers all three new subcommands with proper unknown-arg rejection.
- `plan-refactor/SKILL.md` clearly structures the two-part session (evaluation → plan), specifies concrete inputs/outputs, and constrains the output format to align with `RefactorPrdSchema`.
- `refine-refactor-plan/SKILL.md` correctly models both editor and challenger modes with a concise checklist.
- Tests cover happy paths, all stated error cases (wrong status, missing file, missing state field), state-mutation assertions, and prompt-context assertions.
- All three commands follow the no-`process.exit()` rule; errors set `process.exitCode = 1` and return.
- `schemas/refactor-prd.ts` is kept in sync with `scaffold/schemas/tmpl_refactor-prd.ts` (identical content).

## Technical Debt

- **`approve-requirement.ts` hardcodes `new Date()` and uses `$` shell template directly** — not injectable, so unit tests cannot assert `last_updated` values. The newer commands establish the correct pattern but it has not been back-ported. Impact: low (behaviour is correct); effort: medium to refactor.
- **Mixed schema import paths** — `approve-test-plan.ts`, `execute-test-plan.ts`, and `create-test-plan.ts` import from `../../schemas/test-plan` (the copy), while the rest of the codebase uses `../../scaffold/schemas/tmpl_*` (canonical). Both files currently have identical content, but drift is possible. Pre-existing debt extended by adding `schemas/refactor-prd.ts` as a second copy of `scaffold/schemas/tmpl_refactor-prd.ts`. Impact: maintainability risk; effort: low to align.
- **`write-json.ts` uses 4-space indentation** while every other source file uses 2-space. No formatter enforces style, so the inconsistency accumulates. Impact: cosmetic/readability; effort: trivial.
- **Dual `schemas/` directory structure without an explicit sync contract** — `scaffold/schemas/` holds the canonical `tmpl_*` templates; `schemas/` holds renamed copies. There is no Makefile target, test, or CI step to detect drift. Impact: latent correctness risk when schemas evolve; effort: medium to enforce.

## Violations of PROJECT_CONTEXT.md

- **`define-refactor-plan.ts` deviates from US-001-AC01**: AC01 specifies "Command is rejected if `current_phase !== 'refactor'`." The implementation additionally accepts `current_phase === "prototype"` and auto-transitions state to `"refactor"` before proceeding. This is a useful UX improvement but it contradicts the literal acceptance criterion and is neither documented in the PRD nor in a code comment.
- **`define-refactor-plan.test.ts` `seedState` seeds `evaluation_report.status = "created"` by default**: The evaluation report should start as `"pending"` (the state before `define-refactor-plan` runs). Seeding it as already `"created"` means no test covers the nominal initial state and the state transition from `pending → created` goes untested through the DI path.

## Recommendations

| # | Description | Impact | Urgency | Effort | Scope |
|---|-------------|--------|---------|--------|-------|
| 1 | Fix `define-refactor-plan.test.ts` `seedState` to seed `evaluation_report.status` as `"pending"` instead of `"created"`, and add a test assertion that it transitions to `"created"` after a successful run. | Test correctness | High | Low | `src/commands/define-refactor-plan.test.ts` |
| 2 | Document the `prototype → refactor` auto-transition in `define-refactor-plan.ts` — either add an inline comment explaining the rationale, or update the PRD AC01 to reflect the accepted behaviour. | Spec clarity | Medium | Very low | `src/commands/define-refactor-plan.ts` + optional PRD note |
| 3 | Migrate `create-test-plan.ts`, `approve-test-plan.ts`, and `execute-test-plan.ts` imports from `../../schemas/test-plan` to `../../scaffold/schemas/tmpl_test-plan`. Remove or deprecate the `schemas/` copies. | Maintainability | Low | Low | `src/commands/create-test-plan.ts`, `approve-test-plan.ts`, `execute-test-plan.ts` |
| 4 | Apply the DI injection pattern (`nowFn`, `invokeWriteJsonFn`) to `approve-requirement.ts` for consistency with the newer commands. | Testability | Low | Medium | `src/commands/approve-requirement.ts` |
| 5 | Enforce the `scaffold/schemas/` → `schemas/` sync via a CI check or script, or consolidate to a single canonical location. | Correctness risk | Low | Medium | `schemas/`, `scaffold/schemas/` |
| 6 | Fix `write-json.ts` indentation to 2-space to match the rest of the codebase. | Readability | Low | Very low | `src/commands/write-json.ts` |
