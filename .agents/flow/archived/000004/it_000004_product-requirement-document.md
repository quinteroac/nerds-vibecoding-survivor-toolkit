# Requirement: Enhanced Test Plan Structure and Traceability

## Context
The current `it_TP.json` (Test Plan JSON) structure is too simplistic, offering only basic lists of tests without linking them back to the requirements defined in the Product Requirement Document (PRD). Furthermore, it lacks fields to track execution status, which is critical for monitoring progress during the prototype and refactor phases.

## Goals
- Enhance `it_TP.json` to include correlation with PRD user stories and functional requirements.
- Add comprehensive status tracking for both the overall test plan and individual test items.
- Ensure the `create-test-plan` skill prompt and `approve-test-plan` parser correctly produce the new structure.

## User Stories

### US-001: Enhanced Test Plan Schema Definition
**As a** developer, **I want** an updated Zod schema for the Test Plan **so that** I can represent complex testing metadata including scope, environment, and requirement traceability.

**Acceptance Criteria:**
- [ ] `TestPlanSchema` in `schemas/test-plan.ts` updated to include:
    - `overallStatus`: "pending", "passed", "failed", "skipped"
    - `scope`: detailed array of strings
    - `environmentData`: detailed array of strings
    - `automatedTests`: array of objects with `id`, `description`, `status`, and `correlatedRequirements`
    - `exploratoryManualTests`: array of objects with `id`, `description`, `status`, and `correlatedRequirements`
- [ ] Typecheck passes.

### US-002: Update Test Plan Generator Skill
**As a** developer, **I want** the `create-test-plan` skill prompt to instruct the AI agent to include requirement traceability in the generated markdown **so that** downstream parsing can populate the new schema fields.

**Acceptance Criteria:**
- [ ] `create-test-plan` skill prompt (`.agents/skills/create-test-plan/SKILL.md`) updated to instruct the agent to:
    - Include correlated requirement IDs (US-XXX, FR-X) for each test case in the markdown test plan table.
    - Ensure every functional requirement (FR-N) has at least one correlated test case.
- [ ] `create-test-plan.ts` command updated to use the new schema for any validation it performs.
- [ ] A manual run of `bun nvst create test-plan` (after a PRD is present) produces a markdown test plan that includes requirement ID references in the test case table.

### US-003: Automated Validation of Traceability
**As a** developer, **I want** automated tests to verify that the parsed test plan JSON correctly correlates with the PRD **so that** I can be confident in my test coverage.

**Acceptance Criteria:**
- [ ] New or updated test in `src/commands/approve-test-plan.test.ts` verifies that:
    - The parsed JSON is valid according to the updated `TestPlanSchema`.
    - `correlatedRequirements` arrays in test items are populated with at least one PRD requirement ID.
- [ ] Existing test in `src/commands/create-test-plan.test.ts` updated to verify that the skill prompt includes instructions for requirement traceability.

### US-004: Update Approve Test Plan Parser
**As a** developer, **I want** the `approve-test-plan` markdown parser to produce the new object-based structure **so that** the JSON output matches the updated schema.

**Acceptance Criteria:**
- [ ] `parseTestPlan()` in `approve-test-plan.ts` updated to parse markdown test plan tables into objects with `id`, `description`, `status` (initialized to `pending`), and `correlatedRequirements`.
- [ ] Parser correctly extracts requirement IDs from the markdown table columns.
- [ ] `overallStatus` is set to `pending` on initial approval.
- [ ] Parsed output validates against the updated `TestPlanSchema`.
- [ ] Visually verified by running `bun nvst approve test-plan` with a sample markdown test plan.

## Functional Requirements
- FR-1: The schema must support four statuses: `pending`, `passed`, `failed`, `skipped`.
- FR-2: Each test item (automated or manual) must have a `correlatedRequirements` field containing an array of strings (IDs from the PRD).
- FR-3: `environmentData` must capture the technical context required for testing (e.g., node version, browser, specific data sets).
- FR-4: `approve-test-plan` must initialize all new test statuses to `pending` and set `overallStatus` to `pending`.

## Non-Goals (Out of Scope)
- Automatic execution of tests (this requirement is about structure and tracking, not automation logic).
- UI for updating statuses (status updates will be manual or via future tools).
- Migration of existing/archived test plan JSON files (iterations 000001–000003 are snapshots and do not need to conform to the new schema).
- Updating the `refine-test-plan` command or its skill prompt.

## Open Questions
No open questions.
