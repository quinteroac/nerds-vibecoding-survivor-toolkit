# Evaluation Report — Iteration 000016

## Strengths

- **Command structure and naming:** The `approve prototype` command follows PROJECT_CONTEXT conventions: single handler in `src/commands/approve-prototype.ts`, exported `runApprovePrototype`, kebab-case filename, and correct CLI registration and dispatch in `src/cli.ts`.
- **Flow guardrail:** The handler calls `assertGuardrail` at the start with the correct condition and message, enforcing phase and guarding against misuse when not in prototype phase.
- **State validation:** Preconditions are checked before any git I/O: phase must be `prototype`, `prototype_approved` must be false. State is updated only after successful commit and push, preserving consistency on failure.
- **Git workflow:** Clean working tree is detected and handled with an informative message and no empty commit. Staging and commit use a single `git add -A && git commit -m …` step with iteration from state. Push uses `git push -u origin <current-branch>`. Current branch is resolved via `git branch --show-current`.
- **Error handling:** Descriptive `Error` messages for git status failure, commit failure (with distinct message when a pre-commit hook is present), branch detection failure, and push failure. No `process.exit()`; `process.exitCode = 1` is set on pre-commit hook failure and push failure; the CLI top-level catch sets exit code for other thrown errors.
- **Testability:** Handler accepts optional `ApprovePrototypeDeps` for logging, state I/O, time, and all git operations, enabling unit tests without real git or filesystem in several scenarios. Co-located tests in `approve-prototype.test.ts` cover CLI wiring, full flow (stage/commit/push/state update), clean tree skip, pre-commit hook error, push failure, already-approved rejection, and wrong-phase guardrail.
- **Pre-commit hook message:** When commit fails and a pre-commit hook exists, the error message matches FR-3: `Pre-commit hook failed:\n` plus hook output.
- **Test execution:** All 18 test cases in the iteration test plan were reported as passed.

## Technical Debt

- **From iteration 000015:** The duplicate "Aborted." message on guardrail decline was resolved in RI-002; no open debt remains from that iteration.
- **No new technical debt** is explicitly recorded in `.agents/TECHNICAL_DEBT.md` for this iteration. The ISSUES.json item (cannot approve when already approved) was addressed as fixed; the current behaviour (reject when `prototype_approved` is already true) is by design per US-004-AC02.

## Violations of PROJECT_CONTEXT.md

1. **Missing US-003 / FR-5 — PR creation via `gh` CLI:** The PRD requires `approve prototype` to detect `gh` availability and, when present, run `gh pr create` with title `feat: prototype it_<iteration>` and body referencing the iteration; when `gh` is absent, print a clear skip message; when `gh pr create` fails, treat as non-fatal warning and still update state. The current implementation has no `gh` detection, no `gh pr create` call, and no skip message for missing `gh`. This is a **scope/requirement violation**: the implemented command does not fulfil US-003 or FR-5.
2. **Order of operations vs PRD:** FR-5 implies PR creation occurs after push and before or around state update; the current code updates state immediately after push and does not perform any PR step. So the violation is both “missing feature” and “sequence” (no PR step in the flow).

No other PROJECT_CONTEXT conventions were found violated: error handling uses throw + exitCode, module layout and naming are correct, and forbidden patterns (process.exit(), synchronous I/O, third-party CLI frameworks) are not used.

## Recommendations

| # | Description | Impact | Urgency | Effort | Scope | Score (1–5, for ordering) |
|---|-------------|--------|---------|--------|--------|---------------------------|
| 1 | Implement `gh` detection and `gh pr create` in `approve prototype`: detect `gh` (e.g. via `gh --version` exit code), run `gh pr create --title "feat: prototype it_<iteration>" --body "Prototype for iteration it_<iteration>"` when available, print skip message when not, and treat `gh pr create` failures as non-fatal (warn and still update state). | High: completes iteration scope and PRD compliance. | High: required by PRD. | Medium: add deps (e.g. checkGhAvailableFn, runGhPrCreateFn), call after push and before state update, add warning path. | `approve-prototype.ts`, tests, possibly CLI help text. | 5 |
| 2 | Add unit tests for the new `gh` behaviour: gh available and PR created, gh unavailable (skip message), gh pr create fails (warning and state still updated). | Medium: prevents regressions and documents behaviour. | Medium. | Low. | `approve-prototype.test.ts`. | 4 |
| 3 | Optionally set `process.exitCode = 1` in the handler for generic commit failure (non–pre-commit path) before throwing, for consistency with other error paths that set it explicitly. | Low: CLI catch already sets exit code. | Low. | Trivial. | `approve-prototype.ts`. | 2 |
