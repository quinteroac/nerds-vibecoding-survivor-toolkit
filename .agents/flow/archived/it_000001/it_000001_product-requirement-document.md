# Requirement: Create Prototype Command (`nvst create prototype`)

## Context
The NVST (Nerds VibeCoding Survivor Toolkit) flow requires a command to automate the prototype creation phase. This command follows the "Ralph loop" methodology to implement user stories defined in a PRD JSON file incrementally, ensuring each step is documented, tested, and committed to source control.

## Goals
- Implement the `bun nvst create prototype` command.
- Automate the prototype build process by iterating through user stories in `it_{iteration}_PRD.json`.
- Adhere to the "Ralph loop" logic (sequential iterations, agent invocation, status tracking).
- Support specific operational flags: `--agent`, `--iterations`, `--retry-on-fail`, and `--stop-on-critical`.
- Maintain system state by updating `it_{iteration}_progress.json` and `state.json`.
- Ensure source control integrity by following the git contract (branch creation and per-user-story commits).

## User Stories

### US-001: Implement `nvst create prototype` command and flags
**As an** end user, **I want** to run the `create prototype` command with specific flags **so that** I can control and customize the automated build process.

**Acceptance Criteria:**
- [ ] Command accepts `--agent`, `--iterations`, `--retry-on-fail`, and `--stop-on-critical` flags.
- [ ] Command validates that `current_phase` is `"prototype"` and `project_context.status` is `"created"` in `state.json`; if either condition is not met, it exits with an error indicating the prerequisite steps that must be completed first.
- [ ] Command validates that `it_{iteration}_PRD.json` exists; this file is the sole source of truth for implementation and must have been generated (e.g., via `nvst write-json`) from the Markdown PRD.
- [ ] Command validates that `it_{iteration}_PRD.json` is parseable and matches the expected schema/shape before execution; if invalid, it exits with a deterministic validation error message.
- [ ] Command creates a git branch `feature/it_{iteration}` if it does not already exist.
- [ ] Command ensures execution happens on branch `feature/it_{iteration}` (create if missing, checkout if existing) and exits with an actionable error if branch creation or checkout fails.
- [ ] Command creates `it_{iteration}_progress.json` with all user stories set to `pending` status if the file does not already exist. Each entry's `use_case_id` maps to the `id` field of the corresponding `userStory` in the PRD JSON.
- [ ] If `it_{iteration}_progress.json` already exists, the command validates that its `use_case_id` values match exactly the `id` fields from `userStories` in `it_{iteration}_PRD.json`; if they differ, it exits with a "Progress file out of sync" error.
- [ ] Command fails fast before any prototype work begins if the git working tree is dirty, providing an actionable error message instructing the user to either commit their changes or discard them (e.g., `git checkout .`) before retrying.
- [ ] Command validates numeric flags before execution: `--iterations` must be an integer `>= 1` when provided, and `--retry-on-fail` must be an integer `>= 0` when provided; invalid values produce deterministic validation errors.

### US-002: Implement the Ralph Loop logic for user story implementation
**As an** end user, **I want the** command to iterate through user stories sequentially **so that** the prototype is built and verified incrementally.

