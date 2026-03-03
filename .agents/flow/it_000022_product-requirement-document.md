# Requirement: Execute whereis python Command

## Context
The user requires a simple feature to execute the `whereis python` system command and display its output. This serves as a test case for the `create prototype` command workflow in NVST.

## Goals
- Provide a command that executes `whereis python` and returns the result
- Validate the NVST prototype creation flow with a straightforward implementation
- Ensure the user can verify command execution and output capture

## User Stories

### US-001: Execute whereis python command
**As an** end user, **I want** to execute the `whereis python` command **so that** I can locate the Python installation on the system.

**Acceptance Criteria:**
- [ ] The command executes successfully without errors
- [ ] The output from `whereis python` is captured and displayed
- [ ] The feature handles the command's return code properly
- [ ] Typecheck / lint passes

### US-002: Verify command output
**As an** end user, **I want** to see the result of the `whereis python` command **so that** I can determine where Python is installed.

**Acceptance Criteria:**
- [ ] Output is displayed to the user in a clear format
- [ ] The path(s) to Python installations are visible
- [ ] If Python is not found, an appropriate message is shown

## Functional Requirements
- FR-1: Execute the system command `whereis python` using Bun's process spawning (`Bun.spawn`)
- FR-2: Capture stdout and stderr from the command execution
- FR-3: Return the command output to the user or operator
- FR-4: Handle and report errors gracefully if the command fails

## Non-Goals (Out of Scope)
- Complex command parameterization or dynamic arguments
- Cross-platform compatibility testing beyond Linux
- Integration with other NVST workflow features (those are separate stories)

## Open Questions
- Should the output be formatted or passed through as-is?
- Should the feature support alternative Python locators (e.g., `which python3`)?
