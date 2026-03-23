# Requirement: Rename Skills to Match Process Command Names

## Context
NVST skills are currently named after their original purpose (e.g. `create-pr-document`, `implement-user-story`) rather than the CLI command that invokes them (e.g. `define-requirement`, `create-prototype`). This makes it hard for developers to quickly identify which skill belongs to which process phase when browsing `~/.agents/skills/` or `nvst-skills/`. The rename aligns skill names 1:1 with the process vocabulary.

## Goals
- Skill directory names in `nvst-skills/` and `~/.agents/skills/` match the `nvst` command that loads them.
- `loadSkill()` calls in all four affected command handlers use the new names.
- All tests and generated manifests are updated to reflect the new names.
- No backward-compatibility shims — old names are removed entirely.

## User Stories

### US-001: Rename skill directories in `nvst-skills/`
**As a** developer browsing `nvst-skills/` or `~/.agents/skills/`, **I want** skill folder names to match the `nvst` command that loads them **so that** I can immediately identify which skill belongs to which phase.

**Acceptance Criteria:**
- [ ] `nvst-skills/create-pr-document/` is renamed to `nvst-skills/define-requirement/`
- [ ] `nvst-skills/refine-pr-document/` is renamed to `nvst-skills/refine-requirement/`
- [ ] `nvst-skills/implement-user-story/` is renamed to `nvst-skills/create-prototype/`
- [ ] Old directories (`create-pr-document`, `refine-pr-document`, `implement-user-story`) no longer exist in `nvst-skills/`
- [ ] Typecheck / lint passes

### US-002: Update `loadSkill()` calls in command handlers
**As a** developer reading the source code, **I want** each command handler to call `loadSkill` with the name matching its own file name **so that** the relationship between command and skill is obvious.

**Acceptance Criteria:**
- [ ] `src/commands/define-requirement.ts`: `loadSkill(projectRoot, "create-pr-document")` → `loadSkill(projectRoot, "define-requirement")`
- [ ] `src/commands/refine-requirement.ts`: `loadSkill(projectRoot, "refine-pr-document")` → `loadSkill(projectRoot, "refine-requirement")`
- [ ] `src/commands/create-prototype.ts`: `loadSkill(projectRoot, "implement-user-story")` → `loadSkill(projectRoot, "create-prototype")`
- [ ] No other source files reference the old skill names
- [ ] Typecheck / lint passes

### US-003: Update tests that reference old skill names
**As a** developer running the test suite, **I want** tests to reference the new skill names **so that** the suite stays green after the rename.

**Acceptance Criteria:**
- [ ] `tests/implement-user-story-skill.test.ts` is renamed to `tests/create-prototype-skill.test.ts` and all internal references to `implement-user-story` are updated to `create-prototype`
- [ ] `tests/us-004-skill-migration.test.ts` and `tests/us-003-command-compatibility.test.ts` are updated to reference the new skill names wherever the old names appear
- [ ] `bun test` passes with no failures related to skill loading
- [ ] Typecheck / lint passes

### US-004: Regenerate the `nvst-skills-manifest.ts`
**As a** developer distributing NVST, **I want** the generated manifest to list the new skill names **so that** the package correctly advertises the available skills.

**Acceptance Criteria:**
- [ ] `bun run src/scripts/generate-nvst-skills-manifest.ts` (or equivalent) is executed after the rename
- [ ] The resulting `src/nvst-skills-manifest.ts` no longer references `create-pr-document`, `refine-pr-document`, `implement-user-story`, or `automated-fix`
- [ ] The manifest includes `define-requirement`, `refine-requirement`, `create-prototype`, and `execute-automated-fix`
- [ ] Typecheck / lint passes

## Functional Requirements
- FR-1: Skill names must use `kebab-case` (matching existing convention — e.g. `define-requirement`, not `define_requirement`).
- FR-2: The rename is a hard rename — no aliases or fallback lookups for old names.
- FR-3: All three renames must be applied atomically in a single iteration; partial renames are not acceptable.

## Non-Goals (Out of Scope)
- Renaming skills that already match their command name (`audit-prototype`, `refactor-prototype`, `approve-prototype`, `create-project-context`, `refine-project-context`, `ideate`).
- `automated-fix` / `execute-automated-fix` — legacy command, out of scope for this iteration.
- Updating documentation files in `.agents/flow/archived/` — historical artifacts are read-only.
- Providing a migration path or deprecation warning for users who manually installed old skill names globally.
- Any changes to skill content (SKILL.md body) — only directory/reference names change.
