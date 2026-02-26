# Requirement: `nvst approve prototype` Command

## Context
After the prototype phase is complete, there is no automated way to finalize it. The developer must manually stage changes, commit, push the branch, and open a PR. This creates friction and inconsistency. A dedicated `bun nvst approve prototype` command should handle this sequence reliably, respecting the existing NVST workflow conventions and updating state accordingly.

## Goals
- Automate the final step of the prototype phase: commit → push → PR creation.
- Mark the prototype as approved in `state.json` so the workflow can advance to the refactor phase.
- Exit cleanly (code 0) on success, non-zero on any error; never call `process.exit()`.

## User Stories

### US-001: Commit pending changes
**As a** developer using `bun nvst`, **I want** `approve prototype` to stage and commit all pending changes with a conventional commit message **so that** my prototype work is captured in a single, well-labelled commit.

**Acceptance Criteria:**
- [ ] Running `bun nvst approve prototype` stages all changes (`git add -A`) and creates a commit with message `feat: approve prototype it_000016` (using the current iteration from `state.json`).
- [ ] If there are no changes to commit (clean working tree), the command prints an informative message and continues without creating an empty commit.
- [ ] Typecheck / lint passes.

---

### US-002: Push the branch to the remote
**As a** developer, **I want** the command to push the current branch to the remote repository **so that** my work is backed up and visible to collaborators.

**Acceptance Criteria:**
- [ ] After committing, the command runs `git push -u origin <current-branch>`.
- [ ] If the push fails (e.g. no remote configured), the command throws a descriptive error, sets `process.exitCode = 1`, and does NOT update `state.json`.
- [ ] Typecheck / lint passes.

---

### US-003: Create a PR via `gh` CLI (when available)
**As a** developer, **I want** the command to automatically create a pull request if the `gh` CLI is available **so that** the prototype can be reviewed without leaving the terminal.

**Acceptance Criteria:**
- [ ] If `gh` is available (detected via `Bun.spawn` or `Bun.$` checking the exit code of `gh --version`), the command runs `gh pr create` with a generated title (`feat: prototype it_000016`) and a generic body referencing the iteration number (e.g. `Prototype for iteration it_000016`).
- [ ] If `gh` is not available, the command prints a clear skip message (e.g. `gh CLI not found — skipping PR creation`) and exits with code 0.
- [ ] If `gh pr create` fails (e.g. PR already exists), the error is surfaced as a non-fatal warning and `state.json` is still updated.
- [ ] Typecheck / lint passes.

---

### US-004: Mark prototype as approved in `state.json`
**As a** developer, **I want** `state.json` to reflect that the prototype has been approved **so that** subsequent NVST commands (e.g. `define refactor-plan`) can validate the correct phase.

**Acceptance Criteria:**
- [ ] After a successful commit and push, `state.json` is updated: `phases.prototype.prototype_approved` is set to `true` and `last_updated` is refreshed.
- [ ] If the command is run when `prototype_approved` is already `true`, it throws a descriptive error and exits with code 1.
- [ ] If the current phase is not `"prototype"`, the guardrail (`assertGuardrail`) blocks execution with a descriptive message.
- [ ] Typecheck / lint passes.

---

## Functional Requirements
- **FR-1:** Register the command `approve prototype` in `src/cli.ts` and dispatch to `src/commands/approve-prototype.ts` (handler: `runApprovePrototype`).
- **FR-2:** Validate state before any I/O: `current_phase === "prototype"` and `phases.prototype.prototype_approved === false`; throw with a descriptive message otherwise.
- **FR-3:** Detect whether the working tree is clean; if not clean, run `git add -A` followed by `git commit -m "feat: approve prototype it_<iteration>"`. If the commit fails due to a pre-commit hook, surface the hook output wrapped in a structured message: `Pre-commit hook failed:\n<hook output>`.
- **FR-4:** Run `git push -u origin <current-branch>` after committing; propagate push failures as thrown errors.
- **FR-5:** Detect `gh` availability; if present run `gh pr create --title "feat: prototype it_<iteration>" --body "Prototype for iteration it_<iteration>"`; if absent print a skip message to stdout.
- **FR-6:** On successful commit + push, update `state.json`: set `phases.prototype.prototype_approved = true` and `last_updated` to current ISO timestamp.
- **FR-7:** Use `process.exitCode = 1` for all error exits; never call `process.exit()`.
- **FR-8:** Call `assertGuardrail` at the start of the handler to enforce the flow guardrail mode configured in `state.json`.

## Non-Goals (Out of Scope)
- No interactive prompts for commit messages or PR body (auto-generated from iteration data).
- No support for non-GitHub PR providers (GitLab, Bitbucket).
- No force-push (`--force`) behaviour.
- Does not resolve merge conflicts or diverged branches.
- Does not archive the iteration or start a new one (that remains `nvst start iteration`'s responsibility).
- No changes to the refactor phase or any other workflow phase.

