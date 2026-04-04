# Requirement: Multi-PRD Support Per Iteration

## Context
Currently, each NVST iteration supports exactly one Product Requirement Document (PRD). Developers who need to define multiple independent features within a single iteration must split them across separate iterations, which is wasteful. This change allows `define requirement` to be run N times per iteration, producing N PRDs, and propagates that multi-document model through every downstream phase: approve, prototype creation, audit, and refactor.

## Goals
- Allow `define requirement` to be invoked N times per iteration, each run producing a new PRD file with an `_NNN` index suffix.
- Extend `state.json` to hold an array of PRD entries, each with its own `status` and `file`.
- Propagate the multi-PRD model through `approve requirement`, `create prototype`, `audit prototype`, `refactor prototype`, and `approve prototype`.
- Preserve backward compatibility: existing single-PRD iterations continue to work without changes.
- All iteration artifacts (PRDs, audit reports, refactor plans) use the `_NNN` suffix pattern.

## User Stories

### US-001: Run `define requirement` multiple times
**As a** developer, **I want** to run `nvst define requirement` N times in the same iteration **so that** each run produces a separate PRD file (`it_000044_product-requirement-document_001.md`, `_002.md`, …).

**Acceptance Criteria:**
- [ ] First `define requirement` run creates `it_XXXXXX_product-requirement-document_001.md` in `.agents/flow/`.
- [ ] Second run (and each subsequent run) creates `it_XXXXXX_product-requirement-document_002.md`, `_003.md`, etc., without overwriting existing files.
- [ ] `state.json` `phases.define.requirement_definition` becomes an array; each entry has `{ index, status, file }`.
- [ ] Running `define requirement` after `approve requirement` is blocked by the guardrail (status is `approved`), unless `--force` is passed.
- [ ] Typecheck / lint passes.

### US-002: `approve requirement` approves all pending PRDs
**As a** developer, **I want** `nvst approve requirement` to approve all PRD entries in one command **so that** I don't need to approve each PRD individually.

**Acceptance Criteria:**
- [ ] Command sets `status = "approved"` on every entry in the `requirement_definition` array.
- [ ] If any entry is already `approved`, the command skips it (idempotent).
- [ ] Confirmation prompt (or `--yolo` flag) lists all PRDs that will be approved before proceeding.
- [ ] `state.json` is persisted with all entries marked `approved` after success.
- [ ] Typecheck / lint passes.

### US-003: `create prototype` iterates over all PRDs and their user stories
**As a** developer, **I want** `nvst create prototype` to process every approved PRD in sequence (PRD1→UC1…UCn, PRD2→UC1…UCn, …) **so that** all features are scaffolded in a single command run.

**Acceptance Criteria:**
- [ ] Command reads all PRD entries from `state.json` and processes them in index order.
- [ ] For each PRD, the agent prompt includes that PRD's content and iterates through its user stories.
- [ ] `state.json` `phases.prototype.prototype_creation` becomes an array with one entry per PRD (`{ index, status, file }`).
- [ ] Each prototype creation artifact is named `it_XXXXXX_prototype-creation_NNN.md` (or equivalent).
- [ ] Typecheck / lint passes.

### US-004: `audit prototype` produces one audit report per PRD
**As a** developer, **I want** `nvst audit prototype` to validate each PRD independently and produce one audit report per PRD **so that** issues are traceable back to a specific requirement.

**Acceptance Criteria:**
- [ ] Command produces N audit report files: `it_XXXXXX_audit-report_001.json`, `_002.json`, etc.
- [ ] `state.json` `phases.prototype.prototype_audit` becomes an array with one entry per PRD (`{ index, status, file }`).
- [ ] Each audit report is associated with its source PRD index.
- [ ] Typecheck / lint passes.

### US-005: `refactor prototype` runs one refactor pass per audit report
**As a** developer, **I want** `nvst refactor prototype` to execute a refactor pass for each audit report **so that** all detected issues across all PRDs are addressed.

**Acceptance Criteria:**
- [ ] Command iterates over all audit report entries in `state.json` and runs a refactor pass for each.
- [ ] Refactor artifacts are named `it_XXXXXX_refactor-plan_001.md`, `_002.md`, etc.
- [ ] `state.json` `phases.prototype.prototype_refactor` becomes an array with one entry per audit report.
- [ ] Typecheck / lint passes.

