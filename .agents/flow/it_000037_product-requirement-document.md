# Requirement: Documentation Update for Iterations 036 and 037

## Context

Iterations 036 and 037 introduced two significant changes to the toolkit that are not yet reflected in the existing documentation (`README.md`, `docs/nvst-flow/COMMANDS.md`, `docs/nvst-flow/QUICK_USE.md`):

- **it_000036** — Skill directories renamed to align 1:1 with CLI commands (`create-pr-document` → `define-requirement`, `refine-pr-document` → `refine-requirement`, `implement-user-story` → `create-prototype`).
- **it_000037** — All workflow skills can now be invoked standalone from any AI agent CLI (e.g. `/define-requirement` in Claude Code) without NVST being active. All workflow skills are marked `user-invocable: true`.

Additionally, `CHANGELOG.md` does not exist at the repository root; a new one must be created covering both iterations.

## Goals

- `README.md` accurately describes the current skill names, standalone invocation capability, and agent providers.
- `docs/nvst-flow/COMMANDS.md` reflects all current commands and providers (resolving discrepancies with `README.md`).
- `docs/nvst-flow/QUICK_USE.md` includes a section explaining standalone skill invocation.
- A `CHANGELOG.md` exists at the repository root with entries for it_000036 and it_000037.
- A reviewer can read the docs and understand every NVST command and skill behavior without reading source code.

## User Stories

### US-001: Update README.md to reflect it_000036 and it_000037

**As a** developer using NVST from the CLI,
**I want** the README to accurately describe the current skill names, standalone invocation capability, and all supported agent providers,
**so that** I can understand what the toolkit does and how to use it from a single document.

**Acceptance Criteria:**
- [ ] The Features section references the new skill names (`define-requirement`, `refine-requirement`, `create-prototype`) — old names (`create-pr-document`, `refine-pr-document`, `implement-user-story`) are removed.
- [ ] The Features section mentions that NVST workflow skills can be invoked standalone from any AI agent CLI (e.g. Claude Code, Cursor) without needing NVST active.
- [ ] The agent providers list is consistent with `COMMANDS.md` and includes `ide` and `copilot` if they are implemented; otherwise they are removed.
- [ ] No other content in README is removed or altered beyond what is necessary for accuracy.
- [ ] Typecheck / lint passes (markdown file — no code changes).

---

### US-002: Align `docs/nvst-flow/COMMANDS.md` with current implementation

**As a** developer reading the command reference,
**I want** `COMMANDS.md` to list every current command and option (including those present in README but missing from the reference),
**so that** the command reference is the single authoritative source and does not contradict the README.

**Acceptance Criteria:**
- [ ] The Utilities table includes `nvst sync skills`, `nvst write-technical-debt`, and `nvst start iteration` if those commands are implemented in `src/`.
- [ ] The Global Options table lists `ide` and `copilot` as valid `--agent` values if they are implemented; otherwise the README is corrected to remove them.
- [ ] No commands listed in COMMANDS.md are stale (i.e. no longer implemented).
- [ ] Typecheck / lint passes.

---

### US-003: Add standalone skill invocation section to `docs/nvst-flow/QUICK_USE.md`

**As a** developer who prefers using AI agent CLIs directly (e.g. Claude Code),
**I want** `QUICK_USE.md` to explain how to invoke NVST skills standalone without running `nvst`,
**so that** I can use the workflow without the `nvst` binary.

**Acceptance Criteria:**
- [ ] A new section "Standalone Skill Invocation" is added to `QUICK_USE.md`.
- [ ] The section explains that NVST skills (e.g. `/define-requirement`, `/create-prototype`) can be invoked directly from any AI agent CLI that loads skills via `npx skills add`.
- [ ] The section describes the fallback behavior: skill detects NVST absence, reads existing artifacts, and interactively asks the user for any missing context.
- [ ] Typecheck / lint passes.

---

### US-004: Create `CHANGELOG.md` at repository root with entries for it_000036 and it_000037

**As a** developer or contributor,
**I want** a `CHANGELOG.md` at the repository root that records what changed in each iteration,
**so that** I can understand the evolution of the toolkit without reading individual PRDs.

**Acceptance Criteria:**
- [ ] `CHANGELOG.md` is created at the repository root (not under `docs/`).
- [ ] It follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) format (`## [Unreleased]`, `### Added`, `### Changed`, etc.).
- [ ] Entry for **it_000036** documents the skill rename: old names → new names, and lists the affected source files.
- [ ] Entry for **it_000037** documents standalone skill invocation: which skills were updated, the `user-invocable: true` frontmatter change, and the self-detection fallback behavior.
- [ ] Typecheck / lint passes.

---

## Functional Requirements

- FR-1: All documentation changes must accurately reflect the current state of the source code — verify against `src/commands/`, `nvst-skills/`, and `src/nvst-skills-manifest.ts` before writing.
- FR-2: Changes must be additive or corrective only — do not remove existing content unless it is demonstrably stale or incorrect.
- FR-3: `CHANGELOG.md` must use Keep a Changelog format; entries must reference iteration IDs (e.g. `it_000036`, `it_000037`).
- FR-4: No changes may be made to source code (`src/`) — only documentation files.
- FR-5: All content must be in English (per AGENTS.md rule).

## Non-Goals (Out of Scope)

- Updating documentation under `.agents/flow/archived/` — historical artifacts are read-only.
- Rewriting or restructuring `process_design.md`.
- Updating JSDoc or inline code comments.
- Updating the `scaffold/` template documents (e.g. `scaffold/.agents/tmpl_PROJECT_CONTEXT.md`).
- Publishing or releasing the package.

## Open Questions

- None
