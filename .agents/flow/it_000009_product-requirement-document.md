# Requirement: Automated Issue Fix Command

## Context
Developers need a way to automate the resolution of issues tracked in `it_ISSUES.json`. Currently, fixing issues requires manual intervention. We want to leverage AI agents to attempt fixes automatically. This iteration introduces the `bun nvst execute automated-fix` command.

## Goals
- Enable automated issue resolution using AI agents.
- Provide a CLI command to run the fix process.
- Support configuration for iterations and retries.
- Report success/failure of fix attempts.

## Assumptions
- **Success/Failure:** Success = `AgentResult.exitCode === 0`. Failure = `AgentResult.exitCode !== 0`. The command does not inspect stdout/stderr to determine the result.
- **Clean working tree:** The command expects a clean git working tree. If uncommitted changes exist when the command starts, it prints an error and exits with non-zero code.
- **Agent prompt:** The agent is invoked with a skill that provides a structured debugging workflow (see US-001 acceptance criteria). The exact prompt template is an implementation detail, but it must include all relevant fields from the issue object (id, title, description, and any additional context fields present).

## User Stories

### US-001: Run Automated Fix
**As a** Developer, **I want** to run `bun nvst execute automated-fix` **so that** I can attempt to fix open issues automatically.

**Acceptance Criteria:**
- [ ] Command `bun nvst execute automated-fix` exists.
- [ ] It reads `it_{iteration}_ISSUES.json` from the current iteration flow.
- [ ] It identifies open issues.
- [ ] It processes issues sequentially (one at a time, like create prototype).
- [ ] For each open issue, it invokes the agent with a skill that follows this structured debugging workflow: (1) understand the issue, (2) reproduce the issue, (3) make hypotheses about the issue, (4) identify affected code, (5) add instrumentation if required, (6) collect logs if instrumentation was implemented, (7) confirm/discard hypotheses, (8) fix the issue, (9) try to reproduce the issue to verify the fix, (10) remove instrumentation if it was implemented, (11) mark as fixed.
- [ ] When a fix succeeds, the tool updates the issue status in `it_{iteration}_ISSUES.json` and commits the changes (git commit).
- [ ] When the agent cannot confirm any hypothesis and `--retry-on-fail` retries remain, the tool marks the issue to retry.
- [ ] When the agent cannot confirm any hypothesis and no retries remain (or `--retry-on-fail` was not specified), the tool updates the issue status to `"manual-fix"` in `it_{iteration}_ISSUES.json` and commits the changes (git commit).
- [ ] When an unrecoverable error occurs (e.g., network failure), the tool updates the issue status to `"manual-fix"` in `it_{iteration}_ISSUES.json` and commits the changes (git commit). Network errors do not consume `--retry-on-fail` retries.
- [ ] If `git commit` fails after processing an issue, the tool prints an error message for that issue, marks it as Failed in the summary, and continues to the next issue.
- [ ] Typecheck / lint passes.

### US-002: Specify Agent
**As a** Developer, **I want** to specify the agent (`--agent`) **so that** I can control which AI model/agent performs the fix.

**Acceptance Criteria:**
- [ ] Command accepts `--agent [name]` flag.
- [ ] If `--agent` is not specified, the command prints an error message and exits with non-zero code.
- [ ] Selected agent is invoked for the fix attempt (verifiable via agent execution).

### US-003: Configure Loop
**As a** Developer, **I want** to configure the loop (`--iterations`, `--retry-on-fail`) **so that** I can manage retries and attempts.

**Acceptance Criteria:**
- [ ] Command accepts `--iterations [number]` flag (default: 1). This controls the maximum number of open issues to process in a single run.
- [ ] Command accepts `--retry-on-fail [number]` flag (default: 0). This controls how many times to retry a failed fix attempt per issue.
- [ ] When `AgentResult.exitCode !== 0`, the command retries the invocation up to `--retry-on-fail` times.
- [ ] Tool stops retrying after success or max retries.
- [ ] When `--iterations` is less than the total open issues, only the first N open issues are processed; remaining issues are left untouched.

### US-004: Read Issues
**As a** Developer, **I want** the tool to read open issues from `it_ISSUES.json` **so that** I can target specific problems.

**Acceptance Criteria:**
- [ ] Tool parses `it_{iteration}_ISSUES.json`.
- [ ] Only issues with status "open" are processed.
- [ ] If file does not exist: prints clear error message, exits with non-zero code.
- [ ] If JSON is malformed: prints clear error message, exits with non-zero code.
- [ ] If zero open issues: prints informative message, exits with code 0.
- [ ] If an issue has missing required fields (id, title, description, status): skips with warning, continues with remaining issues.

### US-005: Report Results
**As a** Developer, **I want** the tool to report pass/fail results **so that** I know which issues were resolved.

**Acceptance Criteria:**
- [ ] Tool prints to stdout, for each issue, a line `{issueId}: Fixed` or `{issueId}: Failed`.
- [ ] Summary at end with totals (Fixed count, Failed count).
- [ ] Result is verifiable in terminal output.

## Functional Requirements
- FR-1: The command must use the existing `src/agent.ts` framework.
- FR-2: The command must parse JSON correctly.
- FR-3: The command must handle network errors gracefully (agent API failures).
- FR-4: On network errors (agent API unavailable): print error message per affected issue, mark as Failed in summary, update issue status to `"manual-fix"` and commit, continue to next issue. Network errors do not trigger `--retry-on-fail` retries (see US-001).

## Non-Goals (Out of Scope)
- Automated verification via test execution (MVP relies on agent reporting success/failure).
- Complex dependency resolution between issues.
- `--stop-on-critical` flag (deferred to future iteration).
- Rollback of file changes when agent reports failure (changes persist).
- Filtering issues by severity, tag, or individual ID (all open issues are processed, limited only by `--iterations`).
- Dry-run / preview mode.
