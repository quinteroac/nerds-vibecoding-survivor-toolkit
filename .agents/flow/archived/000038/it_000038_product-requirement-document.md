# Requirement: Global `--yolo` Flag for Agent Permission Bypass

## Context

NVST commands that invoke AI agents (Claude, Codex, Gemini, Copilot) in interactive mode
currently drop the provider's bypass-permissions flags (e.g., `--dangerously-bypass-approvals-and-sandbox`
for Codex, `--yolo --no-ask-user` for Copilot). This causes those agents to stop mid-work and
prompt the user for file-read/write permission confirmations, interrupting the workflow.

A developer should be able to opt in to "yolo mode" by passing `--yolo` to any `nvst` command,
causing all agent invocations — interactive or not — to include the provider's respective
bypass-permissions flags. Interactive mode itself (TTY, user answers the agent's interview
questions) is preserved; only the agent's internal permission prompts are suppressed.

## Goals

- Provide a single, consistent opt-in flag (`--yolo`) across all agent-invoking `nvst` commands.
- When `--yolo` is set, every `invokeAgent` call passes the provider's bypass flags regardless of `interactive` mode.
- Default behavior (no `--yolo`) remains completely unchanged.

## User Stories

### US-001: Developer runs any nvst command with `--yolo` to suppress agent permission prompts

**As a** developer, **I want** to append `--yolo` to any `nvst` command that invokes an agent
**so that** the agent never stops to ask for file-read/write permissions during its work,
even when running in interactive (interview) mode.

**Acceptance Criteria:**
- [ ] `--yolo` option is declared on all eight agent-invoking commands in `src/cli.ts`:
  `ideate`, `define requirement`, `refine requirement`, `refine project-context`,
  `create prototype`, `create project-context`, `audit prototype`, `refactor prototype`.
- [ ] Each command handler receives `yolo: boolean` and forwards it to `invokeAgent` via `AgentInvokeOptions`.
- [ ] `AgentInvokeOptions` in `src/agent.ts` exposes an optional `yolo?: boolean` field (default `false`).
- [ ] In `invokeAgent`, when `yolo = true`:
  - **Codex interactive**: `--dangerously-bypass-approvals-and-sandbox` is included in the spawned args (it is currently absent from `CODEX_INTERACTIVE_ARGS`).
  - **Copilot interactive**: `--yolo` and `--no-ask-user` are included in the spawned args (they are currently absent from the interactive branch).
  - **Claude interactive** and **Gemini interactive**: no change needed (bypass flags already present in those branches).
- [ ] When `--yolo` is **not** set, spawned args are identical to the current behavior (no regression).
- [ ] `bun tsc --noEmit` (typecheck) passes with no new errors.
- [ ] `bun test` passes with no regressions.

## Functional Requirements

- FR-1: All eight agent-invoking subcommands in `src/cli.ts` must declare `.option("--yolo", "Invoke agent with bypass-permissions flags (suppresses agent permission prompts)")`.
- FR-2: `yolo: boolean` must be threaded from each command's parsed opts down through its handler options interface (e.g., `IdeateOptions`, `DefineRequirementOptions`) to the `invokeAgentFn` call site.
- FR-3: `AgentInvokeOptions` in `src/agent.ts` must add `yolo?: boolean`.
- FR-4: `invokeAgent` must respect `yolo` in the interactive-mode branches for **Codex** and **Copilot** by including the same bypass args that those providers already use in non-interactive mode.
- FR-5: The `--yolo` flag is independent of `--force`; they may be combined.
- FR-6: No new runtime dependencies may be added.

## Non-Goals (Out of Scope)

- Changing the behavior of `--force` (guardrail bypass) in any way.
- Adding a persistent "always yolo" setting to `state.json` or project config.
- Applying `--yolo` to non-agent commands (`init`, `destroy`, `write-json`, `approve *`, `start iteration`).
- Adding new automated tests beyond ensuring existing tests continue to pass.

## Open Questions

- None.
