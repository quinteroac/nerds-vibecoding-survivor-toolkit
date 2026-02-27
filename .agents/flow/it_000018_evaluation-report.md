# Evaluation Report — Iteration 000018

## Strengths

- **Both dirty-tree check sites correctly replaced**: Both the phase-transition block (define→prototype) and the post-transition block (prototype phase) now use the interactive prompt instead of hard errors, satisfying FR-3 and FR-4.
- **DI pattern maintained and extended cleanly**: `confirmDirtyTreeCommitFn` and `gitAddAndCommitFn` are properly added to `CreatePrototypeDeps`, and all existing tests continue to pass with injected mocks.
- **Non-interactive TTY guard implemented correctly**: `promptForDirtyTreeCommit` returns `false` immediately when `isTTYFn()` is false, satisfying FR-6 without hanging.
- **Correct commit message format**: `chore: pre-prototype commit it_<iteration>` (FR-5) is used consistently.
- **Clean decline path**: On decline, `process.exitCode` is not set to 1, no exception is thrown, and no state changes are written (US-003 fully satisfied).
- **`runPrePrototypeCommit` is exported and independently testable**: Allows the git-commit behaviour to be unit-tested without running the full `runCreatePrototype` flow.
- **Comprehensive test suite**: Tests cover all four user stories: confirm path, decline path, git-commit failure path, TTY detection, and the `promptForDirtyTreeCommit` unit in isolation.

## Technical Debt

### TD-001: Duplicated `defaultReadLine` implementation
`src/guardrail.ts` (lines 21–41) and `src/commands/create-prototype.ts` (lines 95–115) contain functionally identical `defaultReadLine` implementations — same logic, same `settled` guard, same readline setup. Any future bug fix or behavioural change in one copy will silently diverge from the other.
- **Impact**: Medium (latent maintenance risk; correctness divergence over time)
- **Effort**: Low (extract to a shared module, update both imports)

### TD-002: Missing confirm-path test for define→prototype transition
A test verifies that declining during the define→prototype dirty-tree check aborts correctly, but there is no corresponding test that confirms (returns `true`) at that same check site and verifies the phase transition completes. The analogous test exists only for the post-transition (prototype-phase) block.
- **Impact**: Medium (silent regression risk in the first dirty-tree check site)
- **Effort**: Low (add one test following the existing pattern)

### TD-003: Split `node:fs/promises` imports in test file
`create-prototype.test.ts` imports from `node:fs/promises` across two separate `import` statements (lines 3–4), violating the single-import-per-module convention the rest of the test files follow.
- **Impact**: Low (style only)
- **Effort**: Very low (merge into one import statement)

## Violations of PROJECT_CONTEXT.md

- **Modular structure — no shared readline utility**: PROJECT_CONTEXT.md mandates that code is kept modular with reusable helpers placed in appropriate modules. The `defaultReadLine` function is identical in `src/guardrail.ts` and `src/commands/create-prototype.ts`; this violates the single-responsibility, modular structure expectation.

- **Naming inconsistency between interface field and implementation**: The deps interface field is `confirmDirtyTreeCommitFn` while the exported implementation function is `promptForDirtyTreeCommit`. The rest of the codebase names interface fields after their default implementations (e.g. `invokeAgentFn` → `invokeAgent`, `loadSkillFn` → `loadSkill`, `logFn` → `console.log`). The mismatch ("confirm" vs "prompt") adds cognitive overhead.

## Recommendations

| # | Description | Impact | Urgency | Effort | Scope |
|---|-------------|--------|---------|--------|-------|
| R-01 | Extract shared `defaultReadLine` to `src/readline.ts` (or expose from `guardrail.ts`) and import in both `guardrail.ts` and `create-prototype.ts` | Medium | Medium | Low | `src/guardrail.ts`, `src/commands/create-prototype.ts`, new `src/readline.ts` |
| R-02 | Add a confirm-path end-to-end test for the define→prototype transition dirty-tree check | Medium | Medium | Low | `src/commands/create-prototype.test.ts` |
| R-03 | Rename `confirmDirtyTreeCommitFn` in the deps interface to `promptDirtyTreeCommitFn` to match the exported implementation name | Low | Low | Very low | `src/commands/create-prototype.ts` and its test file |
| R-04 | Merge split `node:fs/promises` imports in `create-prototype.test.ts` | Low | Low | Very low | `src/commands/create-prototype.test.ts` |
