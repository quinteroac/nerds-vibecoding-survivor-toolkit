# Refactor Plan — Iteration 000013

## Refactor Items

### RI-001: Fix test fixture initial state in define-refactor-plan tests

**Description:** `seedState` in `define-refactor-plan.test.ts` seeds `evaluation_report.status` as `"created"` instead of `"pending"`. The command under test is responsible for transitioning that status from `"pending"` to `"created"`, so tests never exercise the nominal starting condition and the `pending → created` transition is invisible to the test suite.

**Rationale:** This is the highest-priority item because it is an outright test fixture bug: the happy-path test asserts the post-run value of `evaluation_report.status` (`"created"`) against a state that was already seeded as `"created"`, making the assertion vacuously true. Fixing this closes a real gap in test correctness with minimal effort.

---

### RI-002: Document (or align) the prototype → refactor auto-transition in define-refactor-plan

**Description:** `define-refactor-plan.ts` accepts `current_phase === "prototype"` and silently transitions state to `"refactor"` before proceeding, but US-001-AC01 says the command must reject if `current_phase !== "refactor"`. The behaviour and the spec are inconsistent, and there is no code comment explaining the design decision.

**Rationale:** A one-line comment or a small PRD note costs almost nothing and prevents future contributors from reverting the auto-transition as a "bug fix". Resolving the spec ambiguity is a quick win that improves long-term confidence in the codebase without any logic change.

---

### RI-003: Fix write-json.ts indentation to 2-space

**Description:** `src/commands/write-json.ts` uses 4-space indentation throughout, while every other file in `src/` uses 2-space. The project has no enforced formatter, so the inconsistency is only visible on manual inspection or diff review.

**Rationale:** Trivial effort (mechanical find-and-replace) that eliminates a persistent readability inconsistency. Addressed now while the file is already in scope for this iteration's testing work, avoiding further accumulation.

---

### RI-004: Migrate test-plan imports from schemas/ to scaffold/schemas/

**Description:** `create-test-plan.ts`, `approve-test-plan.ts`, and `execute-test-plan.ts` import from `../../schemas/test-plan` (the copy directory), while all other commands use `../../scaffold/schemas/tmpl_*` (the canonical template directory). The two files are currently identical, but there is no mechanism to detect or prevent drift.

**Rationale:** Low effort, low risk migration that removes an implicit duplication contract. Once these imports point to the canonical location, the `schemas/test-plan.ts` copy becomes unused and can be removed, leaving a single source of truth.

---

### RI-005: Apply DI injection pattern to approve-requirement.ts

**Description:** `approve-requirement.ts` hardcodes `new Date().toISOString()` and the `$` shell template for `write-json` invocation. Unlike the newer approve commands (`approve-test-plan`, `approve-refactor-plan`), this command cannot have its `last_updated` output deterministically asserted in unit tests.

**Rationale:** The DI pattern is now established as the project standard for approve commands. Back-porting it to `approve-requirement.ts` completes the consistency and closes a testability gap for the oldest approve command. Effort is medium (extract the `$` call into a helper, add `nowFn`, thread through tests), but the payoff is a fully deterministic unit test.

---

### RI-006: Add CI sync-check for scaffold copies (schemas and skills)

**Description:** Two pairs of directories must stay in sync with their canonical scaffold originals, but no automated check currently enforces this:

- **Schemas:** `scaffold/schemas/tmpl_*.ts` (canonical) ↔ `schemas/*.ts` (working copies used by a subset of commands).
- **Skills:** `scaffold/.agents/skills/` (canonical) ↔ `.agents/skills/` (working copies).

The resolution approach is a **CI sync-check script** (not consolidation): a Makefile target or test that diffs each working copy against its scaffold original and fails the build if any content diverges. Both pairs are in scope for the same script.

**Rationale:** The risk is currently low (copies are identical in both cases) but grows with every schema or skill change. A CI check installs a permanent safety net without requiring a migration of all import paths or consumer directories. Covering both pairs in the same script avoids introducing a third location for drift to hide. This is lower urgency than the correctness and consistency items above, but establishing the contract now prevents future hard-to-diagnose mismatches in both schemas and skill definitions.
