# Requirement: New Test Suite for Core Modules

## Context
A large-scale refactor rendered all previous tests invalid, and they were deleted.
NVST now lacks automated test coverage. This iteration re-establishes a baseline test suite
targeting the core modules that are most critical to correctness and stability.

## Goals
- Restore automated test coverage for NVST's core modules after the refactor.
- Ensure every public function/exported symbol in the targeted modules has at least one test.
- All tests run successfully with `bun test` (no additional tooling required).

## User Stories

### US-001: Tests for `state.ts`
**As a** developer, **I want** automated tests for `state.ts` **so that** state read/write/validation
logic is verified and regressions are caught early.

**Acceptance Criteria:**
- [ ] `exists(path)` returns `true` for an existing file and `false` for a non-existent path.
- [ ] `readState(projectRoot)` returns a valid `State` object when `state.json` is present and valid.
- [ ] `readState(projectRoot)` throws an error with a descriptive message when `state.json` contains malformed JSON.
- [ ] `readState(projectRoot)` throws an error when `state.json` fails Zod schema validation.
- [ ] `writeState(projectRoot, state)` writes a valid JSON file at the correct path.
- [ ] `writeState(projectRoot, state)` updates `last_updated` to the current timestamp.
- [ ] Typecheck / lint passes.

---

### US-002: Tests for `guardrail.ts`
**As a** developer, **I want** automated tests for `assertGuardrail` **so that** all guardrail
modes (strict, relaxed, force) behave exactly as specified.

**Acceptance Criteria:**
- [ ] When `violated` is `false`, `assertGuardrail` returns without side effects (all modes).
- [ ] In **strict** mode (default) with `force: false`, throws `Error` with the provided message when violated.
- [ ] In **strict** mode with `force: true`, returns without throwing when violated.
- [ ] In **relaxed** mode with `force: false`, writes warning + prompt to stderr and throws `GuardrailAbortError` when user inputs anything other than `"y"` or `"Y"`.
- [ ] In **relaxed** mode with `force: false`, returns (does not throw) when user inputs `"y"`.
- [ ] In **relaxed** mode with `force: false`, returns (does not throw) when user inputs `"Y"`.
- [ ] In **relaxed** mode with `force: true`, writes warning to stderr and returns without prompting or throwing.
- [ ] `GuardrailAbortError` sets `process.exitCode = 1` before throwing.
- [ ] Typecheck / lint passes.

---

### US-003: Tests for `commands/start-iteration.ts`
**As a** developer, **I want** automated tests for `runStartIteration` **so that** iteration
increment, state reset, and archive logic are reliably verified.

**Acceptance Criteria:**
- [ ] `nextIteration("000001")` returns `"000002"`.
- [ ] `nextIteration("000009")` returns `"000010"` (zero-padded correctly).
- [ ] `runStartIteration` creates a fresh `state.json` with `current_iteration: "000001"` when no prior state exists.
- [ ] `runStartIteration` increments `current_iteration` and archives the previous flow artifacts.
- [ ] The archived folder path follows the pattern `.agents/flow/archived/<iteration>`.
- [ ] After archiving, the flow directory no longer contains the previous iteration files (they are moved, not copied).
- [ ] Typecheck / lint passes.

---

### US-004: Tests for `commands/write-json.ts`
**As a** developer, **I want** automated tests for `runWriteJson` **so that** JSON artifact
writing, schema validation, and error paths are all verified.

**Acceptance Criteria:**
- [ ] `runWriteJson` with `--schema state --out <path> --data <validJson>` writes the file at `<path>`.
- [ ] Written file content is valid JSON matching the `StateSchema`.
- [ ] `runWriteJson` sets `process.exitCode = 1` and prints an error when `--schema` is missing.
- [ ] `runWriteJson` sets `process.exitCode = 1` and prints an error for an unknown schema name.
- [ ] `runWriteJson` sets `process.exitCode = 1` and prints an error when `--out` is missing.
- [ ] `runWriteJson` sets `process.exitCode = 1` when the JSON payload fails Zod schema validation.
- [ ] `runWriteJson` sets `process.exitCode = 1` when the JSON payload is malformed (not valid JSON).
- [ ] Typecheck / lint passes.

---

### US-005: Tests for CLI routing (`cli.ts`)
**As a** developer, **I want** automated tests for the CLI router **so that** command dispatch
and error handling are verified independently of individual command implementations.

**Acceptance Criteria:**
- [ ] An unknown command (e.g. `nvst foobar`) sets `process.exitCode = 1` and prints a usage/error message.
- [ ] `extractFlagValue` returns the correct value and remaining args when the flag is present.
- [ ] `extractFlagValue` returns `null` value and the original args when the flag is absent.
- [ ] `extractFlagValue` throws an error when the flag is present but has no following value.
- [ ] Typecheck / lint passes.

---

## Functional Requirements
- FR-1: All test files MUST live under `tests/` (e.g. `tests/state.test.ts`).
- FR-2: Tests MUST use `bun:test` (`import { describe, it, expect } from "bun:test"`). No external test libraries.
- FR-3: External dependencies (file system, stdin) MUST be isolated using temporary directories or dependency injection (injectable `readLineFn` / `stderrWriteFn` already available on `assertGuardrail`).
- FR-4: Tests MUST NOT call `process.exit()`. Any function that sets `process.exitCode` must be tested by inspecting `process.exitCode` before and after.
- FR-5: Each test file must correspond to one source module (e.g. `tests/state.test.ts` → `src/state.ts`).
- FR-6: The `bun test` command (as configured in `package.json`) must exit with code 0 after all tests pass.

## Non-Goals (Out of Scope)
- No tests for command handlers beyond those listed (e.g. `approve-prototype`, `create-prototype`, `audit-prototype`).
- No code coverage threshold enforcement.
- No CI/CD pipeline setup or GitHub Actions workflow changes.
- No introduction of new dependencies (no Jest, Vitest, sinon, etc.).
- No end-to-end tests (spawning the full `bun nvst` CLI process).

## Open Questions
- None.
