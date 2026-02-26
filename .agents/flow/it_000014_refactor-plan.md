# Refactor Plan — Iteration 000014

## Refactor Items

### RI-001: Add `in_progress` to refactor progress entry status

**Description:** The progress file schema and logic currently use only `"pending" | "completed" | "failed"` for each entry. FR-4 specifies `"pending" | "in_progress" | "completed" | "failed"`. Extend `RefactorExecutionProgressSchema` in `execute-refactor.ts` to include `"in_progress"`, and set the current item’s entry to `in_progress` before invoking the agent, then to `completed` or `failed` after the invocation. This aligns behaviour with the PRD and improves observability when a run is interrupted mid-item.

**Rationale:** Quick win: low effort, clear alignment with FR-4, and no behavioural break (resume and reporting already work). Prioritised first.

---

### RI-002: Align FR-6 / skill prompt variable names

**Description:** FR-6 names the prompt variables `current_iteration`, `item_id`, `item_title`, `item_description`, `item_rationale`. The implementation and the `execute-refactor-item` skill use `iteration`, `refactor_item_id`, `refactor_item_title`, `refactor_item_description`, `refactor_item_rationale`. Either update the PRD/FR wording (or iteration artifact that records FR-6) to the actual variable names, or change the code and skill to use the FR names so that documentation and implementation match.

**Rationale:** Low-effort consistency fix; avoids future confusion when reading FR-6 or modifying the skill. Second in order after the schema change.

---

### RI-003: Clarify or align progress file writes with write-json

**Description:** PROJECT_CONTEXT states that JSON file generation must be performed through `nvst write-json`. The refactor execution progress file is written via direct `writeFile` in `execute-refactor.ts` (same pattern as test execution progress in `execute-test-plan.ts`). Either document in PROJECT_CONTEXT (or a conventions doc) that internal progress/artifact JSON may be written via direct I/O and is out of scope for `write-json`, or refactor `execute-refactor` (and optionally `execute-test-plan`) to persist progress through `nvst write-json` so all JSON generation goes through one path.

**Rationale:** Resolves the PROJECT_CONTEXT violation and FR-7 wording. May require a user decision on the trade-off: documentation-only (low effort) vs. refactor to use `write-json` (medium effort, single code path for JSON). Placed after quick wins; implement after choosing the approach.

---

### RI-004: Document or refactor synchronous I/O in tests

**Description:** PROJECT_CONTEXT forbids synchronous I/O. The test files `pack.test.ts` and `install.test.ts` use `spawnSync` for process execution. Either explicitly allow sync I/O in tests (e.g. in PROJECT_CONTEXT or testing conventions), or replace these calls with async process spawning where feasible so that the prohibition applies uniformly.

**Rationale:** Long-term improvement for convention clarity and consistency. Lowest urgency; no production code is affected.
