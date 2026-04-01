# Audit Report — Iteration 000040

## Executive Summary

Iteration 000040 implements PR metadata enrichment in `approve-prototype`: the PR title is extracted from the PRD markdown heading, the body includes the Context and Goals sections, and a "Made with NVST" footer is always appended. All 46 dedicated tests pass and typecheck is clean. Two minor spec deviations were found: (1) FR-2 specified a combined `extractPrdSections` function with a `{ title, context, goals }` return type, but the implementation uses `extractPrdSection` (singular, takes a section name) plus the existing `extractPrdTitle` from `create-prototype.ts`; (2) FR-4 specified the PR body as `{context}\n\n{goals}\n\n---\n_Made with NVST_`, but the actual body prepends the requirement name and appends a refactor-report path before the footer. These deviations do not break any user-facing behaviour and all ACs are met.

---

## Verification by FR

| FR | Assessment | Notes |
|----|------------|-------|
| FR-1 | ✅ comply | `runApprovePrototype` calls `readPrdMarkdownFn(prdMdPath)` and awaits the result before calling `createPullRequestFn`. |
| FR-2 | ⚠️ partially_comply | FR-2 requires an exported `extractPrdSections(markdown): { title, context, goals }` function. The implementation exports `extractPrdSection(content, sectionName)` (singular, reusable per-section) and reuses `extractPrdTitle` from `create-prototype.ts`. The combined functionality is equivalent but the exact function signature and name from the spec are absent. |
| FR-3 | ✅ comply | PR title is built as `feat: it_${iteration} — ${requirementName}`, matching the required format exactly. |
| FR-4 | ⚠️ partially_comply | The PR body contains the context section, goals section, and NVST footer joined by blank lines; however the spec body structure is supplemented by a leading `requirementName` line and a `Refactor report: {path}` entry inserted before the footer. All tests validate the presence of required elements. |
| FR-5 | ✅ comply | `createPullRequestFn(projectRoot, title, body)` signature is unchanged. |
| FR-6 | ✅ comply | All fallback warnings are emitted via `mergedDeps.warnFn(...)`. No direct `console.warn` call exists in the new code paths. |

---

## Verification by US

| US | Assessment | Notes |
|----|------------|-------|
| US-001 | ✅ comply | All 4 ACs verified by passing tests. Heading extraction uses `# Requirement:` pattern consistent with the PRD file convention; heading text without the prefix is used as PR title. |
| US-002 | ✅ comply | All 5 ACs verified. `extractPrdSection(content, 'Context')` and `extractPrdSection(content, 'Goals')` are called; missing sections are silently skipped; sections joined with `\n\n`. |
| US-003 | ✅ comply | All 3 ACs verified. `createPullRequestFn` is called with the extracted title and a body that always ends with `NVST_PR_FOOTER`. |
| US-004 | ✅ comply | All 3 ACs verified. `NVST_PR_FOOTER` constant equals `---\n_Made with [NVST](https://github.com/NerdsVibe/nerds-vibecoding-survivor-toolkit)_` and is always the last element appended, including in fallback mode. |
| US-005 | ✅ comply | All 5 ACs verified. When `readPrdMarkdownFn` returns null or PRD has no `# Requirement:` heading, `warnFn` is called and the default title is used. No throws or non-zero exits occur. Footer is appended in fallback mode. |

---

## Minor Observations

- **FR-2 API mismatch**: The PRD specifies `extractPrdSections(markdown): { title, context, goals }` but the implementation exports `extractPrdSection(content, sectionName)`. This is a cleaner design (single-responsibility, more flexible) but diverges from the spec contract. Future callers expecting `extractPrdSections` won't find it.
- **FR-4 body structure**: The PR body prepends the requirement name as plain text before the Context/Goals sections, and includes a `Refactor report: {path}` line between Goals and the footer. The spec structure omits these extras. The result is a slightly more verbose PR body but provides additional reviewer context.
- **US-001-AC02 interpretation**: The AC says "first markdown heading (line starting with `# `)" but `extractPrdTitle` matches only `# Requirement: ...` (specific prefix). Any PRD file with a different top-level heading format would not extract a title. This is unlikely to be a problem given the fixed PRD template.
- **Typecheck**: `bun tsc --noEmit` exits 0. All 46 iteration tests pass.

---

## Conclusions and Recommendations

The implementation fully delivers the user-facing goals of iteration 000040: PR titles are enriched with the PRD heading, the PR body surfaces Context and Goals for reviewers, and the NVST footer is consistently appended with or without a PRD file. The two FR deviations (FR-2 naming, FR-4 structure) are low-risk improvements on the spec rather than gaps.

Recommended actions:
1. Add `extractPrdSections` as an exported wrapper in `approve-prototype.ts` that satisfies FR-2's contract exactly, keeping `extractPrdSection` as the underlying implementation.
2. Keep the extra body elements (`requirementName` preamble and `Refactor report:` line) — they add reviewer value and are intentional per the tests. Document the actual body structure in FR-4 going forward.

---

## Refactor Plan

### Step 1 — Add `extractPrdSections` wrapper (FR-2)

**File:** `src/commands/approve-prototype.ts`

Add the following export after `extractPrdSection`:

```typescript
export function extractPrdSections(markdown: string): {
  title: string | null;
  context: string | null;
  goals: string | null;
} {
  return {
    title: extractPrdTitle(markdown),
    context: extractPrdSection(markdown, "Context"),
    goals: extractPrdSection(markdown, "Goals"),
  };
}
```

This satisfies FR-2's exact export contract without changing any existing behaviour.

### Step 2 — Add unit tests for `extractPrdSections` (FR-2 testability)

**File:** `tests/it_000040_us-002-pr-body-from-prd.test.ts`

Add a `describe("extractPrdSections helper", ...)` block that verifies the `{ title, context, goals }` shape is returned correctly, including null returns for absent sections.

### Step 3 — No changes to body structure (FR-4)

The `requirementName` preamble and `Refactor report:` line are intentional additions confirmed by existing tests. The refactor plan documents that FR-4's spec should be considered updated to reflect the actual implemented structure. No code changes required for body structure.
