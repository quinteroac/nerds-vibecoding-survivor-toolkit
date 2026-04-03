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

## US-002 — `approve requirement` approves all pending PRDs

**Summary:** Updated `runApproveRequirement` to approve ALL `in_progress` entries in the `requirement_definition` array instead of only the last one. Added a confirmation prompt that lists all PRDs to be approved before proceeding; `--force` skips the prompt.

**Key Decisions:**
- Added `readLineFn: ReadLineFn` and `stdoutWriteFn: (msg: string) => void` to `ApproveRequirementDeps` for injectable testing of the confirmation prompt.
- Confirmation uses a simple `[y/N]` pattern (accepts `"y"` or `"Y"`); any other input or null aborts without error.
- `force: true` bypasses the confirmation prompt entirely (consistent with other commands' `--force` behaviour).
- The guardrail (`assertGuardrail`) still fires when the `inProgressEntries` array is empty — this preserves the existing "no in_progress entries" error message.
- PRD JSON is generated for each `in_progress` entry in order; the last one's filename is recorded in `prd_generation.file` (all share the same `it_XXXXXX_PRD.json` name, so each overwrites the previous, with the last entry winning).

**Pitfalls Encountered:**
- The `isDepsArg` detection guard needed to be extended to also check for `"readLineFn"` and `"stdoutWriteFn"` keys; otherwise passing a deps object with only those new fields would be misinterpreted as an opts object.
- The `optsOrDeps` dual-overload signature is tricky — when passing only `{}` (no force, no deps fields), `force` defaults to `false` and a `readLineFn` must be injected via `maybeDeps` to test the confirmation prompt.
- `process.exitCode` is set to `1` on write-json failure but the function `return`s early without throwing, so tests must reset `process.exitCode` after testing that path.

**Useful Context for Future Agents:**
- Use `stdoutWriteFn` (from deps) for all output in `runApproveRequirement` rather than `console.log` directly, so tests can capture and assert on output without real stdout.
- The `fakeWriteJsonOk` / `fakeWriteJsonFail` pattern (small inline arrow functions returning `{ exitCode, stderr }`) is the preferred way to stub `invokeWriteJsonFn` in tests for this command.
- Mixed arrays (some `approved`, some `in_progress`) are valid input — the command processes only the `in_progress` ones and leaves `approved` entries untouched.
