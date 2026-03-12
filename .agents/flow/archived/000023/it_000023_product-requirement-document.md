# Requirement: Prompt-Based Execution Mode (`--agent ide`)

## Context
Currently, all agent-backed NVST commands (`define requirement`, `refine requirement`, `create prototype`, `audit prototype`, `refactor prototype`) spawn an external agent CLI subprocess (Claude, Codex, Gemini, Cursor, Copilot) to execute the associated skill prompt. This tight coupling means developers cannot use NVST in environments where spawning a subprocess is not feasible or desirable — such as Claude Code Web, Antigravity, or GitHub Copilot CLI — where the AI assistant itself is the execution environment.

The goal is to introduce `ide` as a new valid value for the `--agent` flag. When `--agent ide` is passed, the command builds the full skill prompt and prints it to stdout instead of spawning a subprocess. The developer or their AI environment can then act on the printed prompt directly. All other `--agent` values continue to behave exactly as today.

## Goals
- Enable NVST to be used in agentic IDE and web AI environments without spawning subprocesses.
- Keep the existing agent-invocation path fully intact for all current providers; this is an additive, non-breaking change.
- Maintain consistent state transitions in both modes so workflow state remains reliable.

## User Stories

### US-001: `--agent ide` Prints Skill Prompt to Stdout
**As a** developer using NVST in an agentic IDE or web AI environment, **I want** to run any agent-backed command with `--agent ide` **so that** the full skill prompt is printed to stdout and I (or my AI environment) can act on it directly.

**Acceptance Criteria:**
- [ ] `ide` is accepted as a valid value for `--agent` in all agent-backed commands: `nvst define requirement`, `nvst refine requirement`, `nvst create prototype`, `nvst audit prototype`, `nvst refactor prototype`.
- [ ] When `--agent ide` is used, the command builds the full skill prompt (skill body + context variables, via the same `buildPrompt` logic) and writes it to stdout.
- [ ] When `--agent ide` is used, the command exits with code `0` after printing the prompt.
- [ ] When `--agent ide` is used, state transitions still occur — e.g., `define requirement --agent ide` updates `requirement_definition.status` to `"in_progress"` in `state.json`, identical to other providers.
- [ ] When any other `--agent <provider>` is used, behavior is identical to the current implementation (subprocess spawning, interactive mode, result handling, state transitions).
- [ ] Passing an unknown provider value (not one of `claude`, `codex`, `gemini`, `cursor`, `copilot`, `ide`) still produces a clear error message listing all valid providers including `ide`.
- [ ] No existing tests break; new behavior is covered by unit tests.
- [ ] Typecheck / lint passes.

### US-002: CLI Help Reflects the New `ide` Provider
**As a** developer, **I want** the CLI help text to list `ide` as a valid provider **so that** I can discover prompt-output mode without reading the source code.

**Acceptance Criteria:**
- [ ] The `--agent` flag description in help output lists `ide` alongside the other valid providers (e.g., `claude, codex, gemini, cursor, copilot, ide`).
- [ ] The `ide` provider is briefly described as the prompt-output mode (e.g., "prints skill prompt to stdout instead of invoking an agent subprocess").
- [ ] Usage examples or command descriptions for agent-backed commands show `ide` as a valid option for `--agent`.
- [ ] Typecheck / lint passes.

### US-003: `create prototype --agent ide` Prints Per-Story Prompts
**As a** developer, **I want** `nvst create prototype --agent ide` to print the implement-user-story skill prompt for each user story in the PRD **so that** I can execute them one by one in my AI environment.

**Acceptance Criteria:**
- [ ] When `--agent ide` is used, `create prototype` reads the PRD user stories (same as agent mode) and prints the full `implement-user-story` skill prompt for each story, separated by a clear delimiter (e.g., `---`).
- [ ] Each printed block includes the story-specific context variables (story JSON, project context, iteration) injected via `buildPrompt`, identical to what would be sent to an agent subprocess.
- [ ] State transition for `prototype_creation` to `"in_progress"` still occurs.
- [ ] No agent subprocess is spawned when `--agent ide` is used.
- [ ] Typecheck / lint passes.

## Functional Requirements
- **FR-1:** `ide` MUST be added as a valid `AgentProvider` value in `src/agent.ts`. `parseProvider()` MUST accept `"ide"` and return it without error. The valid-providers error message MUST include `ide`.
- **FR-2:** When the resolved provider is `ide`, agent-backed commands MUST build the full skill prompt via `buildPrompt(skillBody, context)` and write it to `process.stdout`. No subprocess MUST be spawned. The command MUST exit with code `0`.
- **FR-3:** State transitions (reads/updates to `state.json`) MUST occur when `--agent ide` is used, exactly as they do for other providers. Commands MUST NOT skip state persistence for the `ide` provider.
- **FR-4:** The `--agent` flag description in `src/cli.ts` help output MUST list `ide` as a valid provider with a brief description of its prompt-output behavior.
- **FR-5:** For `nvst create prototype --agent ide`, each user story MUST produce a separate prompt block written to stdout, using the same per-story context injection as agent mode. Story blocks MUST be separated by a visible delimiter.
- **FR-6:** All changes MUST follow existing architectural and coding conventions in `.agents/PROJECT_CONTEXT.md` (TypeScript strict mode, Bun runtime, no `process.exit()`, async I/O, one file per command, `src/agent.ts` for prompt/skill utilities).

## Non-Goals (Out of Scope)
- Removing or modifying any existing provider (`claude`, `codex`, `gemini`, `cursor`, `copilot`) — all remain fully functional.
- Making `--agent` optional (omitting it still produces a usage error).
- Writing prompt output to a file or clipboard; stdout is the only target for this iteration.
- Changing how `approve-requirement`, `approve-prototype`, `start iteration`, `init`, `destroy`, or `write-json` work — they are not agent-backed and are unaffected.
- Implementing full logic for currently-stub commands (`audit prototype`, `refactor prototype`) beyond the prompt-output mode path.

## Open Questions
- None — all decisions resolved during requirements gathering.
