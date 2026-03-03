# Test Plan - Iteration 000021

## Scope

- Integration of GitHub Copilot CLI as a new agent provider alongside existing providers (Claude, Codex, Gemini, Cursor).
- Support for both non-interactive (print/exec) and interactive (TTY/conversational) invocation modes.
- Validation of provider type additions, command argument construction, availability checks, and integration with existing agent invocation logic.
- Verification that Copilot provider behavior maintains parity with existing providers in error handling, TTY detection, and PATH resolution.
- Confirmation that all existing provider tests and CLI functionality remain unaffected.

## Environment and Data

- **Runtime**: Bun v1+ with TypeScript 5.6.3 (strict mode).
- **Test runner**: `bun:test` (Bun built-in); no external test framework dependencies.
- **Test location**: Unit tests in `src/agent.test.ts`; manual CLI verification for end-to-end behavior.
- **Fixtures**: Mock Copilot CLI binary (stubbed) for testing availability checks; sample prompts for non-interactive/interactive mode validation.
- **Preconditions**: `src/agent.ts` contains existing provider definitions; tests should not modify global state.

## User Story: US-001 - Invoke Copilot CLI as a non-interactive agent

| Test Case ID | Description | Type | Mode | Correlated Requirements | Expected Result |
|---|---|---|---|---|---|
| TC-US001-01 | Verify `AgentProvider` type includes `"copilot"` union literal | unit | automated | US-001-AC01, FR-1 | TypeScript compilation succeeds; `"copilot"` is a valid `AgentProvider` value |
| TC-US001-02 | Verify `PROVIDERS` map contains `copilot` entry with correct command and non-interactive args | unit | automated | US-001-AC02, FR-2 | `PROVIDERS["copilot"]` returns `{ cmd: "copilot", args: ["-p", "--yolo"] }` |
| TC-US001-03 | Verify `parseProvider("copilot")` parses successfully | unit | automated | US-001-AC03, FR-1 | `parseProvider("copilot")` returns `"copilot"` without throwing |
| TC-US001-04 | Verify `buildCommand("copilot")` returns expected command structure | unit | automated | US-001-AC04, FR-2 | `buildCommand("copilot")` returns `{ cmd: "copilot", args: ["-p", "--yolo"] }` |
| TC-US001-05 | Verify `ensureAgentCommandAvailable` throws descriptive error when copilot binary is missing | unit | automated | US-001-AC05, FR-4 | Error is thrown with message containing "copilot" and guidance about installation/PATH |
| TC-US001-06 | Verify non-interactive invocation spawns process with prompt as value for -p and flags after | unit | automated | US-001-AC06, FR-3 | `Bun.spawn` is called with `["copilot", "-p", <prompt>, "--yolo"]`; stdin is `"inherit"`, stdout/stderr are `"pipe"` for output capture |
| TC-US001-07 | Verify TypeScript compilation and type safety | unit | automated | US-001-AC07, FR-1 | `bun --bunfile tsconfig.json check` or equivalent succeeds with no errors |

## User Story: US-002 - Invoke Copilot CLI in interactive mode

| Test Case ID | Description | Type | Mode | Correlated Requirements | Expected Result |
|---|---|---|---|---|---|
| TC-US002-01 | Verify interactive invocation uses inherited stdin/stdout/stderr | unit | automated | US-002-AC01, FR-3 | When `interactive: true`, `Bun.spawn` is called with `stdin: "inherit"`, `stdout: "inherit"`, `stderr: "inherit"` |
| TC-US002-02 | Verify interactive mode uses `-i` flag instead of non-interactive flags | unit | automated | US-002-AC02, FR-3 | Interactive spawn args are `["-i", <prompt>]` — drops `-p` and `--allow-all-paths`; adds `-i` for conversational mode |
| TC-US002-03 | Verify `invokeAgent` handles copilot provider in interactive branch | unit | automated | US-002-AC03, FR-3 | `invokeAgent` correctly dispatches to interactive spawn logic when `provider: "copilot"` and `interactive: true` |
| TC-US002-04 | Verify TypeScript compilation and type safety for interactive path | unit | automated | US-002-AC04, FR-1 | `bun --bunfile tsconfig.json check` passes; interactive code paths have correct types |

## User Story: US-003 - Verify Copilot provider integration

| Test Case ID | Description | Type | Mode | Correlated Requirements | Expected Result |
|---|---|---|---|---|---|
| TC-US003-01 | Unit test: `parseProvider("copilot")` returns `"copilot"` | unit | automated | US-003-AC01, FR-1 | Test passes; `parseProvider("copilot")` does not throw and returns `"copilot"` |
| TC-US003-02 | Unit test: `buildCommand("copilot")` returns expected command and args | unit | automated | US-003-AC02, FR-2 | Test passes; command object has correct `cmd` and `args` array values |
| TC-US003-03 | Unit test: `ensureAgentCommandAvailable` throws when copilot binary is missing | unit | automated | US-003-AC03, FR-4 | Test passes; function throws `Error` (not `GuardrailAbortError` or other exception type) with appropriate message |
| TC-US003-04 | Unit test: `invokeAgent` constructs correct args for non-interactive and interactive modes | unit | automated | US-003-AC04, FR-3 | Test passes; non-interactive mode uses `["-p", <prompt>, "--yolo"]`; interactive mode uses `["-i", <prompt>]` |
| TC-US003-05 | Verify all existing tests continue to pass after copilot provider addition | unit | automated | US-003-AC05, FR-1 | `bun test` runs all tests in `src/` and `tests/`; no regressions; all existing provider tests (Claude, Codex, Gemini, Cursor) still pass |
| TC-US003-06 | Manual verification: `bun nvst define requirement --agent copilot` attempts copilot invocation | integration | manual | US-003-AC06, FR-3 | When command is executed, process attempts to spawn copilot CLI (or fails with clear "copilot not found" error if not installed); does not crash or hang |

---

## Test Execution Notes

### Automation Strategy

- **Unit tests** (TC-US001-01 through TC-US001-07, TC-US002-01 through TC-US002-04, TC-US003-01 through TC-US003-05):
  - Written in `src/agent.test.ts` using `bun:test`.
  - Mock or stub `Bun.spawn` to verify argument construction without actually invoking the copilot CLI.
  - Mock or stub file system checks (`ensureAgentCommandAvailable`) to simulate missing/present binaries.
  - Mock `parseProvider` validation to test type safety independently.

- **Manual Test** (TC-US003-06):
  - Requires actual copilot CLI to be installed on the test machine (or a stub binary in PATH).
  - Justification: End-to-end CLI invocation behavior (TTY detection, subprocess I/O inheritance) cannot be reliably validated through mocks; manual execution provides confidence that the spawned process behaves correctly in a real terminal context.

### Functional Requirement Coverage

| FR | Test Case ID(s) |
|---|---|
| FR-1 | TC-US001-01, TC-US001-03, TC-US001-07, TC-US003-01, TC-US003-05 |
| FR-2 | TC-US001-02, TC-US001-04, TC-US003-02 |
| FR-3 | TC-US001-06, TC-US002-01, TC-US002-02, TC-US002-03, TC-US003-04, TC-US003-06 |
| FR-4 | TC-US001-05, TC-US003-03 |
| FR-5 | TC-US003-01 through TC-US003-04 |

All five functional requirements are covered by automated or manual test cases.

### Regression Prevention

- Run full test suite (`bun test`) before committing code to ensure no regressions in existing providers or CLI commands.
- Verify that the new copilot provider addition does not modify behavior of Claude, Codex, Gemini, or Cursor providers.
