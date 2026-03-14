# Audit — Iteration 000032

## Executive Summary

Iteration 000032 is largely compliant. All five user stories are fully met at the acceptance-criteria level. Eight of nine functional requirements comply; FR-3 was partially non-compliant because `src/commands/ideate.ts` used wrong context key names (`"ROADMAP.md"` / `"PROJECT_CONTEXT.md"` instead of `"roadmap"` / `"project_context"`), omitted the required `current_iteration` key, and excluded absent files instead of passing empty strings. This was remediated in the same iteration by reordering the state read and updating the `buildPrompt` call.

## Verification by FR

| FR | Assessment | Notes |
|----|-----------|-------|
| FR-1 | comply | `cli.ts` imports `runIdeate` and routes the `ideate` command with `--agent`/`--force` flags to it. |
| FR-2 | comply | `printUsage()` lists `ideate --agent <provider> [--force]` under the Primary workflow section. |
| FR-3 | comply (after fix) | `ideate.ts` now passes `{ current_iteration, roadmap, project_context }` to `buildPrompt`, with empty-string fallbacks for absent files. |
| FR-4 | comply | SKILL.md (Step 2) enforces a strict one-question-at-a-time interview (Q1–Q5). |
| FR-5 | comply | SKILL.md (Step 3) instructs 2–4 ideas with S/M/L effort estimates. |
| FR-6 | comply | SKILL.md (Step 4) instructs writing selected items to `ROADMAP.md` under `## Candidates`. |
| FR-7 | comply | `definePhase` in `tmpl_state.ts` includes optional `ideation` with correct Zod schema. |
| FR-8 | comply | `scaffold/.agents/skills/ideate/tmpl_SKILL.md` is identical to the live SKILL.md and present in the scaffold manifest. |
| FR-9 | comply | No new runtime dependencies introduced. |

## Verification by US

| US | Assessment | Notes |
|----|-----------|-------|
| US-001 | comply | All 6 ACs met: routing, help listing, `--force` accepted, missing `--agent` error, typecheck. |
| US-002 | comply | All 8 ACs met: SKILL.md exists with valid front matter, reads context, one-at-a-time interview, proposes 2–4 ideas, writes ROADMAP.md, flags PROJECT_CONTEXT.md updates. |
| US-003 | comply | All 3 ACs met: `tmpl_SKILL.md` exists with identical content and is included in the scaffold manifest so `nvst init` will produce it. |
| US-004 | comply | All 8 ACs met: correct export signature, reads context files, loads skill, `invokeAgent` with `interactive: true`, sets `ideation.status = "completed"` + `writeState` auto-refreshes `last_updated`, throws on non-zero exit code, guardrail warns without blocking. |
| US-005 | comply | All 5 ACs met: optional `ideation` field in `definePhase`, initialised as `{ status: "pending", file: null }` in `createInitialState`, backward-compatible via `.optional()`. |

## Minor Observations

- FR-3 key naming mismatch (remediated): the original implementation used `"ROADMAP.md"` / `"PROJECT_CONTEXT.md"` as `buildPrompt` keys. Because `buildPrompt` renders keys as section headers and SKILL.md does not use substitution variables, there was no observable regression, but the interface contract was not met.
- `current_iteration` was missing from the prompt context in the original implementation. No skill step depended on it, but its absence would become a problem if future SKILL.md versions reference the current iteration.
- Absent files were omitted rather than passed as empty strings. The skill handles missing files gracefully via its own instructions; no user-visible regression existed.
- US-004-AC02 and FR-3 use slightly inconsistent wording (AC says "passes their content as context", FR specifies exact key names). Future PRD authors should align AC wording with FR interface contracts to avoid ambiguity.

## Conclusions and Recommendations

The iteration delivered a complete and working `nvst ideate` command. The single gap (FR-3 context key contract) was low-risk and has been remediated. No further changes are required for this iteration. Future iterations building on the ideation skill should ensure that any new SKILL.md templates that reference `{roadmap}`, `{project_context}`, or `{current_iteration}` will now receive the correctly named keys.

## Refactor Plan

| # | File | Change | Priority |
|---|------|--------|----------|
| 1 | `src/commands/ideate.ts` | Move `readState` before file reads; pass `{ current_iteration, roadmap, project_context }` to `buildPrompt` with empty-string fallbacks. | **Done** — applied in this audit. |
