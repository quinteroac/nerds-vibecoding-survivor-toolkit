# Evaluation Report — Iteration 000019

## Strengths
- The new `nvst flow` command is correctly exposed from `src/cli.ts` with clear usage documentation and consistent flag parsing for `--agent` and `--force`, matching existing CLI patterns.
- `src/commands/flow.ts` follows the modular architecture from `PROJECT_CONTEXT.md`: it lives under `src/commands/`, delegates to existing command handlers instead of spawning subprocesses, and relies on the shared `StateSchema` from `scaffold/schemas/tmpl_state.ts`.
- `runFlow` uses dependency injection for all side effects (`readStateFn`, agent command functions, readline, stdout/stderr writers), which makes the command highly testable and keeps core logic pure.
- `detectNextFlowDecision` encapsulates the core state-based decision logic and clearly separates concerns between step selection, approval gates, iteration completion, and blocked states.
- The implementation satisfies the main user stories in the PRD: it auto-detects the next step from `.agents/state.json`, chains multiple steps by re-reading state in a loop, prompts interactively when `--agent` is missing, and stops immediately on delegated errors with a non-zero exit code.
- `src/commands/flow.test.ts` provides thorough coverage aligned to US‑001, US‑002, and US‑003, including explicit tests for each acceptance criterion and for the “no process.exit in delegated handlers” requirement.
- The implementation adheres to key conventions from `PROJECT_CONTEXT.md`: TypeScript strict mode, asynchronous file I/O, no `process.exit()` calls in command code, and centralized guardrail logic in `guardrail.ts`.

## Technical Debt
- **Hard-coded flow resolution logic tied to current_phase.**  
  Impact: Medium — if `current_phase` drifts from the actual step progression, `nvst flow` may become blocked even when there is a valid next step according to `phases.*`.  
  Effort: Medium — requires refactoring `detectNextFlowDecision` to derive phase progression from the canonical order in `StateSchema` rather than relying primarily on `current_phase`.
- **Partial misalignment with the canonical step order described in the PRD (FR‑2/FR‑4).**  
  Impact: Medium — the current decision tree encodes a fixed sequence for prototype and refactor phases, but it does not fully mirror the conceptual order `test_plan → tp_generation → prototype_build → test_execution → prototype_approved` and `evaluation_report → refactor_plan → refactor_execution → changelog`. This increases the risk of subtle bugs if state transitions evolve.  
  Effort: Medium — would benefit from a more declarative definition of steps and their preconditions, closely mapped to the schema.
- **Guardrail abort messages can still be duplicated when invoked via `nvst flow`.**  
  Impact: Low-to-Medium — `assertGuardrail` already writes “Aborted.” and sets `process.exitCode`, but `runFlow` catches all errors (including `GuardrailAbortError`), prints the message again, and sets `process.exitCode = 1`, effectively reintroducing the duplicate-abort pattern that was previously fixed at the top-level CLI.  
  Effort: Low — adjust `runFlow`’s error handling to special-case `GuardrailAbortError` or allow it to propagate to the top-level handler in `cli.ts`.
- **Command-level error handling in `runFlow` partially duplicates the responsibilities of the CLI router.**  
  Impact: Low — `runFlow` converts all delegated errors into stderr output and an exit code, which is functionally correct but diverges from the pattern where `src/cli.ts` is the single place responsible for setting `process.exitCode`. This duplication increases the cognitive load for future changes to error-handling policies.  
  Effort: Low-to-Medium — could be simplified by letting errors bubble up and centralizing exit-code and messaging behavior in the CLI layer.
- **Limited automated checks for future schema evolution.**  
  Impact: Low-to-Medium — `detectNextFlowDecision` relies on explicit knowledge of specific statuses and fields from `tmpl_state.ts`; new statuses or steps added to the schema will require manual updates to both the implementation and tests.  
  Effort: Low — add tests that assert that the resolver’s step ordering and handled states stay in sync with the authoritative `StateSchema`, or introduce a small abstraction to describe the flow graph in one place.

