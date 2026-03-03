# Requirement: Add Copilot CLI Agent Provider

## Context
NVST currently supports four agent providers: Claude, Codex, Gemini, and Cursor. GitHub Copilot CLI is a popular AI coding assistant that users may prefer or already have installed. Adding it as a provider expands choice and keeps NVST aligned with the evolving AI tooling landscape.

## Goals
- Support `--agent copilot` across all NVST commands that accept an agent provider
- Follow the same invocation pattern as existing providers (command + args, interactive/non-interactive modes)
- Maintain parity with existing provider behaviour (error messages, PATH checks, TTY handling)

## User Stories

### US-001: Invoke Copilot CLI as a non-interactive agent
**As a** developer using NVST, **I want** to run `bun nvst <command> --agent copilot` **so that** NVST delegates work to GitHub Copilot CLI in non-interactive (print/exec) mode.

**Acceptance Criteria:**
- [ ] `AgentProvider` type includes `"copilot"`
- [ ] `PROVIDERS` map contains a `copilot` entry with `cmd: "copilot"` and args `["-p", "--allow-all-paths"]` for non-interactive execution
- [ ] `parseProvider("copilot")` returns `"copilot"` without error
- [ ] `buildCommand("copilot")` returns `{ cmd: "copilot", args: ["-p", "--allow-all-paths"] }`
- [ ] When the `copilot` CLI binary is not in PATH, `ensureAgentCommandAvailable` throws a descriptive error message
- [ ] Non-interactive invocation spawns the process with the prompt as the final arg, capturing stdout/stderr
- [ ] Typecheck / lint passes

### US-002: Invoke Copilot CLI in interactive mode
**As a** developer using NVST, **I want** Copilot to run in interactive (TTY) mode when NVST needs to interview me **so that** the conversational flow works the same as with other providers.

**Acceptance Criteria:**
- [ ] When `interactive: true`, the spawned process uses `stdin: "inherit"` and `stdout/stderr: "inherit"`
- [ ] Interactive args drop `-p` and `--allow-all-paths`; the prompt is passed as a positional arg so Copilot enters its conversational TUI
- [ ] The interactive branch in `invokeAgent` handles the `"copilot"` provider correctly
- [ ] Typecheck / lint passes

### US-003: Verify Copilot provider integration
**As a** developer, **I want** automated tests covering the new provider **so that** I can be confident the integration works and won't regress.

**Acceptance Criteria:**
- [ ] Unit test verifies `parseProvider("copilot")` returns `"copilot"`
- [ ] Unit test verifies `buildCommand("copilot")` returns the expected command and args
- [ ] Unit test verifies `ensureAgentCommandAvailable` throws when the copilot binary is missing
- [ ] Unit test verifies `invokeAgent` constructs the correct args for both interactive and non-interactive modes
- [ ] All existing tests continue to pass
- [ ] Manual verification: run `bun nvst define requirement --agent copilot` (or equivalent) and confirm it attempts to invoke the copilot CLI

## Functional Requirements
- FR-1: Add `"copilot"` to the `AgentProvider` union type in `src/agent.ts`
- FR-2: Add a `copilot` entry to the `PROVIDERS` record with `cmd: "copilot"` and default non-interactive args `["-p", "--allow-all-paths"]`
- FR-3: Handle `copilot` in the interactive/non-interactive branching logic inside `invokeAgent`
- FR-4: Provide a clear error message in `ensureAgentCommandAvailable` when the copilot CLI is not found
- FR-5: Add unit tests for the new provider covering parsing, command building, availability check, and arg construction

## Non-Goals (Out of Scope)
- Implementing Copilot-specific authentication or token management
- Adding Copilot as a default or fallback provider
- Changing the behaviour of any existing provider
- Adding Copilot-specific skill prompt templates

## Resolved Questions
- **CLI command:** The standalone `copilot` binary ([github/copilot-cli](https://github.com/github/copilot-cli)) — not the older `gh copilot` extension which only offers `suggest`/`explain` subcommands and is not an agentic coding tool.
- **Non-interactive flags:** `copilot -p "prompt" --allow-all-paths` runs a single task and exits, outputting to stdout/stderr. Interactive mode omits `-p` and `--allow-all-paths`, launching the conversational TUI.
