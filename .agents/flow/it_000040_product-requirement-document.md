# Requirement: PR Metadata from PRD on Approve Prototype

## Context
When `nvst approve prototype` creates a GitHub Pull Request it currently derives the PR title from the first user story in the JSON PRD file and generates a minimal body with only the refactor report path. This means the PR carries no meaningful description of _why_ the change was made. The markdown PRD already contains a human-readable title, a Context section explaining the problem, and a Goals section listing objectives — all of which should appear on the PR for traceability and reviewer clarity.

## Goals
- Use the PRD markdown title (first `# Heading`) as the PR title instead of the JSON-derived story title.
- Populate the PR body with the **Context** and **Goals** sections extracted from the PRD markdown file.
- Append a "Made with NVST" footer with a link to the GitHub repository so reviewers know how the PR was generated.
- Gracefully fall back to the current default title/body if the PRD markdown file is missing or unparseable.

## User Stories

### US-001: Extract PR title from PRD markdown heading
**As a** developer running `bun nvst approve prototype`, **I want** the PR title to be derived from the `# Heading` of `it_XXXXXX_product-requirement-document.md` **so that** the PR immediately communicates what feature or change was built.

**Acceptance Criteria:**
- [ ] `approve-prototype` reads `.agents/flow/it_{iteration}_product-requirement-document.md`.
- [ ] The first markdown heading (line starting with `# `) is extracted and used as the PR title (without the leading `# `).
- [ ] The existing `feat: it_{iteration} —` prefix is preserved in the PR title (e.g. `feat: it_000040 — PR Metadata from PRD on Approve Prototype`).
- [ ] Typecheck / lint passes.

### US-002: Build PR body from Context and Goals sections
**As a** developer running `bun nvst approve prototype`, **I want** the PR body to contain the **Context** and **Goals** sections from the PRD markdown **so that** reviewers understand the motivation and objectives without opening a separate file.

**Acceptance Criteria:**
- [ ] The `## Context` section (heading + body text) is included in the PR body.
- [ ] The `## Goals` section (heading + bullet list) is included in the PR body.
- [ ] Sections are separated by a blank line for readability.
- [ ] If either section is absent from the PRD, the present section is still included; neither causes the command to fail.
- [ ] Typecheck / lint passes.

### US-003: Create GitHub PR using extracted title and body
**As a** developer running `bun nvst approve prototype`, **I want** `gh pr create` to be called with the extracted title and body **so that** the resulting GitHub PR is self-descriptive.

**Acceptance Criteria:**
- [ ] `gh pr create --title <extracted-title> --body <extracted-body>` is called (existing mechanism unchanged).
- [ ] The PR body ends with the "Made with NVST" footer (see US-004).
- [ ] Typecheck / lint passes.

### US-004: Append "Made with NVST" footer to PR body
**As a** developer running `bun nvst approve prototype`, **I want** every generated PR body to include a footer crediting NVST with a link to the repository **so that** collaborators know how the PR was created.

**Acceptance Criteria:**
- [ ] The PR body always ends with a footer line: `---\n_Made with [NVST](https://github.com/NerdsVibe/nerds-vibecoding-survivor-toolkit)_` (or equivalent markdown).
- [ ] The footer is appended even when falling back to the default title/body (PRD not found).
- [ ] Typecheck / lint passes.

### US-005: Fallback when PRD markdown is missing or unparseable
**As a** developer running `bun nvst approve prototype`, **I want** the command to fall back to the current default PR title/body **so that** the approve flow is never blocked by a missing or malformed PRD file.

**Acceptance Criteria:**
- [ ] If `it_{iteration}_product-requirement-document.md` does not exist, a warning is logged and the existing default title/body is used.
- [ ] If the file exists but no `# Heading` is found, a warning is logged and the default title is used.
- [ ] The command never throws or exits non-zero solely due to PRD markdown parsing failure.
- [ ] The "Made with NVST" footer is still appended in fallback mode.
- [ ] Typecheck / lint passes.

## Functional Requirements
- FR-1: `runApprovePrototype` MUST attempt to read `.agents/flow/it_{iteration}_product-requirement-document.md` before calling `createPullRequestFn`.
- FR-2: A helper function `extractPrdSections(markdown: string): { title: string | null; context: string | null; goals: string | null }` MUST be implemented and exported from `approve-prototype.ts` (or a shared utility) for unit testability.
- FR-3: The PR title format MUST remain `feat: it_{iteration} — {title}`.
- FR-4: PR body MUST follow the structure: `{context section}\n\n{goals section}\n\n---\n_Made with [NVST]({link})_`.
- FR-5: All existing `createPullRequestFn` call sites and their signatures MUST remain unchanged.
- FR-6: Fallback warnings MUST be emitted via `warnFn` (injected dep), not `console.warn` directly.

## Non-Goals (Out of Scope)
- Changing how the PRD JSON file is used elsewhere.
- Modifying the PR creation mechanism (`gh pr create`) or adding new CLI flags.
- Rendering or reformatting any other sections of the PRD (e.g., User Stories, Functional Requirements).
- Adding end-to-end or integration tests for PR creation.

## Open Questions
- None
