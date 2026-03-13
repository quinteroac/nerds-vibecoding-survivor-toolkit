# Requirement: Implement Approve Prototype Command

## Context

The NVST workflow ends each iteration with `nvst approve prototype`, but the command is currently a stub that only prints a "not implemented" warning. After `nvst refactor prototype` completes, the developer must be able to close the iteration loop: update key context files (`PROJECT_CONTEXT.md`, `ROADMAP.md`, and optionally `AGENTS.md` / `README.md`), confirm the changes interactively, commit and push the feature branch, and open a Pull Request — all from a single command.

This requirement implements the full approve-prototype flow following the same skill-based, interactive pattern as `audit-prototype` and `refactor-prototype`, with an additional interactive confirmation step before any destructive git operations are performed.

## Goals

- Guard the command so it only runs after the refactor phase is complete for the current iteration.
- Spawn an interactive agent that updates `PROJECT_CONTEXT.md`, `ROADMAP.md` (and optionally `AGENTS.md`, `README.md`) based on the iteration artifacts.
- Prompt the user to review and confirm the updates before committing.
- Commit the updated files, push the feature branch, and create a GitHub Pull Request automatically.
- Mark `prototype_approval.status` as `"completed"` in `state.json` so downstream commands and future iterations can detect the approved state.

## User Stories

### US-001: Guardrail — command only runs after audit is done and refactor path is resolved

**As a** developer using the NVST CLI, **I want** `nvst approve prototype` to refuse to run if neither the audit nor the refactor has been executed for the current iteration **so that** the approval always works from a validated, stable codebase.

**Background — known gap in upstream commands:** `audit-prototype.ts` and `refactor-prototype.ts` currently do **not** write `state.json` after completing. Both `prototype_audit.status` and `prototype_refactor.status` remain `"pending"` regardless of execution. Relying solely on these status fields would permanently block `approve-prototype`. Therefore the guardrail must use **file-system evidence** instead of (or in addition to) status fields.

**Two valid paths to approval:**

| Path | Condition | Meaning |
|------|-----------|---------|
| A — Refactor was run | `it_{iteration}_refactor-report.md` exists in `.agents/flow/` | Refactor phase completed |
| B — Nothing to refactor | `it_{iteration}_audit.md` exists **and** `it_{iteration}_audit.json` does **not** exist | Audit ran; user chose "leave as is" (no refactor needed) |

**Acceptance Criteria:**
- [ ] The command resolves `it_{iteration}_audit.md` and `it_{iteration}_refactor-report.md` paths under `.agents/flow/`.
- [ ] If neither `it_{iteration}_audit.md` nor `it_{iteration}_refactor-report.md` exists, the command fails with: _"Cannot approve prototype: audit prototype has not been run for this iteration."_
- [ ] If `it_{iteration}_audit.json` exists (refactor was planned) but `it_{iteration}_refactor-report.md` does not, the command fails with: _"Cannot approve prototype: a refactor plan exists but refactor prototype has not been run. Run `nvst refactor prototype` first."_
- [ ] If `it_{iteration}_audit.md` exists and `it_{iteration}_audit.json` does **not** exist, the command proceeds (path B — nothing to refactor).
- [ ] If `it_{iteration}_refactor-report.md` exists, the command proceeds (path A — refactor done).
- [ ] All guardrail failures respect `--force` and `flow_guardrail` mode via `assertGuardrail`.
- [ ] Typecheck / lint passes.

### US-002: Agent updates context files interactively

**As a** developer using the NVST CLI, **I want** the command to spawn an interactive agent that reads the iteration artifacts and proposes updates to `PROJECT_CONTEXT.md` and `ROADMAP.md` (and optionally `AGENTS.md` and `README.md`) **so that** project documentation stays in sync after each iteration.