## Violations of PROJECT_CONTEXT.md
- **Centralized error-handling pattern is weakened for the `flow` command.**  
  `PROJECT_CONTEXT.md` specifies that commands throw errors and `cli.ts` is responsible for wrapping them and setting `process.exitCode`. In contrast, `runFlow` both prints error messages and sets `process.exitCode`, which partially bypasses the single-responsibility pattern for the CLI and leads to inconsistent handling for guardrail aborts.
- **Guardrail behavior is not fully unified with the new top-level pattern.**  
  After the fix recorded in `.agents/TECHNICAL_DEBT.md`, `cli.ts` special-cases `GuardrailAbortError` to avoid duplicate “Aborted.” messages. The `flow` command’s error handling does not follow this pattern and can still result in duplicated guardrail output, which is a behavioral deviation from the documented standard.

## Recommendations
- **R1 — Align flow resolution strictly with the canonical state order.**  
  Description: Refactor `detectNextFlowDecision` so that it derives the next step from the canonical ordering defined by `StateSchema` and the PRD (phases: define → prototype → refactor; steps in each phase as documented), minimizing reliance on `current_phase` and encoding of ad-hoc status combinations.  
  Impact: High — reduces the chance of “blocked” states and keeps behavior robust as the iteration workflow evolves.  
  Urgency: High — directly affects correctness of the flagship `nvst flow` experience.  
  Effort: Medium — requires redesign of the resolver and updates to existing tests.  
  Scope: `src/commands/flow.ts` (resolver logic) and `src/commands/flow.test.ts` (behavioral tests).
- **R2 — Unify error and guardrail handling between `runFlow` and `cli.ts`.**  
  Description: Adjust `runFlow` so that it either (a) does not catch `GuardrailAbortError` (letting the top-level handler manage messaging and exit codes) or (b) mirrors the same special-casing used in `cli.ts`, thereby eliminating duplicate “Aborted.” messages and keeping guardrail behavior consistent.  
  Impact: Medium — cleans up user-facing output and keeps behavior predictable across commands.  
  Urgency: Medium — user-visible but not blocking functionality.  
  Effort: Low — localized changes with straightforward tests.  
  Scope: `src/commands/flow.ts`, `src/cli.ts`, and `src/commands/flow.test.ts`.
- **R3 — Clarify and codify semantics for in-progress steps and approval gates.**  
  Description: Revisit the handling of `in_progress` statuses (e.g., requirement definition vs. prototype build) to ensure they match US‑001‑AC08 and US‑002: either consistently re-run in-progress steps or clearly document which statuses represent “awaiting approval” vs. “safe to re-execute”. Encode this distinction explicitly in `detectNextFlowDecision` and tests.  
  Impact: Medium — avoids surprising behavior when resuming partially-completed iterations.  
  Urgency: Medium — important before broader adoption of `nvst flow`.  
  Effort: Medium — requires careful design decisions plus test updates.  
  Scope: `scaffold/schemas/tmpl_state.ts` (documentation via comments), `src/commands/flow.ts`, and `src/commands/flow.test.ts`.
- **R4 — Reduce duplication of flow-specific configuration and messages.**  
  Description: Centralize shared flow configuration (step labels, approval messages, and mapping to CLI subcommands) into a small, declarative structure that both the resolver and tests can reuse, lowering the risk of message drift or missed updates when commands or wording change.  
  Impact: Medium — improves maintainability and consistency of user-facing output.  
  Urgency: Low-to-Medium — not a blocker but beneficial for future iterations.  
  Effort: Low-to-Medium — moderate refactor of `flow.ts` with limited surface area.  
  Scope: `src/commands/flow.ts`, `src/commands/flow.test.ts`.
- **R5 — Strengthen tests around schema alignment and edge cases.**  
  Description: Extend `flow` tests to explicitly verify the ordering and transitions implied by FR‑2/FR‑4 (including refactor-phase steps such as evaluation report and changelog), and to cover edge cases like unexpected `current_phase` values or partially-updated states.  
  Impact: Medium — protects future changes to state structure from silently breaking `nvst flow`.  
  Urgency: Low — complements R1 but is not strictly required before refactoring.  
  Effort: Low — mostly additional test cases.  
  Scope: `src/commands/flow.test.ts`.