### US-006: Backward compatibility — single-PRD iterations continue to work
**As a** developer, **I want** existing single-PRD iteration workflows to work without any changes **so that** upgrading NVST does not break current projects.

**Acceptance Criteria:**
- [ ] A project with a `state.json` that has `requirement_definition` as a single object (legacy) is either auto-migrated or gracefully handled by the Zod schema.
- [ ] All commands that read `requirement_definition` handle both the legacy scalar shape and the new array shape.
- [ ] A manually executed single-PRD end-to-end run (define → approve → create → audit → refactor) succeeds without errors.
- [ ] Typecheck / lint passes.

### US-007: `auto` mode supports multi-PRD flow
**As a** developer, **I want** the `nvst auto` command to work correctly when multiple PRDs exist **so that** autonomous runs process all PRDs without manual intervention.

**Acceptance Criteria:**
- [ ] `auto` mode loops through all PRD entries and dispatches each phase command for each PRD in order.
- [ ] State transitions in `auto` mode correctly advance each per-PRD entry status.
- [ ] Typecheck / lint passes.

### US-008: `approve prototype` consolidates all PRDs into a single CHANGELOG entry and PR
**As a** developer, **I want** `nvst approve prototype` to build the CHANGELOG entry and GitHub PR body from **all** PRDs in the iteration (not just one) **so that** every feature defined in the iteration is documented and submitted for review in a single step.

**Acceptance Criteria:**
- [ ] Command reads all PRD entries from `state.json`'s `requirement_definition` array (in index order) instead of a single hardcoded PRD file.
- [ ] The CHANGELOG entry (`## [iteration] - YYYY-MM-DD`) includes a `### Added` section with goal bullets merged from every PRD's `## Goals` section, each group prefixed with the PRD title (e.g. `**PRD 001 — Title:** …`).
- [ ] The GitHub PR body (created via `gh pr create`) includes the Requirement name, Context, and Goals sections from each PRD, concatenated in index order, followed by the refactor report path(s) and the standard NVST footer.
- [ ] If `gh` CLI is unavailable, the command warns and skips PR creation without corrupting `CHANGELOG.md` (existing behavior preserved).
- [ ] Typecheck / lint passes.

## Functional Requirements
- **FR-1:** `define requirement` must auto-increment the PRD index by inspecting existing entries in `state.json`'s `requirement_definition` array. Index is zero-padded to 3 digits (e.g. `001`, `002`).
- **FR-2:** All artifact filenames for multi-PRD phases must follow the pattern `it_XXXXXX_<artifact-type>_NNN.<ext>` where `NNN` matches the PRD index.
- **FR-3:** The `StateSchema` Zod definition must be updated so `requirement_definition` accepts an array of `{ index: string, status: enum, file: string | null }` objects.
- **FR-4:** The Zod schema update must preserve backward compatibility: the legacy single-object shape (no `index` field, flat `status`/`file`) must either be accepted via a union type or migrated at read time.
- **FR-5:** `approve requirement` must operate on all entries with `status !== "approved"` and must surface the list of affected PRD files before confirming.
- **FR-6:** `create prototype`, `audit prototype`, and `refactor prototype` must each store their results as arrays in `state.json`, one element per source PRD index.
- **FR-7:** `auto` mode must be updated to iterate over per-PRD entries at every relevant phase.
- **FR-8:** The scaffold template `state.json` (used by `nvst init`) must initialize `requirement_definition` as an empty array `[]`.
- **FR-9:** `approve prototype` must read all PRD entries from `state.json`'s `requirement_definition` array and consolidate their `## Goals` bullet lists into a single `### Added` block in `CHANGELOG.md`, with each PRD's goals grouped under its title. The GitHub PR body (created via `gh pr create`) must include the Context and Goals sections from each PRD concatenated in index order, plus the refactor report path(s) and the standard NVST footer.

## Non-Goals (Out of Scope)
- Parallel (concurrent) execution of PRD phases — processing remains sequential.
- A UI or TUI for managing multiple PRDs.
- Merging or deduplicating PRDs automatically.
- Per-PRD branching in git (a single `feature/it_XXXXXX-…` branch covers all PRDs in the iteration).
- Changing the `refine requirement` command behavior (it still operates on a single PRD at a time, but now **prompts the user to select which PRD** to refine when multiple exist in the iteration).

## Open Questions
- None.
