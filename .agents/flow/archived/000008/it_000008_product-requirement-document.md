# Requirement: Create Issue Command

## Context

Developers need a way to track defects and improvement items during an iteration. NVST currently has test execution results (`it_{iteration}_test-execution-results.json`) but no structured format for issues. A new command will generate `it_{iteration}_ISSUES.json` from either interactive agent dialogue or from existing test execution results.

## Goals

- Allow developers to create and persist issues in a standard, schema-validated format
- Support two input modes: agent-driven (interactive) and test-execution-report (automated derivation)
- Produce a consistent output file usable by downstream tools or future refactor phases

## User Stories

Each story must be small enough to implement in one focused session.

### US-001: Create issue via agent interaction

**As a** developer, **I want** to run `bun nvst create issue --agent <provider>` **so that** I can define an issue interactively with an AI agent.

**Acceptance Criteria:**

- [ ] Command `bun nvst create issue --agent <provider>` invokes the agent skill and starts interactive issue definition
- [ ] Agent skill must produce at minimum: `title` and `description`; `id` is auto-generated and `status` defaults to `"open"`
- [ ] Agent output is parsed and validated against the ISSUES schema (FR-6) before writing
- [ ] On success, `it_{current_iteration}_ISSUES.json` is created in `.agents/flow/` (overwrites any existing file)
- [ ] Command exits with code 0 on success; exits with code 1 and clear error message on failure
- [ ] Typecheck / lint passes
- [ ] **[UI stories only]** N/A — CLI-only

### US-002: Create issues from test execution results

**As a** developer, **I want** to run `bun nvst create issue --test-execution-report` **so that** issues are derived from the current iteration's `it_{iteration}_test-execution-results.json` (e.g. failed, skipped, or invocation-failed tests).

**Acceptance Criteria:**

- [ ] Command `bun nvst create issue --test-execution-report` reads `it_{iteration}_test-execution-results.json` from `.agents/flow/`; if not found there, checks the archived path from `state.json` history for the current iteration
- [ ] Test results with `payload.status` of `"failed"`, `"skipped"`, or `"invocation_failed"` are converted into issues with `id`, `title`, `description`, `status` set to `"open"`
- [ ] Output file `it_{current_iteration}_ISSUES.json` is created in `.agents/flow/` (overwrites any existing file)
- [ ] If all test results are passing, command writes an empty array to the ISSUES file and exits with code 0
- [ ] If the test-execution-results file is missing from both `.agents/flow/` and the archived path, command fails with a clear error message
- [ ] Output is validated against the ISSUES schema (FR-6) before writing
- [ ] Typecheck / lint passes
- [ ] **[UI stories only]** N/A — CLI-only

## Functional Requirements

- FR-1: Command `create issue` must accept exactly one of `--agent <provider>` or `--test-execution-report`; passing neither or both must fail with a clear usage error
- FR-2: The command must read `current_iteration` from `state.json` to determine the output filename and input file path
- FR-3: Output path: `.agents/flow/it_{iteration}_ISSUES.json` (always the current iteration; running the command again overwrites the file)
- FR-4: When using `--agent`, the agent skill must be invoked and its output must conform to the ISSUES schema
- FR-5: When using `--test-execution-report`, the system must map non-passing tests to issues using the following mapping: `testCaseId` → `id`, `description` → `title`, `payload.evidence` + `payload.notes` → `description`, `status` → `"open"`. Qualifying `payload.status` values: `"failed"`, `"skipped"`, `"invocation_failed"`
- FR-6: Output schema — `it_{iteration}_ISSUES.json` must be an array of `{ id: string, title: string, description: string, status: "open" | "fixed" }`. `id` must be unique per issue within the file. Schema must be defined in Zod (in `schemas/`) and used for validation before every write

## Non-Goals (Out of Scope)

- Editing or deleting existing issues from the command line
- Web UI or graphical issue tracker
- Integration with external issue systems (GitHub Issues, Jira, etc.)
- Automatic re-running of tests when issues are marked as fixed
- Deduplication or merging of issues across multiple runs
- Issue severity, priority, or categorization fields
