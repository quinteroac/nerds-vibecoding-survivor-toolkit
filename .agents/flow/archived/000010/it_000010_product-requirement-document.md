# Requirement: Interactive Manual Fix Command

## Context
Currently, the system handles autonomous fixes via `automated-fix`. However, some issues require human intervention and are marked as `manual-fix`. There is no streamlined workflow to process these issues interactively with AI guidance. This feature introduces a command to iterate through `manual-fix` issues, providing an interactive "copilot" experience where the agent guides the user through analysis, reproduction, and resolution.

## Goals
- Provide a CLI command to fetch and process issues with status `manual-fix`.
- Offer an interactive, step-by-step guidance workflow (Analysis, Reproduction, Fix).
- Update issue status (e.g., to `closed` or `in_progress`) based on user feedback after the session.

## User Stories

### US-001: CLI Command & Issue Filtering
**As a** Developer, **I want** to run `bun nvst execute manual-fix --agent <agent_name>` **so that** I can start processing issues marked for manual intervention.

**Acceptance Criteria:**
- [ ] Command `bun nvst execute manual-fix` exists.
- [ ] Accepts `--agent` argument (defaults to a sensible default if omitted, or errors if required).
- [ ] Scans project issues (e.g., from `it_{iteration}_ISSUES.json` or equivalent source).
- [ ] Filters for issues where `status` is `manual-fix`.
- [ ] Displays a count of found issues and asks to proceed.

### US-002: Interactive Guidance Session
**As a** Developer, **I want** the agent to guide me through a specific issue **so that** I can efficiently debug and fix it.

**Acceptance Criteria:**
- [ ] System presents issues one by one.
- [ ] For each issue, the agent outputs a summary/analysis of the problem.
- [ ] Agent suggests a reproduction strategy or test case.
- [ ] Agent suggests potential fixes or code changes.
- [ ] Interaction allows the user to ask clarifying questions or request code generation (interactive chat loop per issue).

### US-003: Issue Status Update
**As a** Developer, **I want** to mark an issue as resolved or skipped after working on it **so that** the project state is updated.

**Acceptance Criteria:**
- [ ] At the end of an issue session, user is prompted: "Mark as fixed?", "Skip?", or "Exit?".
- [ ] If "Fixed", update the issue's status in the source JSON file to `closed` (or `fixed`).
- [ ] If "Skip", leave status as `manual-fix` and move to next.
- [ ] Changes are persisted to the issue file immediately.

## Functional Requirements
- **FR-1:** New command implementation in `src/commands/execute-manual-fix.ts`.
- **FR-2:** Logic to read/write the current iteration's issue file.
- **FR-3:** Integration with the Agent API to provide context-aware chat about the specific issue content.
- **FR-4:** Loop mechanism to handle multiple issues sequentially.

## Non-Goals (Out of Scope)
- Fully autonomous fixing of `manual-fix` issues (the user must be involved).
- extensive GUI (CLI only).

## Open Questions
- Should the agent strictly enforce a "test-first" workflow in manual mode, or just suggest it? (Assumed: Suggest/Guide, but user has control).
