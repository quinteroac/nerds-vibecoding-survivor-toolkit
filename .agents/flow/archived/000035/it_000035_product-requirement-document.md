# Requirement: Install NVST Skills via `nvst init`

## Context
`nvst init` currently scaffolds NVST skills into the target project under `.agents/`, which can clutter repositories for users who do not want NVST-managed skills committed into the project tree. The new flow should invoke the `skills` package (`npx skills add` from https://github.com/vercel-labs/skills) to install the framework skills from the `nvst-skills` folder instead of relying on the existing `tmpl_` scaffold approach. Scope selection (project-level vs global) is handled interactively by `npx skills add` itself — `nvst init` does not need to prompt for it separately.

The `nvst-skills` folder is a new top-level directory in this repository, populated by migrating the existing `tmpl_SKILL.md` files out of `scaffold/.agents/skills/`. After migration, the `tmpl_` skill files are removed from the scaffold so that skills are no longer distributed via the old static-copy mechanism.

## Goals
- Let the user choose between project-level and global skill installation via the interactive `npx skills add` flow.
- Install NVST framework skills through `npx skills add`.
- Source the installable skills from the repository's `nvst-skills` folder.
- Migrate existing `tmpl_` skill files into `nvst-skills` and remove them from `scaffold/.agents/skills/`.
- Finish `nvst init` with the skills installed in the chosen location.

## User Stories

### US-001: Choose where NVST skills are installed
**As a** user running `nvst init`, **I want** the skills installer to guide me through scope selection **so that** I can decide whether skills land in my project or globally without `nvst init` needing to implement its own scope prompt.

**Acceptance Criteria:**
- [ ] `nvst init` delegates scope selection entirely to `npx skills add` — it does not present its own project-vs-global prompt.
- [ ] The `npx skills add` interactive flow is presented to the user during `nvst init` so they can choose scope.
- [ ] If the user aborts the `npx skills add` interaction (e.g. Ctrl+C), `nvst init` exits cleanly without leaving a partially installed state.
- [ ] Typecheck / lint passes.

### US-002: Install skills through the `skills` package
**As a** user running `nvst init`, **I want** the command to invoke the `skills` installer **so that** NVST skills are installed using the package-based workflow instead of the old static scaffold mechanism.

**Acceptance Criteria:**
- [ ] `nvst init` invokes `npx skills add <nvst-skills-path>` as part of the init workflow, without passing a scope flag (scope is chosen interactively by the user within the `skills` CLI).
- [ ] The installer uses the repository's `nvst-skills` folder as the source of the NVST framework skills.
- [ ] The install step completes successfully before `nvst init` exits.
- [ ] Typecheck / lint passes.

### US-003: Complete init with skills installed in the selected location
**As a** user finishing `nvst init`, **I want** the selected skills installation to be present at the end of the command **so that** the project is ready to use immediately.

**Acceptance Criteria:**
- [ ] After a successful run, the selected scope contains the NVST skills that were installed by the `skills` package.
- [ ] The command reports successful completion only after the skill installation step has finished.
- [ ] Running `nvst init` with an existing project does not leave the workflow in a partially installed state.
- [ ] Running `nvst init` on an already-initialised project does not duplicate or corrupt previously installed skills (the `skills` package handles idempotency, or init detects and skips the install step).
- [ ] Typecheck / lint passes.

### US-004: Migrate `tmpl_` skill files to `nvst-skills`
**As a** maintainer of this repository, **I want** the NVST skill files to live under `nvst-skills/` instead of `scaffold/.agents/skills/` **so that** the `skills` package can distribute them and the old static-copy mechanism is no longer used for skills.

**Acceptance Criteria:**
- [ ] All `tmpl_SKILL.md` files are moved from `scaffold/.agents/skills/` to the corresponding paths under `nvst-skills/`, with the `tmpl_` prefix removed.
- [ ] The `scaffold/.agents/skills/` directory contains no `tmpl_SKILL.md` files after the migration.
- [ ] The `nvst-skills/` folder contains one `SKILL.md` per NVST framework skill.
- [ ] Typecheck / lint passes.

## Functional Requirements
- FR-1: `nvst init` must invoke `npx skills add` and pass through its interactive session to the user; scope selection is handled by the `skills` CLI, not by `nvst init`.
- FR-2: `nvst init` must invoke `npx skills add` during the init workflow instead of copying `tmpl_` skill files directly.
- FR-3: The `skills` installer must read NVST skills from the repository's `nvst-skills` folder.
- FR-4: The init workflow must complete only after the selected installation scope has finished installing the skills.
- FR-5: The `tmpl_` skill files must be removed from `scaffold/.agents/skills/` and placed under the `nvst-skills/` folder as part of this iteration.

## Non-Goals (Out of Scope)
- Changing how non-skill scaffold files are created by `nvst init`.
- Reworking the content of the NVST skills themselves.
- Adding new skill definitions beyond the existing NVST framework skills.
- Building a separate command for skill installation outside of `nvst init`.
- Implementing a new global configuration system for skill installation scope.
- Removing or replacing the `nvst sync skills` command.

## Open Questions
- None
