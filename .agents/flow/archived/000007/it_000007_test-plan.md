# Test Plan - Iteration 000007

## Scope

- Validate `--agent cursor` flag parsing, provider routing, and integration across all agent-backed NVST commands.
- Verify Cursor agent CLI invocation: `agent` binary usage, prompt context passing, and output capture to target files.
- Verify error handling when the `agent` command is not available in PATH.

## Environment and data

- Runtime: Bun v1+ with TypeScript strict mode.
- Test runner: `bun:test` (Bun built-in).
- Unit/integration tests: co-located `*.test.ts` files; no external fixtures required for provider parsing and command routing.
- E2E or integration tests that invoke the real `agent` binary: require `agent` in PATH or a mock/spy that simulates subprocess behaviour.
- For `ensureAgentCommandAvailable` / missing-CLI tests: inject `resolveCommandPath` returning `null` to simulate missing binary.

---

## User Story: US-001 - Run NVST commands with Cursor Agent

| Test Case ID | Description | Type (unit/integration/e2e) | Mode (automated/manual) | Correlated Requirements (US-XXX, FR-X) | Expected Result |
|---|---|---|---|---|---|
| TC-US001-01 | CLI accepts `bun nvst [command] --agent cursor` as valid argument | unit | automated | US-001, FR-1, US-001-AC01 | `parseAgentArg` returns `{ provider: "cursor", remainingArgs }`; no error thrown |
| TC-US001-02 | `parseProvider("cursor")` returns `"cursor"` and `buildCommand("cursor")` returns `{ cmd: "agent", args: [] }` | unit | automated | US-001, FR-2, US-001-AC02 | Cursor provider maps to `agent` binary with empty args |
| TC-US001-03 | Invalid provider error message lists `cursor` among valid providers | unit | automated | US-001, FR-1, US-001-AC01 | `parseProvider("unknown")` throws error containing "claude, codex, gemini, cursor" |
| TC-US001-04 | When `cursor` provider is used, prompt context is passed to agent invocation | unit | automated | US-001, FR-3, US-001-AC03 | `invokeAgent` with `provider: "cursor"` and a mock `Bun.spawn` receives prompt as last argument |
| TC-US001-05 | Agent stdout output is captured and written to the target file (e.g. test-plan) | integration | automated | US-001, FR-4, US-001-AC04 | `runCreateTestPlan({ provider: "cursor" })` with mock agent that returns stdout; output file contains the stdout content |
| TC-US001-06 | Create test-plan flow works end-to-end with cursor provider | integration | automated | US-001, FR-5, US-001-AC05 | `runCreateTestPlan({ provider: "cursor" })` completes; state updated; file written with agent output |
| TC-US001-07 | Define requirement and create prototype commands accept and forward `--agent cursor` | integration | automated | US-001, FR-1, US-001-AC05 | CLI parse for `define requirement --agent cursor` and `create prototype --agent cursor` succeeds; provider passed to command handler |

---

## User Story: US-002 - Error Handling for Missing CLI

| Test Case ID | Description | Type (unit/integration/e2e) | Mode (automated/manual) | Correlated Requirements (US-XXX, FR-X) | Expected Result |
|---|---|---|---|---|---|
| TC-US002-01 | When `--agent cursor` is used but `agent` is not in PATH, a clear error is returned | unit | automated | US-002, FR-6, US-002-AC01 | `invokeAgent({ provider: "cursor", resolveCommandPath: () => null })` rejects with message containing "Cursor agent CLI is unavailable" and "agent command not found in PATH" |
| TC-US002-02 | CLI exits with code 1 and displays error when cursor provider is selected and agent is unavailable | integration | automated | US-002, FR-6, US-002-AC01 | Command run (e.g. `create test-plan --agent cursor`) with mocked unavailable agent exits with code 1 and stderr contains the clear error message |
