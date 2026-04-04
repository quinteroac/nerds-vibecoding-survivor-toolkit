# Refactor Report — Iteration 000044

## Summary of changes

### RP-1 — Fix scaffold template (`scaffold/.agents/tmpl_state.json`)
Replaced the legacy single-object initialisations for the four array-typed fields with empty arrays `[]`:
- `requirement_definition`: `{ status: "pending", file: null }` → `[]`
- `prototype_creation`: `{ status: "pending", file: null }` → `[]`
- `prototype_audit`: `{ status: "pending", file: null }` → `[]`
- `prototype_refactor`: `{ status: "pending", file: null }` → `[]`

Non-array fields (`prd_generation`, `prototype_approval`) remain as single objects.

### RP-2 — Fix approve-prototype guardrail (`src/commands/approve-prototype.ts`)
Extended the `hasAuditMd / hasAuditJson / hasRefactorReport` guardrail check to also pass when:
- `state.phases.prototype.prototype_audit` is a non-empty array and every entry has `status === "completed"` (`auditCompletedViaState`)
- `state.phases.prototype.prototype_refactor` is a non-empty array and every entry has `status === "completed"` (`refactorCompletedViaState`)

Both the `effectiveHasAudit` and `effectiveHasRefactor` signals now incorporate these state-based checks, enabling multi-PRD flows to satisfy the guardrail without legacy file-based artefacts.

A defensive `Array.isArray()` check was added to handle legacy state objects that reach the function without Zod migration (e.g. in unit tests that inject state directly).

### RP-3 — Fix approve-prototype PR body refactor path (`src/commands/approve-prototype.ts`)
Replaced the hardcoded `it_${iteration}_refactor-report.md` path with paths read from `state.phases.prototype.prototype_refactor` entries:
- When the array is non-empty and has entries with non-null `file` values, those paths are joined (comma-separated) and resolved relative to `FLOW_REL_DIR`.
- Falls back to the legacy hardcoded path only when the array is empty or no entry has a file.

Same defensive `Array.isArray()` guard applied here as in RP-2.

### RP-4 — Fix backward-compat test US-003-AC08a (`tests/us-003-command-compatibility.test.ts`)
Updated the test to:
1. Pass `--force` to the CLI invocation so the new confirmation prompt is skipped (non-interactive CI context).
2. Update the expected stdout assertion from `"Requirement approved."` to `"All 1 requirement(s) approved."` to match the current output of `approve-requirement`.

## Quality checks

| Check | Command | Outcome |
|---|---|---|
| TypeScript typecheck | `bun run typecheck` | ✅ Pass — no type errors |
| Full test suite | `bun test` | ✅ 458 pass, 8 pre-existing failures (unrelated to this iteration) |

**Pre-existing failures** (all in `tests/it_000042_us-001-auto-pipeline.test.ts`):
These 8 tests fail because the real `.agents/state.json` in the working tree currently has `flow_guardrail: "off"` (an invalid enum value in the current schema) and `ideation: null`. This was confirmed to be pre-existing by stashing the refactor changes, running the same tests on the baseline, and observing identical failures. These failures are out of scope for this iteration's refactor plan.

## Deviations from refactor plan

None. All four planned items (RP-1 through RP-4) were fully applied as described in the audit JSON. A minor defensive enhancement was added on top of RP-2 and RP-3 (the `Array.isArray()` guard) to ensure robustness when state objects bypass Zod migration in unit tests — this is consistent with the intent of the refactor and does not alter observable behaviour.
