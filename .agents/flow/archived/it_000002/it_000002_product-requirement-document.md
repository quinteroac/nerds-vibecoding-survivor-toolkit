# Requirement: Technical Debt Resolution (Iteration 000002)

## Context
During the initial setup and iteration 000001, several technical debt items were identified that deviate from the project's established code standards (e.g., synchronous I/O, direct `process.exit` calls, incomplete type checking). Addressing these now ensures a stable and compliant foundation for future features.

## Goals
- Align the codebase with the `PROJECT_CONTEXT.md` standards.
- Improve system robustness by using safe parsing and asynchronous I/O.
- Ensure comprehensive type safety across the entire `src/` directory.

## User Stories

### US-001: Implement Safe State Parsing
**As a** Developer, **I want** the state loader to use `safeParse` **so that** invalid state files are handled gracefully without throwing unhandled exceptions.

**Acceptance Criteria:**
- [ ] `src/state.ts` uses `StateSchema.safeParse()` instead of `.parse()`.
- [ ] On schema validation failure, `readState` returns the `safeParse` error to the caller (instead of throwing a raw `ZodError`), allowing the caller to log a user-friendly message and exit gracefully.
- [ ] File-not-found (`ENOENT`) and malformed JSON (`SyntaxError`) errors are caught and surfaced with descriptive messages (not raw stack traces).
- [ ] Typecheck passes.

### US-002: Remove Direct Process Exit Calls
**As a** Developer, **I want** validation scripts to use `process.exitCode` instead of `process.exit()` **so that** the toolkit follows the "never call process.exit()" convention.

**Acceptance Criteria:**
- [ ] `process.exit()` is removed from all files in `schemas/` and `scaffold/schemas/`.
- [ ] Scripts set `process.exitCode = 1` on failure and allow the process to terminate naturally.
- [ ] Typecheck passes.

### US-003: Enable Project-Wide Type Checking
**As a** Maintainer, **I want** `tsc` to include the `src/` directory **so that** I can verify type safety across the entire CLI application.

**Acceptance Criteria:**
- [ ] `tsconfig.json` includes `"src/**/*.ts"` in the `include` array.
- [ ] Running `bun x tsc --noEmit` performs type checking on all source files without producing build artifacts.
- [ ] All pre-existing type errors discovered in `src/` are resolved.

### US-004: Refactor to Asynchronous I/O
**As a** Developer, **I want** validation scripts to use asynchronous file operations **so that** they comply with the "no synchronous I/O" standard.

**Acceptance Criteria:**
- [ ] `readFileSync` is replaced with `readFile` (from `node:fs/promises`) or `Bun.file().json()` in all validation scripts.
- [ ] Validation scripts remain functional and correctly report errors.
- [ ] Typecheck passes.

## Functional Requirements
- FR-1: Update `src/state.ts` to use `safeParse`.
- FR-2: Update `schemas/validate-state.ts`, `schemas/validate-progress.ts`, and their scaffold templates to use `process.exitCode`.
- FR-3: Update `tsconfig.json` to include `src/`.
- FR-4: Refactor validation scripts (`schemas/validate-*.ts` and `scaffold/schemas/tmpl_validate-*.ts`) to use async I/O.

## Non-Goals (Out of Scope)
- Adding new CLI features.
- Implementing an automated test runner (e.g., `bun:test`).
- Refactoring `src/agent.ts` logic (unless required by I/O changes).
- Fixing import paths or module resolution in `schemas/` validation scripts (unless required for the async I/O refactor to function).

## Open Questions
- None at this time.
