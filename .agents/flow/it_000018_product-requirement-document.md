# Requirement: Interactive Dirty-Tree Confirmation in `nvst create prototype`

## Context
`nvst create prototype` performs two git working-tree cleanliness checks (one during the `define → prototype` phase transition and one after). Both currently throw a hard error when the tree is dirty, forcing the developer to manually commit or discard changes before retrying. This creates unnecessary friction. Instead, the command should detect the dirty state and interactively ask the developer whether to commit the changes in place, proceeding only on confirmation.

## Goals
- Replace both hard dirty-tree errors in `runCreatePrototype` with an interactive yes/no prompt.
- On confirmation, stage all changes and create a conventional commit, then continue the prototype build normally.
- On decline (or default/Enter), exit cleanly with an informative message — no error thrown, no changes made.
- Maintain full testability via the existing dependency-injection pattern (`CreatePrototypeDeps`).

## User Stories

### US-001: Prompt on dirty working tree instead of throwing
**As a** developer running `bun nvst create prototype`, **I want** the command to ask me whether to commit uncommitted changes **so that** I do not have to manually commit and re-run the command when my tree is dirty.

**Acceptance Criteria:**
- [ ] When either dirty-tree check (phase-transition check or post-transition check) detects uncommitted changes, the command prints: `Working tree has uncommitted changes. Stage and commit them now to proceed? [y/N]` and waits for user input.
- [ ] Typing `y` or `Y` (followed by Enter) proceeds to UC-002.
- [ ] Typing anything else, pressing Enter with no input, or providing no input (non-interactive / piped stdin) is treated as "No" and proceeds to UC-003.
- [ ] The original hard-error messages (`"Git working tree is dirty. Commit your changes..."`) are removed from both check sites.
- [ ] Typecheck / lint passes (`bun tsc --noEmit`).

---

### US-002: Auto-commit on confirmation
**As a** developer, **I want** `create prototype` to stage and commit my changes automatically after I confirm **so that** the prototype build starts with a clean working tree without manual intervention.

**Acceptance Criteria:**
- [ ] On confirmation, the command runs `git add -A` followed by `git commit -m "chore: pre-prototype commit it_<iteration>"` (where `<iteration>` is `state.current_iteration`).
- [ ] If the `git add -A` or `git commit` fails (e.g. pre-commit hook rejects), the command throws a descriptive error: `Pre-prototype commit failed:\n<stderr>` and exits with `process.exitCode = 1` without continuing the build.
- [ ] After a successful commit the prototype build proceeds normally (no further dirty-tree error).
- [ ] Typecheck / lint passes.

---

### US-003: Clean exit on decline
**As a** developer, **I want** the command to exit gracefully when I decline to commit **so that** I can manually handle my changes at my own pace.

**Acceptance Criteria:**
- [ ] On decline, the command prints `Aborted. Commit or discard your changes and re-run \`bun nvst create prototype\`.` and returns without throwing.
- [ ] `process.exitCode` is NOT set to 1 (clean exit).
- [ ] No state changes are written to `state.json`.
- [ ] Typecheck / lint passes.

---

### US-004: Unit tests for confirm and decline branches
**As a** developer maintaining the codebase, **I want** unit tests covering the new interactive flow **so that** regressions are caught automatically.

**Acceptance Criteria:**
- [ ] A test exists for the **confirm** path: a mock `confirmFn` returns `true`; a mock `gitAddAndCommitFn` is called with the correct commit message; the build continues (no error thrown).
- [ ] A test exists for the **decline** path: a mock `confirmFn` returns `false`; no git operations are performed; the function returns cleanly.
- [ ] A test exists for the **git commit failure** path: `confirmFn` returns `true`, `gitAddAndCommitFn` rejects; the handler throws a descriptive error.
- [ ] All new tests pass (`bun test`).
- [ ] Typecheck / lint passes.

---

## Functional Requirements
- **FR-1:** Add a `confirmFn: (message: string) => Promise<boolean>` field to `CreatePrototypeDeps`. The default implementation reads one line from `process.stdin` and returns `true` only if the trimmed input is `"y"` or `"Y"`.
- **FR-2:** Add a `gitAddAndCommitFn: (cwd: string, message: string) => Promise<{ exitCode: number; stderr: string }>` field to `CreatePrototypeDeps`. The default implementation runs `git add -A` then `git commit -m <message>` using `Bun.$`.
- **FR-3:** Replace the first dirty-tree hard error (lines 209–213, phase-transition block) with a call to `confirmFn`. On `true`: call `gitAddAndCommitFn`; on failure throw `Pre-prototype commit failed:\n<stderr>`; on `false`: log the abort message and return.
- **FR-4:** Replace the second dirty-tree hard error (lines 246–250, post-transition check) with the same `confirmFn` flow as FR-3.
- **FR-5:** The conventional commit message format is: `chore: pre-prototype commit it_<iteration>`.
- **FR-6:** Non-interactive environments (stdin not a TTY / piped input) must default to "No" without hanging. The default `confirmFn` implementation should detect `process.stdin.isTTY === false` and return `false` immediately.
- **FR-7:** All existing tests must continue to pass; inject `confirmFn` returning `false` (or `true` as needed) in existing tests that exercise the dirty-tree path.

## Non-Goals (Out of Scope)
- No support for custom commit messages (message is always auto-generated from iteration).
- No changes to any other command (`approve prototype`, `start iteration`, etc.).
- No push to remote as part of this flow (that remains `approve prototype`'s responsibility).
- No amending or rebasing existing commits.
- No UI changes beyond the terminal prompt string.

## Open Questions
- None.
