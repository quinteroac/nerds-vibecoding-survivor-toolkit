# Technical Debt

<!-- All content in English. Updated when approving refactor plan or after resolving known debt items.
     Used as input in future iteration evaluations so that evaluation and refactor cycles have a
     single place to look. -->

## From iteration 000015

### [RESOLVED] Duplicate "Aborted." message on guardrail decline

**Status:** Resolved in RI-002 (iteration 000015)

When the user declined a guardrail confirmation prompt in relaxed mode (no `--force`), the
`assertGuardrail` function wrote `Aborted.` to stderr and then threw `GuardrailAbortError`.
The top-level `main().catch()` in `cli.ts` caught the error and printed a second `nvst failed: …`
message, so the user saw `Aborted.` twice.

**Resolution:** Added an `instanceof GuardrailAbortError` check to the top-level catch block so
that already-handled abort errors bypass the generic failure message. Exit code behaviour is
unchanged.

---

<!-- Add a new section per iteration when new debt items are identified or resolved.
     Deferred items (not included in any refactor plan) should be recorded here with rationale. -->
