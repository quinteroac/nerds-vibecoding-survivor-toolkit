# Evaluation Report — Iteration 000015

## Strengths

- **Guardrail behaviour is implemented and tested.** All 20 test cases from the iteration test plan pass. The three modes (strict default, relaxed with confirmation, and `--force` bypass) work as specified.
- **Centralized guardrail logic.** `src/guardrail.ts` exports `assertGuardrail(state, violated, message, opts)` and `GuardrailAbortError`. All phase/status checks in the listed commands go through this utility; no inline phase-guard `throw` remains.
- **Schema alignment.** `flow_guardrail` is optional in both `scaffold/schemas/tmpl_state.ts` and `schemas/state.ts`; existing state files without the field continue to parse; default behaviour is strict.
- **CLI integration.** `--force` is parsed via `parseForce()` in `cli.ts` and passed to all commands that perform phase/status validation; commands without guardrails ignore unknown flags so `--force` does not cause parse errors.
- **Testability.** Guardrail uses injectable `readLineFn` and `stderrWriteFn`, enabling unit tests without a real TTY; tests are co-located (`src/guardrail.test.ts`, `src/force-flag.test.ts`) in line with project conventions.
- **Error handling conventions.** The codebase uses `process.exitCode` and does not call `process.exit()`; guardrail sets `exitCode = 1` and throws `GuardrailAbortError` on abort, which is consistent with documented error handling.

## Technical Debt

- **No TECHNICAL_DEBT.md.** The project has no dedicated technical-debt file; any new debt from this iteration is only captured here.
- **Duplicate abort message (low).** When the user declines in relaxed mode, `assertGuardrail` writes `Aborted.` to stderr and throws `GuardrailAbortError`. The process rejection is caught by `main().catch()` in `cli.ts`, which then prints `nvst failed: <error>`, so the user may see "Aborted." twice (once from guardrail, once from the catch). Impact: minor UX; effort: low (handle `GuardrailAbortError` in the catch to skip or shorten the message).

## Violations of PROJECT_CONTEXT.md

- **Modular Structure incomplete.** PROJECT_CONTEXT lists `src/cli.ts`, `src/agent.ts`, `src/state.ts`, `src/commands/*.ts`, and the rest of the structure, but does not mention `src/guardrail.ts`. The new shared module is part of the architecture and should be documented.

No other conventions, architecture, or standards were found to be violated: naming (camelCase helpers, PascalCase types), one file per command, state I/O in `state.ts`, no `process.exit()`, and test location conventions are respected.

## Recommendations

| # | Description | Impact | Urgency | Effort | Scope | Score (1–5, 5 = do first) |
|---|-------------|--------|---------|--------|--------|----------------------------|
| 1 | In `cli.ts`, in the `main().catch()` handler, detect `GuardrailAbortError` and avoid printing a second "Aborted." (e.g. skip logging or log only in non-abort cases). Reduces duplicate stderr output when the user declines the guardrail prompt. | UX clarity | Low | Low | `src/cli.ts` | 3 |
| 2 | Add `src/guardrail.ts` to the "Modular Structure" section of PROJECT_CONTEXT.md (e.g. "`src/guardrail.ts`: flow guardrail — assertGuardrail for phase/status violations, warn/prompt/throw and GuardrailAbortError"). Keeps project context in sync with the codebase. | Documentation accuracy | Low | Low | `.agents/PROJECT_CONTEXT.md` | 4 |
| 3 | Introduce a TECHNICAL_DEBT.md (or equivalent) and record the duplicate-abort-message item and any future debt there, so refactor and evaluation cycles have a single place to look. | Maintainability | Low | Low | New file or existing doc | 2 |
