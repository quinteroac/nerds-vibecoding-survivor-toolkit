# Refactor Plan — Iteration 000018

## Refactor Items

### RI-001: Extract shared `defaultReadLine` into a reusable module

**Description:** `src/guardrail.ts` and `src/commands/create-prototype.ts` contain identical `defaultReadLine` implementations (same logic, same `settled` guard, same readline setup). Extract the shared function to `src/readline.ts` and replace both inline copies with an import.

**Rationale:** This is the highest-priority item because it represents silent latent debt: a future bug fix in one copy will silently diverge from the other. Extracting it eliminates the duplication, aligns with the modular structure mandated by PROJECT_CONTEXT.md, and is low-effort relative to its impact.

---

### RI-002: Add confirm-path test for define→prototype dirty-tree transition

**Description:** A unit test exists for declining the dirty-tree prompt during the define→prototype phase transition, but there is no test for the confirmation path at that same site. Add a test that provides a `confirmDirtyTreeCommitFn` returning `true`, verifies `gitAddAndCommitFn` is called with the correct commit message, and asserts that the state transitions to `prototype`.

**Rationale:** The absence of this test leaves a regression gap for one of the two dirty-tree check sites introduced in this iteration. Adding it is a low-effort, medium-impact quality improvement that ensures parity of coverage between the two check sites.

---

### RI-003: Rename `confirmDirtyTreeCommitFn` to `promptDirtyTreeCommitFn` in `CreatePrototypeDeps`

**Description:** The `CreatePrototypeDeps` interface field is named `confirmDirtyTreeCommitFn`, while the exported implementation function is `promptForDirtyTreeCommit`. The rest of the codebase names interface fields after their default implementations. Rename the interface field (and all usages) to `promptDirtyTreeCommitFn` to eliminate the "confirm" vs "prompt" inconsistency.

**Rationale:** Naming consistency reduces cognitive friction when reading the code and aligns with existing conventions. Very low effort.

---

### RI-004: Merge split `node:fs/promises` imports in test file

**Description:** `create-prototype.test.ts` has two separate `import` statements from `node:fs/promises` (lines 3–4). Merge them into a single statement to follow the single-import-per-module convention used throughout the rest of the test files.

**Rationale:** Purely a style issue with no runtime impact. Very low effort and keeps the file consistent with the rest of the test suite.
