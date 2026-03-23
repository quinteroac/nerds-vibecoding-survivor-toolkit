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

## From iteration 000036

### Pre-existing test suite failures (17 tests)

The following test failures were observed during the iteration 000036 audit. They are **not** caused
by the skill-rename changes in this iteration and were present before it began.

| Test file | Failing count | Root cause summary |
|-----------|:---:|---|
| `tests/audit-prototype-skill.test.ts` | 7 | Skill content / UI references out of sync with current SKILL.md |
| `tests/ideate-skill.test.ts` | 5 | Missing `.agents/skills/ideate/SKILL.md` scaffold file |
| `tests/refine-project-context-skill.test.ts` | 3 | Missing scaffold file |
| `tests/refactor-prototype-skill.test.ts` | 2 | Skill content / UI references out of sync |

**Rationale for deferral:** Failures are isolated to skill-content assertions and missing scaffold
files; they do not affect runtime behaviour or any command handler. Fixing them requires either
updating the expected skill snapshots or ensuring scaffold files are present in the test
environment — both are low-risk, self-contained changes suitable for a dedicated cleanup iteration.

---

<!-- Add a new section per iteration when new debt items are identified or resolved.
     Deferred items (not included in any refactor plan) should be recorded here with rationale. -->
