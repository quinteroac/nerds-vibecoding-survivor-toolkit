# Requirement: Flow Guardrail — Warning Mode & Force Flag

## Context

Currently, every NVST command that detects a phase or status violation calls `throw new Error(...)`. This hard-crashes the process (exit code 1) with no recovery option. Developers who accidentally run a command out of order — or who intentionally need to bypass the workflow — have no graceful path forward. The goal is to replace the hard error with a warning + interactive confirmation, provide a `--force` flag for non-interactive bypass, and let teams opt back into strict error behavior via a `flow_guardrail` field in `state.json`.

## Goals

- Prevent unnecessary process crashes caused by phase/status mismatches.
- Give developers two escape hatches: interactive confirmation when `flow_guardrail` is `"relaxed"`, and `--force` (scriptable).
- Default to strict (hard error) when `flow_guardrail` is absent; allow teams to opt into relaxed (warn + prompt) or to keep strict via `state.json`.
- Centralize guardrail logic so all commands behave consistently.

## User Stories

### US-001: Warning and confirmation instead of error

**As a** developer running `bun nvst <command>` interactively, **I want** out-of-sequence commands to warn me and ask for confirmation instead of crashing **so that** I can recover from workflow missteps without having to restart or manually edit state.

**Acceptance Criteria:**
- [ ] When a phase/status violation is detected and `flow_guardrail` is `"relaxed"`, the command prints a warning to stderr describing the specific violation (e.g. `Warning: current_phase is 'prototype' but 'define' is required.`)
- [ ] Immediately after the warning, the command prints a confirmation prompt to stderr: `Proceed anyway? [y/N]`
- [ ] If the user enters `y` or `Y` and presses Enter, the command continues normally
- [ ] If the user enters anything else or presses Enter without input, the command exits with `process.exitCode = 1` and prints `Aborted.` to stderr, making no changes to state or files
- [ ] When in relaxed mode without `--force`, if the command cannot read a line from stdin (e.g. stdin is closed or not a TTY), the command treats it as no confirmation: exit with code 1 and print `Aborted.` to stderr, without modifying state or files
- [ ] The warning and prompt are written to stderr, not stdout
- [ ] Typecheck / lint passes

### US-002: `--force` flag bypasses confirmation prompt

**As a** developer, **I want** to pass `--force` to any NVST command to skip the interactive confirmation **so that** I can bypass the guardrail in scripts or quickly without manual confirmation.

**Acceptance Criteria:**
- [ ] All commands that perform phase/status validation accept a `--force` flag (e.g. `bun nvst define requirement --force`)
- [ ] With `--force`, the warning message is still printed to stderr, but no confirmation prompt is shown and the command proceeds immediately
- [ ] `--force` works in both `"relaxed"` and `"strict"` modes (it always bypasses the check)
- [ ] Commands that do not yet implement phase/status validation (and therefore do not accept `--force`) ignore unknown flags so that invocations like `bun nvst <command> --force` do not cause a parse error or exit code ≠ 0 when the command runs successfully; if a command is updated to perform guardrail checks, it must accept `--force`
- [ ] Typecheck / lint passes

### US-003: `flow_guardrail="strict"` restores hard-error behavior

**As a** developer or CI operator, **I want** to set `flow_guardrail="strict"` in `state.json` **so that** phase violations throw a hard error (the original behavior) and cannot be bypassed interactively.

**Acceptance Criteria:**
- [ ] `StateSchema` in `scaffold/schemas/tmpl_state.ts` accepts a new optional top-level field `flow_guardrail: z.enum(["strict", "relaxed"]).optional()`; all other existing fields are unchanged
- [ ] The corresponding schema copy in `schemas/` is updated to match
- [ ] When `flow_guardrail` is `"strict"` and a violation is detected (and `--force` is not passed), the command throws an `Error` with the same message as today (no prompt)
- [ ] When `flow_guardrail` is absent, behavior defaults to `"strict"` (hard error, same as today)
- [ ] Existing `state.json` files without `flow_guardrail` continue to parse successfully (field is optional)
- [ ] Typecheck / lint passes

### US-004: Shared guardrail utility used by all commands

**As a** maintainer of NVST, **I want** the warn/prompt/throw decision centralized in a single utility function **so that** all commands behave consistently and future changes require editing only one place.

**Acceptance Criteria:**
- [ ] A new exported function (e.g. `assertGuardrail(state, condition, message, options: { force: boolean })`) is added to an appropriate shared module (e.g. `src/guardrail.ts`)
- [ ] The function: throws if `strict` and not `force`; warns + prompts if `relaxed` and not `force`; warns and skips prompt if `force`
- [ ] All existing commands that inline `throw new Error(...)` for phase/status violations are updated to call `assertGuardrail` instead — specifically: `define-requirement.ts`, `create-prototype.ts`, `execute-refactor.ts`, `define-refactor-plan.ts`, and any other command with a phase guard
- [ ] No command retains an inline phase-guard `throw`; all route through `assertGuardrail`
- [ ] Typecheck / lint passes

## Functional Requirements

- **FR-1:** `StateSchema` gains an optional top-level field `flow_guardrail: z.enum(["strict", "relaxed"]).optional()`. No existing field is renamed, removed, or type-changed.
- **FR-2:** When `flow_guardrail` is absent, the runtime default is `"strict"`.
- **FR-3:** A new shared function `assertGuardrail(state, violated, message, opts)` in `src/guardrail.ts` encapsulates the three behaviors: throw (strict, no force), warn+prompt (relaxed, no force), warn+skip (force).
- **FR-4:** The confirmation prompt reads stdin line by line; only `y` or `Y` is treated as confirmation.
- **FR-5:** `--force` is parsed by each command handler from its `argv` and forwarded to `assertGuardrail`.
- **FR-6:** Warning and prompt output goes to stderr; normal command output continues to go to stdout.
- **FR-7:** Commands affected by this change: `define-requirement`, `create-prototype`, `execute-refactor`, `define-refactor-plan`. Any other command with a phase guard must also be updated (implementor to audit at implementation time).
- **FR-8:** The schema copy under `schemas/` must mirror the change to `scaffold/schemas/tmpl_state.ts`.

## Non-Goals (Out of Scope)

- A dedicated CLI command to set `flow_guardrail` (users edit `state.json` directly or use `nvst write-json`).
- Changing how `state.json` schema validation errors (malformed JSON, missing required fields) are reported — those remain hard errors.
- Guardrail behavior for non-phase errors (file-not-found, agent failures, etc.) — only phase/status precondition checks are in scope.
- Support for values of `flow_guardrail` other than `strict` and `relaxed` (e.g. no third mode); invalid values are a schema error.
- Automated tests for the new guardrail paths (deferred to a future iteration).
- Any changes to the three-phase workflow ordering itself.

## Open Questions

- Should `--force` be a global flag parsed in `cli.ts` and threaded through, or parsed locally in each command? (Recommendation: parse locally per command to avoid changing the `cli.ts` dispatch signature, at the cost of some repetition.)
- For non-interactive environments (e.g. piped stdin), should a missing `y` response auto-abort or auto-confirm? (Recommendation: auto-abort — safer default.)
