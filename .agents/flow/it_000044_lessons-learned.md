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

## US-003 — `create prototype` iterates over all PRDs and their user stories

**Summary:** Refactored `runCreatePrototype` to process every approved PRD in sequence (PRD1→UC1…UCn, PRD2→UC1…UCn, …). Changed `state.phases.prototype.prototype_creation` from a single `{status, file}` object to an array of `{index, status, file}` entries. Extracted `parsePrd` from `approve-requirement.ts` into a new shared module `src/prd-parser.ts`. Per-PRD progress files now use naming `it_XXXXXX_prototype-creation_NNN.json`.

**Key Decisions:**
- **Backward-compat file existence check**: the primary path (markdown files) is only used when the markdown files actually exist on disk. If they don't exist (old state or tests that only provide JSON), the code falls back to the JSON PRD. This avoids breaking existing compat tests that set up `requirement_definition` entries without providing the actual markdown files.
- **z.preprocess does NOT fire for injected state**: Tests that inject state via `readStateFn` bypass `StateSchema.safeParse()`, so the array migration never runs. `audit-prototype.ts` and `create-prototype.ts` both defensively handle both the legacy object format and the new array format using `Array.isArray()`.
- **`prd_generation` left as single object**: US-002 tests assert `prd_generation.file === "it_000044_PRD.json"` and count `invokeWriteJsonFn` calls. Changing `prd_generation` to an array would have broken those tests. The multi-PRD content is instead derived from `requirement_definition` markdown files directly.
- **`start-iteration.ts` initialises with `[]`**: New iterations start with an empty array, consistent with the schema.

**Pitfalls Encountered:**
- `parsePrd` uses regex `US-\d+` to match user story IDs. Test markdown that used non-standard IDs like `US-A01` silently produced empty `userStories`, causing the command to exit early with "No pending or failed user stories". Always use `US-\d+` format in test PRD markdown.
- AC04 tests passed even when stories were empty because `writeJsonArtifactFn` is invoked unconditionally before the eligibility check, but AC01/AC03 tests failed. This asymmetry made the root cause non-obvious.

**Useful Context for Future Agents:**
- `src/prd-parser.ts` is the shared parser for PRD markdown. Both `approve-requirement` and `create-prototype` use it. If the markdown format changes, update both the parser and the test fixtures.
- The `WriteJsonArtifactFn` mock `async () => {}` is a no-op — progress JSON is never written to disk in tests. The code compensates by keeping `progressData` in memory. Tests that check file paths use `writtenPaths` captured in the mock closure, not real disk reads.
- The pre-existing failure `US-003-AC08a: nvst approve requirement runs without error` (in `us-003-command-compatibility.test.ts`) was present before this iteration and is unrelated to US-003.

## US-004 — `audit prototype` produces one audit report per PRD

**Summary:** Changed `audit-prototype` to iterate over each `requirement_definition` entry and invoke the agent once per PRD, producing `it_XXXXXX_audit-report_NNN.json` per PRD. `prototype_audit` in state.json is now a `PrototypeAuditEntry[]` array (with preprocess migration from the legacy single-object format). `refactor-prototype` was updated to handle both the new array and legacy single-object formats.

**Key Decisions:**
- Followed the same `z.preprocess` migration pattern already used for `requirement_definition` and `prototype_creation` — the legacy `{ status, file }` single object is auto-migrated to `[{ index: 1, status, file }]` on `readState`.
- Added defensive legacy-format handling **inside the commands** (not just schema) because many existing tests inject state directly, bypassing `readState` and schema migration. This avoids a cascade of test updates and mirrors the existing `auditAllowed` pattern for `prototype_creation`.
- `start-iteration.ts` initialises `prototype_audit` as `[]` (empty array) instead of the old `{ status: "pending", file: null }` object.
- The `refactor-prototype` artifact lookup was updated to first scan state's `prototype_audit` entries for resolved file paths, then fall back to the legacy `it_XXXXXX_audit.json` / `it_XXXXXX_audit.md` naming — preserving backward compatibility.

**Pitfalls Encountered:**
- `bun tsc --noEmit` only covers `src/` (not `tests/`), so test files can use legacy state shapes without TypeScript errors. Relying on `bun tsc` alone is insufficient to verify test compatibility.
- The auto-mode directive in `audit-prototype` now includes the actual resolved filename (e.g., `it_000042_audit-report_001.json`) instead of the old template string (`it_{iteration}_audit.json`). One existing test (`it_000042_us-001-auto-pipeline.test.ts`) was asserting on the old template string and needed to be updated.
- AC08a in `us-003-command-compatibility.test.ts` was already failing before this iteration — confirmed by stashing changes and running the baseline.

**Useful Context for Future Agents:**
- When adding a new array-format field that replaces a legacy single-object field in the schema, always: (1) add `z.preprocess` migration in `tmpl_state.ts`, (2) update `start-iteration.ts` to initialise with `[]`, (3) add defensive Array.isArray handling in any command that accesses the field if many existing tests inject state directly.
- The audit report naming convention is `it_XXXXXX_audit-report_NNN.json` where NNN is the zero-padded PRD index. The old `it_XXXXXX_audit.json` format is kept as a fallback in `refactor-prototype` only.
- Test files are NOT in the tsconfig `include`, so TypeScript errors in tests are only caught at bun test runtime, not by `bun tsc --noEmit`.

## US-005 — `refactor prototype` runs one refactor pass per audit report