**Acceptance Criteria:**
- [ ] The command loads the skill from `.agents/skills/approve-prototype/` via `loadSkill`, builds the prompt via `buildPrompt` (injecting `iteration` at minimum), and invokes the agent via `invokeAgent` with `interactive: true`.
- [ ] The `SKILL.md` instructs the agent to: (a) read `it_{iteration}_PRD.json`, `it_{iteration}_refactor-report.md`, and `PROJECT_CONTEXT.md`; (b) propose and apply updates to `PROJECT_CONTEXT.md` and `ROADMAP.md`; (c) optionally update `AGENTS.md` and `README.md` when content is stale.
- [ ] The `SKILL.md` instructs the agent to present a summary of each file it will modify and what it will change **before** making any edits, so the user can review the plan.
- [ ] If the agent exits with a non-zero code the command throws `new Error(...)` with a descriptive message (same pattern as `refactor-prototype.ts`).
- [ ] Typecheck / lint passes.

### US-003: User confirms updates before git operations

**As a** developer using the NVST CLI, **I want** to be prompted to confirm the file updates before any git operations are performed **so that** I can review and reject changes if something looks wrong.

**Acceptance Criteria:**
- [ ] After the agent finishes, the command prompts the user with a message listing the files that were modified (e.g. _"The agent updated: PROJECT_CONTEXT.md, ROADMAP.md. Proceed with commit, push, and PR creation? [y/N]"_).
- [ ] If the user answers `n` (or presses Enter without typing `y`), the command prints _"Aborted. No git operations performed."_ and exits cleanly without setting a non-zero exit code.
- [ ] If the user answers `y`, the command proceeds to US-004 and US-005.
- [ ] Typecheck / lint passes.

### US-004: Commit and push the feature branch

**As a** developer using the NVST CLI, **I want** the command to stage all changed files, create a conventional commit, and push the current branch **so that** the iteration work is preserved in version control.

**Acceptance Criteria:**
- [ ] The command runs `git add -A` and `git commit -m "feat: approve iteration {iteration} prototype"` (using the same `gitAddAndCommitFn` injectable dep pattern as `create-prototype.ts`).
- [ ] The command pushes the current branch to `origin` using `git push --set-upstream origin <branch>` (or equivalent).
- [ ] If the `git push` fails, the command throws `new Error(...)` with a descriptive message indicating the branch name and the error.
- [ ] Typecheck / lint passes.

### US-005: Create a GitHub Pull Request

**As a** developer using the NVST CLI, **I want** the command to automatically open a Pull Request on GitHub after pushing **so that** the iteration work is ready for review without any manual steps.

**Acceptance Criteria:**
- [ ] The command checks whether `gh` CLI is available (same `checkGhAvailableFn` injectable dep pattern as `create-prototype.ts`).
- [ ] If `gh` is available, the command creates a PR with title `"feat: it_{iteration} — [requirement name from PRD]"` and a body summarising the iteration (PRD title + link to refactor report).
- [ ] If `gh` is not available, the command prints a warning _"GitHub CLI (gh) not found. Skipping PR creation. Push was successful."_ and continues without error.
- [ ] If the `gh pr create` call fails, the command prints a warning with the stderr output and continues (same non-fatal pattern as `create-prototype.ts`).
- [ ] Typecheck / lint passes.

### US-006: Mark prototype_approval as completed in state.json

**As a** developer using the NVST CLI, **I want** `state.json` to reflect that the approval phase is done after the command succeeds **so that** the iteration can be archived and downstream checks detect the correct state.

**Acceptance Criteria:**
- [ ] After the git + PR steps succeed, the command calls `writeState` to set `phases.prototype.prototype_approval.status = "completed"` and `phases.prototype.prototype_approval.file = null` (no artifact file for this phase).
- [ ] The `state.json` on disk reflects the updated status immediately after the command exits.
- [ ] Typecheck / lint passes.

### US-007: Runtime skill and scaffold template updated

