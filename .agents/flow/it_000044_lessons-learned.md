# Lessons Learned — Iteration 000044

## US-001 — Run `define requirement` multiple times

**Summary:** Changed `phases.define.requirement_definition` from a single object `{ status, file }` to an array of `{ index, status, file }` entries. Each `nvst define requirement` run appends a new entry with a 3-digit padded filename suffix (e.g., `_001.md`, `_002.md`). A guardrail blocks the command when any entry is `approved`, bypassed with `--force`.

**Key Decisions:**
- Used `z.preprocess` in the Zod schema to auto-migrate legacy state files from `{ status, file }` to `[{ index: 1, status, file }]` on read — no manual migration script needed.
- Empty array `[]` is the new initial state (replacing `{ status: "pending", file: null }`).
- `auto.ts` now checks `requirementDefinitions.some(e => e.status === "approved")` instead of `requirementDefinition.status === "approved"`.
- `approve-requirement.ts` and `refine-requirement.ts` target the last `in_progress` entry via `.reverse().find(e => e.status === "in_progress")`.
- Added `readLineFn?: ReadLineFn` to `DefineRequirementOptions` so tests can inject a mock readline without touching stdin — consistent with the injectable-deps pattern used by `runAuto`.

**Pitfalls Encountered:**
- `tsconfig.json` excludes `tests/` from type checking (`include: ["src/**/*.ts"]`), so test files that passed old `{ status, file }` objects as `State` silently compiled but failed at runtime with `undefined is not a function` when `.some()` was called. Always run `bun test` (not just `bun tsc`) to catch runtime failures.
- Three existing test files needed manual updates: `state.test.ts`, `write-json.test.ts`, and `it_000042_us-002-auto-requirement-guard.test.ts` — all constructed `State` objects with the old single-object format in mock helpers (`createValidState`, `makeState`).
- The `us-003-command-compatibility.test.ts` writes state as `unknown` JSON directly to disk and reads it back through `readState` (which applies the preprocess migration) — those tests required **no changes**.

**Useful Context for Future Agents:**
- The `RequirementDefinitionEntrySchema` and `RequirementDefinitionEntry` type are now exported from `src/schemas/tmpl_state.ts` for use by other modules.
- Any command that previously read `state.phases.define.requirement_definition.status` must now use array helpers (`.some()`, `.find()`, etc.).
- The `z.preprocess` migration is idempotent: arrays pass through unchanged; legacy objects are wrapped in a one-element array with `index: 1`.
- State initialised by `start-iteration.ts` now uses `requirement_definition: []` — tests that check the freshly-initialised define phase should expect an empty array, not the old `{ status: "pending", file: null }`.