**Summary:** Extended `runRefactorPrototype` to iterate over all audit entries in state, run one agent pass per entry, name refactor artifacts `it_XXXXXX_refactor-plan_001.md` / `_002.md` etc., and persist an array of `PrototypeRefactorEntry` objects back to `state.json` under `phases.prototype.prototype_refactor`.

**Key Decisions:**
- `prototype_refactor` in `tmpl_state.ts` was migrated from a single `statusFile` object to an array (`prototypeRefactorField`), following the exact same `z.preprocess` auto-migration pattern used for `prototype_audit` and `prototype_creation`.
- `start-iteration.ts` initialises `prototype_refactor` as `[]` (empty array) to match the new type.
- `runRefactorPrototype` now has a `writeStateFn` dep (like `audit-prototype`) to persist state after all passes.
- The SKILL.md was updated to document `refactor_plan_file` and `refactor_plan_index` context variables so agents know the expected output artifact name.
- Legacy fallback (to `it_XXXXXX_audit.json` / `it_XXXXXX_audit.md`) is preserved when there is a single audit entry with no file tracked in state.

**Pitfalls Encountered:**
- The actual `.agents/state.json` on disk is read by some integration tests that don't inject `readStateFn`. If any test writes to it (via `writeState`), subsequent tests fail. Always restore the file (`git checkout -- .agents/state.json`) between test runs.
- `bun tsc --noEmit` only type-checks `src/`; TypeScript errors in `tests/` are NOT caught by the typecheck script (they're caught at bun test runtime).
- The `nvst-skills-manifest.ts` is auto-generated from SKILL.md files — always run `bun run generate:nvst-skills-manifest` after modifying a SKILL.md.

**Useful Context for Future Agents:**
- Refactor artifact naming convention: `it_XXXXXX_refactor-plan_NNN.md` where NNN is the zero-padded audit entry index.
- `prototype_refactor` is now `PrototypeRefactorEntry[] | undefined` (not a single object). The preprocessor auto-migrates legacy `{ status, file }` objects.
- The `refactorAllowed()` guard still supports the legacy single-object format for tests that bypass `readState`.

## US-006 — Backward compatibility — single-PRD iterations continue to work

**Summary:** Added a dedicated test suite verifying that legacy `requirement_definition` single-object `{ status, file }` format is auto-migrated to `[{ index: 1, status, file }]` by the Zod schema's `z.preprocess` on `readState()`. All commands already receive a typed array from the schema, so no production code changes were needed.

**Key Decisions:**
- The migration was already implemented in `src/schemas/tmpl_state.ts` via `z.preprocess`. This story's contribution was test coverage proving it works end-to-end (through `readState`) and at the schema level (via `StateSchema.safeParse`).
- Kept `audit-prototype.ts`'s `Array.isArray` defensive guard unchanged — it is technically dead code since the TypeScript type always gives an array, but removing it is out of scope for this story.

**Pitfalls Encountered:**
- No production code pitfalls — the migration logic was already correct. The main task was writing tests that exercised the path (writing raw JSON with legacy shape to disk, then calling `readState`).

**Useful Context for Future Agents:**
- `z.preprocess` in the schema guarantees all four state fields (`requirement_definition`, `prototype_creation`, `prototype_audit`, `prototype_refactor`) produce arrays even when reading legacy single-object state files.
- Tests for migration must write raw JSON directly (bypassing `writeState`) to simulate a legacy file — do not use `writeState` to write legacy format as it will serialize the TypeScript array form.
- The `audit-prototype.ts` `Array.isArray` guard (lines 73–83) is a noop at runtime and can be removed in a future cleanup iteration.

## US-007 — `auto` mode supports multi-PRD flow

**Summary:** Implemented test coverage for the `nvst auto` command operating over multi-PRD state. The existing `runAuto` implementation was already correct — it calls `runCreatePrototype`, `runAuditPrototype`, and `runRefactorPrototype` once each, and those commands internally iterate over all PRD entries. No production code changes were needed.

**Key Decisions:**
- The "loop through all PRD entries" described in AC01 is fulfilled collectively by the phase commands, each of which iterates over all PRD entries in a single call. `auto.ts` dispatches the three phases in sequence; the multi-PRD loop lives inside each command.
- Each phase command is called exactly once per `runAuto` invocation regardless of PRD count; the per-PRD iteration is encapsulated inside `runCreatePrototype`, `runAuditPrototype`, and `runRefactorPrototype`.
- Added tests covering: 2-PRD and 3-PRD states, mixed-status states (some approved, some in_progress), failure propagation (create/audit failure stops the pipeline), and option forwarding (provider, force, yolo, interactive: false).

**Pitfalls Encountered:**
- When testing `GuardrailAbortError` (relaxed mode + 'n' response), the guardrail sets `process.exitCode = 1`. Restoring `process.exitCode = originalExitCode` where `originalExitCode` is `undefined` does NOT reset the exit code to 0 in Bun. Must use `process.exitCode = originalExitCode ?? 0` to explicitly restore to zero.

**Useful Context for Future Agents:**
- Any test that expects `rejects.toBeInstanceOf(GuardrailAbortError)` must save and restore `process.exitCode` using `process.exitCode = originalExitCode ?? 0` (not just `process.exitCode = originalExitCode`) to prevent the bun test runner from exiting with code 1.
- The guardrail check in `auto.ts` uses `requirementDefinitions.some(e => e.status === "approved")` — the pipeline runs as long as at least one PRD is approved. PRDs that are still `in_progress` or `pending` are passed through to the phase commands, which apply their own per-PRD filtering.
- No additional `prdIndex` parameter is needed on the phase command option types for multi-PRD support — each command reads state itself and determines which entries to process.