**Acceptance Criteria:**
- [ ] Command reads user stories from `it_{iteration}_PRD.json` (the `userStories` array).
- [ ] Command identifies the next unimplemented user story using `it_{iteration}_progress.json`.
- [ ] Command invokes the specified agent to implement the user story code and testing artifacts.
- [ ] Command loads the skill template from `.agents/skills/implement-user-story/SKILL.md` and builds the agent prompt using `buildPrompt()` with context variables including: the user story being implemented (from the PRD JSON), the project context (from `.agents/PROJECT_CONTEXT.md`), and the current iteration number.
- [ ] Command validates that `.agents/skills/implement-user-story/SKILL.md` exists before starting execution; if missing, it exits with an error.
- [ ] Command runs quality checks after each user story implementation attempt. Quality checks are defined in the `## Testing Strategy` → `### Quality Checks` subsection of `.agents/PROJECT_CONTEXT.md` as a fenced code block with one shell command per line. Each command is executed in order; a non-zero exit code constitutes a check failure. If the subsection is absent or empty, the command defaults to verifying the agent process's exit code only.
- [ ] After each user story implementation attempt, the command records each quality check exit code in `it_{iteration}_progress.json`, applies retries according to `--retry-on-fail`, and halts immediately on first critical condition when `--stop-on-critical` is enabled.
- [ ] Command makes a git commit for each successfully implemented user story (including code and tests).
- [ ] `--iterations <N>` limits the command to processing at most N user stories per run (default: all remaining). After N stories are attempted (regardless of pass/fail), the command exits gracefully.
- [ ] `--retry-on-fail <N>` sets the maximum number of retry attempts per user story when a failure occurs (default: 0, no retries). A failure is defined as: agent non-zero exit code or any quality check non-zero exit code. Each retry re-invokes the agent for the same user story.
- [ ] Command respects `--stop-on-critical` by halting execution if a critical failure is encountered. A critical failure is defined as: (a) agent invocation returns a non-zero exit code, (b) any configured quality check returns a non-zero exit code, or (c) git commit fails for the current user story.
- [ ] If there are no user stories to implement (PRD contains none, or all are already completed), the command exits successfully with a message indicating no work was performed, and does not modify `prototype_build.status`.

### US-003: Status reporting and state management
**As an** end user, **I want** the command to provide deterministic per-step status logs and persist its progress **so that** I can monitor the build and resume if necessary.

**Acceptance Criteria:**
- [ ] Console output clearly and deterministically displays the current iteration, the user story being processed, current attempt number, and implementation outcome for each attempt.
- [ ] After each implementation attempt, each affected entry in `it_{iteration}_progress.json` contains: `use_case_id`, `status`, `attempt_count`, `last_agent_exit_code`, `quality_checks` (array of `{ command, exit_code }`), `last_error_summary` (empty string when successful), and `updated_at` (ISO-8601 timestamp).
- [ ] `attempt_count` is cumulative across runs for each user story and increments by 1 on every attempt, including retries.
- [ ] `state.json` is updated: `prototype_build.status` set to `"in_progress"` during execution and `"created"` upon successful completion, but only when at least one user story is attempted.
- [ ] `state.json` → `prototype_build.file` is set to the path of the progress JSON file.

## Functional Requirements
- **FR-1:** The command must verify that `current_phase` is `"prototype"` and `project_context.status` is `"created"` in `state.json`; if either condition is not met, it exits with an error indicating the prerequisite steps that must be completed first. The command does not perform implicit phase transitions.
- **FR-2:** User story selection considers stories in PRD order and processes only entries with status in `{pending, failed}` from `it_{iteration}_progress.json` (completed entries are skipped). On rerun, previously failed user stories remain eligible and are treated as pending work for selection, without resetting their cumulative `attempt_count`.
- **FR-3:** Agent invocation must be compatible with the project's supported providers (Claude, Codex, and Gemini) as defined in the `--agent` flag.
- **FR-4:** Git commits must use a consistent naming convention reflecting the user story implemented.
- **FR-5:** The command must be idempotent; rerunning it resumes remaining work by applying the FR-2 selection rule over `pending` and `failed` stories without duplicating already completed stories.
- **FR-6:** The skill template `.agents/skills/implement-user-story/SKILL.md` is a static file that ships with the scaffold and defines the coding agent's behavioral contract (e.g., commit after implementation, follow project conventions, run quality checks). The command does not generate or modify this file.

## Non-Goals (Out of Scope)
- Implementation of the agents themselves (assumed to be available as CLI tools or APIs).
- Automated bug fixing (handled by `nvst execute automated-fix`).
- Final approval of the prototype (handled by `nvst approve prototype`).
- Agent timeout handling (the command relies on the agent process to terminate on its own).
- Rollback of partial work (a failed user story is recorded as failed in progress.json but uncommitted changes are left in the working tree for manual inspection).
- Iteration switching or cross-iteration mutation (the command operates only on `current_iteration` from `state.json`).
- Concurrent execution safety — the command assumes it is the only process modifying `state.json` and `it_{iteration}_progress.json` at any given time. Running multiple instances simultaneously is unsupported and may result in corrupted state.
- Dependency installation or environment bootstrapping (the command does not run package installation, provision runtimes, or configure external tools; prerequisites must already be available).
