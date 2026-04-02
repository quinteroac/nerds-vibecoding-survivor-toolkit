# Requirement: Remove Flow Artifact Storage & Replace Archive with CHANGELOG

## Context
Currently, `.agents/flow/` acts as persistent storage for iteration artifacts (PRDs, audit reports, etc.). When `nvst start-iteration` is called, files are moved to `.agents/flow/archived/<iteration>/` and a `history` array in `state.json` tracks every archived iteration. This adds structural complexity without proportional value: archived files are rarely consulted and the `history` field duplicates information already derivable from git history. The goal is to simplify by (a) treating `.agents/flow/` as a transient working directory that is wiped on each new iteration, and (b) appending a concise, human-readable entry to `CHANGELOG.md` at `approve prototype` time to preserve the meaningful historical record — the goals of each completed iteration.

## Goals
- Simplify state management by removing the `history` field from `state.json` and its Zod schema.
- Eliminate the `.agents/flow/archived/` directory and all archive logic.
- Preserve a lightweight, append-only human record of completed iterations in `CHANGELOG.md` (Keep a Changelog format, `### Added` section only).
- Ensure `nvst start-iteration` starts each iteration with a clean `.agents/flow/` directory.

## User Stories

### US-001: Clean flow directory on start-iteration
**As a** developer running `nvst start-iteration`, **I want** all files in `.agents/flow/` to be deleted before the new iteration begins **so that** the working directory is always clean and no stale artifacts from the previous iteration remain.

**Acceptance Criteria:**
- [ ] All files directly inside `.agents/flow/` (e.g. `it_XXXXXX_*.md`, `it_XXXXXX_*.json`) are deleted before the new iteration state is written.
- [ ] Subdirectories inside `.agents/flow/` (if any remain after removing `archived/`) are also removed.
- [ ] The `.agents/flow/` directory itself still exists after the command runs.
- [ ] The command output no longer mentions "Archived N file(s)" — it prints "Deleted N file(s) from .agents/flow/" instead (or similar clean message).
- [ ] If `.agents/flow/` is already empty, the command runs without error.
- [ ] Typecheck / lint passes.

### US-002: Append iteration goals to CHANGELOG.md on approve-prototype
**As a** developer running `nvst approve prototype`, **I want** the iteration's goals (extracted from the PRD) to be appended to `CHANGELOG.md` using Keep a Changelog format **so that** there is a concise, permanent, human-readable record of what was delivered each iteration.

**Acceptance Criteria:**
- [ ] `nvst approve prototype` reads the PRD file for the current iteration from `.agents/flow/`.
- [ ] The `## Goals` section of the PRD is extracted and its bullet items are used as the changelog entries.
- [ ] An entry is appended to `CHANGELOG.md` in the following format (date = ISO date of approval):
  ```
  ## [it_XXXXXX] - YYYY-MM-DD

  ### Added
  - <goal bullet 1>
  - <goal bullet 2>
  ```
- [ ] The entry is appended after the header block (below the introductory lines) and before any existing `## [...]` entries, so the most recent iteration appears first.
- [ ] If `CHANGELOG.md` does not exist, it is created with the correct Keep a Changelog header before appending.
- [ ] If the PRD has no `## Goals` section or it is empty, the step is skipped with a warning log; the rest of `approve prototype` continues normally.
- [ ] Typecheck / lint passes.

### US-003: Remove `history` field from state.json schema and runtime
**As a** developer, **I want** `state.json` to no longer contain a `history` array **so that** the schema is simpler and state files are not padded with data that is now tracked in `CHANGELOG.md`.

**Acceptance Criteria:**
- [ ] `historyEntry` Zod object and `history` field are removed from `src/schemas/tmpl_state.ts` (and any mirrored schema files in `scaffold/schemas/` or `schemas/`).
- [ ] `createInitialState` in `start-iteration.ts` no longer initialises or writes a `history` field.
- [ ] No code path reads or writes `state.history` (grep confirms zero references after the change).
- [ ] Existing `state.json` files that still contain a `history` key are tolerated by the updated Zod schema (use `.strip()` / `passthrough` appropriately or simply rely on `z.object` stripping unknown keys).
- [ ] Typecheck / lint passes.

### US-004: Remove archive directory and archive logic
**As a** developer, **I want** all code referencing `.agents/flow/archived/` to be deleted **so that** there are no dead code paths and the repository structure is cleaner.

**Acceptance Criteria:**
- [ ] `ARCHIVED_DIR` constant and all `mkdir`/`rename` calls related to archiving are removed from `start-iteration.ts`.
- [ ] The `.agents/flow/archived/` directory (and its contents) is deleted from the repository.
- [ ] No other source file references `ARCHIVED_DIR` or `.agents/flow/archived/` (grep confirms).
- [ ] Typecheck / lint passes.

## Functional Requirements
- FR-1: `runStartIteration` MUST delete all entries (files and subdirectories) inside `FLOW_REL_DIR` using async `rm` with `recursive: true` per entry, then recreate the directory.
- FR-2: `runApprovePrototype` MUST append a Keep a Changelog–compliant block to `CHANGELOG.md` after successfully completing the existing approval steps, using the `## Goals` bullet list from the current iteration's PRD file.
- FR-3: The CHANGELOG entry version identifier MUST use the iteration string format `[it_XXXXXX]` and the date MUST be the ISO date (YYYY-MM-DD) at approval time.
- FR-4: The `StateSchema` Zod object MUST NOT include a `history` field; the `State` TypeScript type derived from it must also omit `history`.
- FR-5: All mirrored copies of the state schema (in `scaffold/schemas/` and `schemas/`) MUST be updated consistently with `src/schemas/tmpl_state.ts`.
- FR-6: The `.agents/flow/archived/` directory MUST be removed from the repository (via `git rm -r` or equivalent).

## Non-Goals (Out of Scope)
- Migrating or converting existing archived files in `.agents/flow/archived/` to CHANGELOG entries — old history is dropped.
- Changing any other fields or phases in `state.json`.
- Modifying the format or content of PRD files themselves.
- Adding a `### Changed` or `### Fixed` section to the CHANGELOG entries — only `### Added` is used.
- Adding any UI or interactive prompts around the CHANGELOG write step.

## Open Questions
- None