**As a** developer scaffolding a new NVST project, **I want** the `approve-prototype` skill to be a full implementation in both the runtime directory and the scaffold template **so that** projects initialised with `nvst init` have the complete approve behaviour out of the box.

**Acceptance Criteria:**
- [ ] `.agents/skills/approve-prototype/SKILL.md` is replaced with the full implementation (no longer a placeholder).
- [ ] `scaffold/.agents/skills/approve-prototype/tmpl_SKILL.md` is updated to match the runtime skill (no longer a placeholder).
- [ ] Both files share the same content (modulo any `{variable}` template syntax that applies only to the scaffold copy).
- [ ] Typecheck / lint passes.

## Functional Requirements

- **FR-1:** `nvst approve prototype` must use **file-system evidence** to determine whether the preconditions are met, since upstream commands do not update `state.json` status fields. The logic is:
  1. If `it_{iteration}_audit.md` is absent → fail: audit has not been run.
  2. If `it_{iteration}_audit.json` exists (refactor was planned) AND `it_{iteration}_refactor-report.md` is absent → fail: refactor has not been run.
  3. If `it_{iteration}_audit.md` exists AND `it_{iteration}_audit.json` is absent → proceed (nothing to refactor, path B).
  4. If `it_{iteration}_refactor-report.md` exists → proceed (refactor completed, path A).
  All failures must call `assertGuardrail` and respect `--force` / `flow_guardrail` mode.
- **FR-2:** The command must load the skill from `.agents/skills/approve-prototype/` via `loadSkill`, build the prompt via `buildPrompt` (injecting `iteration`), and invoke the agent via `invokeAgent` with `interactive: true` — exactly the same pattern as `refactor-prototype.ts`.
- **FR-3:** The `approve-prototype` SKILL.md must instruct the agent to: (a) read `it_{iteration}_PRD.json`, `it_{iteration}_refactor-report.md`, and `PROJECT_CONTEXT.md`; (b) summarise what it will change in `PROJECT_CONTEXT.md`, `ROADMAP.md`, and optionally `AGENTS.md` / `README.md` before making edits; (c) apply the updates.
- **FR-4:** After the agent returns, the command must prompt the user for confirmation before performing any git operations (see US-003).
- **FR-5:** On user confirmation, the command must: stage all changes (`git add -A`), commit with message `"feat: approve iteration {iteration} prototype"`, and push the current branch to `origin`.
- **FR-6:** After a successful push, the command must attempt to create a GitHub PR via `gh pr create`. If `gh` is unavailable or fails, this is a non-fatal warning (matching the pattern in `create-prototype.ts`).
- **FR-7:** On full success (agent + confirmation + git + PR), the command must call `writeState` setting `phases.prototype.prototype_approval.status = "completed"`.
- **FR-8:** Both `.agents/skills/approve-prototype/SKILL.md` and `scaffold/.agents/skills/approve-prototype/tmpl_SKILL.md` must be upgraded from placeholder to the full implementation.
- **FR-9:** The existing `approve-prototype.test.ts` must be updated to reflect the new behaviour (removing the "not implemented" stub assertion and adding guardrail + state-update tests).

## Non-Goals (Out of Scope)

- Implementing any refactor or code-quality checks inside this command — those belong to the refactor phase.
- Merging the Pull Request automatically — that remains a human action.
- Updating `state.json` from inside the skill itself — state transitions are always handled by CLI commands, not agent skills.
- Fixing the missing `state.json` status updates in `audit-prototype.ts` and `refactor-prototype.ts` (known gap; tracked in technical debt) — `approve-prototype` works around this by relying on file-system evidence rather than status fields.
- Supporting approval without a completed audit phase — blocked by FR-1.
- Auto-generating missing iteration artifacts (`PRD.json`, `refactor-report.md`, `audit.md`) if they do not exist; earlier phases are responsible for those files.
- Modifying the `current_iteration` counter or archiving flow artifacts — handled by a separate `start-iteration` command.

## Open Questions

- None
