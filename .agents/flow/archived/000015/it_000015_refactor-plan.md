# Refactor Plan — Iteration 000015

## Refactor Items

### RI-001: Document `src/guardrail.ts` in PROJECT_CONTEXT.md

**Description:** The "Modular Structure" section of `.agents/PROJECT_CONTEXT.md` does not list `src/guardrail.ts`. This module is part of the architecture (centralized flow guardrail: `assertGuardrail`, warn/prompt/throw behaviour, and `GuardrailAbortError`). Omitting it makes the documented structure out of sync with the codebase and can confuse future refactors or onboarding.

**Rationale:** Quick win with high impact on documentation accuracy. Keeping PROJECT_CONTEXT aligned with the codebase is a convention; fixing it is low effort and reduces the risk of the guardrail module being overlooked in later iterations.

### RI-002: Avoid duplicate "Aborted." when user declines guardrail

**Description:** When the user declines the guardrail confirmation (relaxed mode, no `--force`), `assertGuardrail` writes `Aborted.` to stderr and throws `GuardrailAbortError`. The rejection is caught by `main().catch()` in `cli.ts`, which then logs `nvst failed: <error>`, so the user can see "Aborted." twice. Change the top-level catch so that when the error is a `GuardrailAbortError`, the handler does not print the generic failure message (exitCode is already set and the message was already written by the guardrail).

**Rationale:** Quick win: low effort, improves UX by removing redundant stderr output. No change to guardrail behaviour or exit codes; only the CLI’s reaction to an already-handled abort is adjusted.

### RI-003: Introduce TECHNICAL_DEBT.md and record known debt

**Description:** The project has no dedicated technical-debt file. Create `.agents/TECHNICAL_DEBT.md` (or an equivalent agreed location) and record the duplicate-abort-message item as resolved once RI-002 is done, and use it for any future debt so that evaluation and refactor cycles have a single place to look.

**Rationale:** Long-term maintainability improvement. Low urgency and low effort; doing it after RI-001 and RI-002 keeps the refactor plan ordered by immediate impact first.
