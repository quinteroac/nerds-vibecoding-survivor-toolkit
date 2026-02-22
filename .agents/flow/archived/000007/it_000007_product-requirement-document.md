# Requirement: Support Cursor Agent CLI

## Context
The toolkit currently supports various AI agents for executing tasks like PRD generation, test planning, and code prototyping. Users who use Cursor IDE want to leverage its agent capabilities directly through the toolkit. The Cursor Agent is exposed via a CLI command named `agent`. We need to integrate this as a first-class supported agent in NVST.

## Goals
- Enable the usage of Cursor Agent via the `--agent cursor` flag.
- Ensure seamless integration with all existing NVST commands that utilize AI generation.
- Maintain consistency in input/output handling compared to other supported agents.

## User Stories

### US-001: Run NVST commands with Cursor Agent
**As a** developer, **I want** to pass `--agent cursor` to any NVST command **so that** the task is performed using the Cursor `agent` CLI.

**Acceptance Criteria:**
- [ ] `bun nvst [command] --agent cursor` is accepted as a valid argument.
- [ ] The system invokes the `agent` binary executable when this flag is used.
- [ ] The prompt context is correctly passed to the `agent` command.
- [ ] The output from `agent` is correctly captured and written to the target files (PRDs, plans, code).
- [ ] Verified on at least one major flow (e.g., `define-requirement` or `create-prototype`).

### US-002: Error Handling for Missing CLI
**As a** developer, **I want** to be notified if the `agent` command is missing **so that** I know I need to install or configure it.

**Acceptance Criteria:**
- [ ] If `--agent cursor` is selected but `agent` is not in the PATH, return a clear error message.

## Functional Requirements
- **FR-1:** Extend the Agent configuration/enum to include `cursor`.
- **FR-2:** Map the `cursor` agent type to the system command `agent`.
- **FR-3:** Ensure standard input (stdin) or argument passing protocols used by NVST are compatible with the `agent` CLI signature.
- **FR-4:** Support streaming output if the `agent` CLI supports it, or handle buffered output appropriate.

## Non-Goals (Out of Scope)
- Installing the Cursor `agent` CLI (user must have it installed).
- interacting with the Cursor IDE GUI (only the CLI is in scope).
- Specialized Cursor features beyond text generation (e.g., specific diff views within the CLI).

## Open Questions
- Does `agent` accept prompt via stdin or arguments? (Assumed similar to standard unix pipes or specific flags, will be determined during implementation research).
