# Requirement: Meaningful Branch Names for Create Prototype

## Context
When `nvst create prototype` creates a Git branch, it currently uses a generic name
(`feature/it_XXXXXX`) that provides no context about what is being built. Developers
and automated pipelines benefit from descriptive branch names that include a slug
derived from the PRD requirement title, making branches immediately identifiable in
Git GUIs, CI dashboards, and PR lists.

## Goals
- Generate a human-readable branch name that includes a kebab-case slug from the PRD requirement title.
- Keep branch names within 50 characters to avoid filesystem and remote compatibility issues.
- Produce URL-safe, lowercase, hyphen-separated slugs with no special characters.

## User Stories

### US-001: Slug extracted from PRD title
**As a** developer or automated process running `nvst create prototype`, **I want** the
branch name to include a slug derived from the `# Requirement:` title in the PRD
markdown file **so that** the branch is immediately identifiable without opening files.

**Acceptance Criteria:**
- [ ] `runCreatePrototype` reads `.agents/flow/it_XXXXXX_product-requirement-document.md` and extracts the text after `# Requirement:` on the first matching line.
- [ ] The extracted title is converted to a kebab-case slug: lowercased, non-alphanumeric characters replaced with hyphens, consecutive hyphens collapsed, leading/trailing hyphens trimmed.
- [ ] A pure helper function `toKebabSlug(title: string): string` is exported from `src/commands/create-prototype.ts` (or a shared util) and unit-tested.
- [ ] Typecheck / lint passes.

### US-002: Branch created with slug suffix
**As a** developer or automated process running `nvst create prototype`, **I want** the
Git branch to be named `feature/it_XXXXXX_<slug>` **so that** the branch communicates
the feature context.

**Acceptance Criteria:**
- [ ] The branch name follows the pattern `feature/it_XXXXXX_<slug>`.
- [ ] The full branch name is truncated to a maximum of 50 characters (slug truncated, never the `feature/it_XXXXXX_` prefix).
- [ ] The branch is created and checked out under the new name; no branch with the old format (`feature/it_XXXXXX`) is created.
- [ ] All existing tests in `tests/` pass; no regression in `create prototype` behavior.
- [ ] Typecheck / lint passes.

## Functional Requirements
- FR-1: A function `toKebabSlug(title: string): string` converts a free-text title to a kebab-case slug (lowercase, alphanumeric + hyphens only, consecutive hyphens collapsed, leading/trailing hyphens trimmed).
- FR-2: `runCreatePrototype` reads `it_${iteration}_product-requirement-document.md` from `.agents/flow/` and applies `toKebabSlug` to the text after `# Requirement:` to produce the slug.
- FR-3: The branch name is constructed as `feature/it_${iteration}_${slug}`, truncated so the total length does not exceed 50 characters.
- FR-4: Branch creation and checkout logic in `runCreatePrototype` uses the new branch name from FR-3.
- FR-5: `toKebabSlug` is covered by unit tests in `tests/`.

## Non-Goals (Out of Scope)
- Fallback behavior when the PRD markdown file is missing (workflow already guarantees it exists before `create prototype` runs).
- Renaming existing branches from previous iterations.
- Changing the PR title or body format.
- Modifying `PrdSchema` or the JSON PRD format.

## Open Questions
- None.
