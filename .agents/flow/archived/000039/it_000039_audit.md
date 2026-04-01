# Audit — Iteration 000039: Meaningful Branch Names for Create Prototype

## Executive Summary

All functional requirements and user stories for iteration 000039 are fully implemented and verified. `toKebabSlug` and `extractPrdTitle` are exported from `src/commands/create-prototype.ts`, `buildBranchName` correctly constructs and truncates branch names to ≤50 characters, and `runCreatePrototype` reads the PRD markdown and applies the slug logic. All 25 dedicated unit tests pass, the full suite (238 tests) is green, and TypeScript compilation succeeds.

## Verification by FR

| FR ID | Description | Assessment |
|-------|-------------|------------|
| FR-1 | `toKebabSlug(title)` converts free-text to kebab-case slug | comply |
| FR-2 | `runCreatePrototype` reads PRD markdown and applies `toKebabSlug` to `# Requirement:` title | comply |
| FR-3 | Branch name `feature/it_${iteration}_${slug}` truncated to ≤50 characters | comply |
| FR-4 | Branch creation/checkout uses new name from FR-3 | comply |
| FR-5 | `toKebabSlug` covered by unit tests in `tests/` | comply |

## Verification by US

| US ID | Title | Assessment |
|-------|-------|------------|
| US-001 | Slug extracted from PRD title | comply |
| US-002 | Branch created with slug suffix | comply |

## Minor Observations

1. When the PRD markdown file (`it_XXXXXX_product-requirement-document.md`) is absent, `runCreatePrototype` silently falls back to the old `feature/it_XXXXXX` branch name with no warning to the user. A log message in this path would improve observability.
2. No `lint` script is defined in `package.json`; linting is implicitly enforced only through TypeScript strict mode.

## Conclusions and Recommendations

The implementation fully satisfies the PRD. No blocking issues were found. Two minor improvements are recommended:

1. Add a `warn`/`log` call in `runCreatePrototype` when the PRD markdown file is missing, so the fallback branch name is visible to the operator.
2. Consider adding a `lint` script to `package.json` for consistent tooling hygiene.

## Refactor Plan

### Task 1 — Log warning when PRD markdown is absent (FR-2 / US-001)

**File:** `src/commands/create-prototype.ts`  
**Location:** Lines ~326–333 — the `if (await exists(prdMdPath))` block.  
**Change:** Add an `else` branch that calls `mergedDeps.warnFn(...)` to notify that the markdown file was not found and the branch will use the bare iteration format.

```ts
// Before
if (await exists(prdMdPath)) {
  const prdMdContent = await readFile(prdMdPath, "utf8");
  const prdTitle = extractPrdTitle(prdMdContent);
  if (prdTitle) {
    slug = toKebabSlug(prdTitle);
  }
}

// After
if (await exists(prdMdPath)) {
  const prdMdContent = await readFile(prdMdPath, "utf8");
  const prdTitle = extractPrdTitle(prdMdContent);
  if (prdTitle) {
    slug = toKebabSlug(prdTitle);
  } else {
    mergedDeps.warnFn(`[warn] No '# Requirement:' heading found in ${prdMdPath}. Branch will use bare iteration format.`);
  }
} else {
  mergedDeps.warnFn(`[warn] PRD markdown not found at ${prdMdPath}. Branch will use bare iteration format.`);
}
```

**Test:** Add a unit test case in `tests/it_000039_us-001-slug-from-prd.test.ts` (or a new file) verifying that `warnFn` is called when the markdown is absent.

### Task 2 — Add lint script to package.json (non-functional hygiene)

**File:** `package.json`  
**Change:** Add a `"lint"` script that runs `tsc --noEmit` (or integrate an ESLint config if desired). Minimal viable option:

```json
"lint": "tsc --noEmit"
```

This ensures `bun run lint` is a recognised entry point for CI and tooling.
