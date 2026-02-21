# Requirement: Test Plan CLI Lifecycle Commands

## Context
The toolkit currently supports a define → refine → approve lifecycle for requirements and project context, but lacks the equivalent workflow for test plans. Users need CLI commands to create, refine, challenge, and approve test plans for their prototypes, following the same patterns already established in the codebase. The test plan skill should instruct the agent to prioritize automation as much as possible.

## Goals
- Provide a complete CLI lifecycle for test plans: create, refine (with challenge mode), and approve.
- Follow the existing command patterns (`create`, `refine --challenge`, `approve`) so the experience is consistent.
- Create a skill that instructs the agent to maximize test automation (prefer automated checks over manual verification).
- Update `state.json` correctly at each stage (`test_plan` and `tp_generation` fields).

## User Stories

### US-001: Create a test plan
**As a** end user, **I want** to run `bun nvst create test-plan --agent <provider>` **so that** an agent generates a test plan document for my prototype.

**Acceptance Criteria:**
- [ ] Command `create test-plan` is registered in `src/cli.ts` and dispatched correctly.
- [ ] Command loads the `create-test-plan` skill from `.agents/skills/create-test-plan/SKILL.md`.
- [ ] Command invokes the agent interactively with the skill prompt and iteration context.
- [ ] On completion, file `it_{iteration}_test-plan.md` is written to `.agents/flow/`.
- [ ] Command checks if the test plan file already exists; if it does, it requires a `--force` flag or user confirmation to overwrite.
- [ ] `state.json` → `test_plan.status` is set to `"pending_approval"` and `test_plan.file` is set to the filename.
- [ ] `state.json` → `last_updated` and `updated_by` are set.
- [ ] Command validates precondition: `project_context.status === "created"` (prototype phase prerequisites met).
- [ ] Command fails with a clear error if precondition is not met.
- [ ] Typecheck / lint passes.

### US-002: Refine a test plan
**As a** end user, **I want** to run `bun nvst refine test-plan --agent <provider>` **so that** an agent improves the existing test plan.

**Acceptance Criteria:**
- [ ] Command `refine test-plan` is registered in `src/cli.ts` and dispatched correctly.
- [ ] Command loads the `refine-test-plan` skill from `.agents/skills/refine-test-plan/SKILL.md`.
- [ ] Command reads the current test plan file from `.agents/flow/` and passes its content as context.
- [ ] Command invokes the agent interactively.
- [ ] State is **not** updated (allows multiple refinement iterations while status stays `"pending_approval"`).
- [ ] Command validates precondition: `test_plan.status === "pending_approval"`.
- [ ] Typecheck / lint passes.

### US-003: Challenge a test plan
**As a** end user, **I want** to run `bun nvst refine test-plan --agent <provider> --challenge` **so that** an agent performs an adversarial review of the test plan, questioning coverage gaps and weak assertions.

**Acceptance Criteria:**
- [ ] The `--challenge` flag is parsed and passed as `mode: "challenger"` in the prompt context.
- [ ] The `refine-test-plan` skill includes a challenger mode section that instructs the agent to critically evaluate the plan.
- [ ] State is **not** updated.
- [ ] Typecheck / lint passes.

### US-004: Approve a test plan
**As a** end user, **I want** to run `bun nvst approve test-plan` **so that** the test plan is finalized and the workflow can proceed to prototype building.

**Acceptance Criteria:**
- [ ] Command `approve test-plan` is registered in `src/cli.ts` and dispatched correctly.
- [ ] Command validates precondition: `test_plan.status === "pending_approval"`.
- [ ] On approval, `state.json` → `test_plan.status` is set to `"created"`.
- [ ] On approval, a structured JSON version `it_{iteration}_TP.json` is generated (following a new test-plan schema).
- [ ] `state.json` → `tp_generation.status` is set to `"created"` and `tp_generation.file` is set to the JSON filename.
- [ ] `state.json` → `last_updated` and `updated_by` are set.
- [ ] Command fails with a clear error if precondition is not met.
- [ ] Typecheck / lint passes.

### US-005: Create the `create-test-plan` skill
**As a** end user, **I want** the test plan skill to instruct the agent to prioritize automated testing **so that** the generated test plan maximizes automated verification and minimizes manual steps.

**Acceptance Criteria:**
- [ ] Skill file exists at `.agents/skills/create-test-plan/SKILL.md` with proper YAML frontmatter.
- [ ] Skill instructs the agent to read the PRD (`it_{iteration}_PRD.json`) and project context to understand what needs testing.
- [ ] Skill instructs the agent to produce a structured test plan in markdown with test cases grouped by user story.
- [ ] Each test case specifies: ID, description, type (unit/integration/e2e), whether it is automated or manual, and expected result.
- [ ] Skill explicitly instructs the agent to prefer automated tests: functional requirements (FR-N) must be automated; manual tests are only permitted for UI/UX nuances that cannot be verified via DOM/state assertions (e.g., visual "feel").
- [ ] Skill instructs the agent to output the file to `.agents/flow/it_{iteration}_test-plan.md`.

### US-006: Create the `refine-test-plan` skill
**As a** end user, **I want** a refine skill with editor and challenger modes **so that** I can iteratively improve or critically review the test plan.

**Acceptance Criteria:**
- [ ] Skill file exists at `.agents/skills/refine-test-plan/SKILL.md` with proper YAML frontmatter.
- [ ] Editor mode (default): instructs the agent to improve the plan based on user feedback while preserving structure.
- [ ] Challenger mode (`--challenge`): instructs the agent to identify coverage gaps, weak assertions, missing edge cases, and over-reliance on manual testing.
- [ ] Skill instructs the agent to keep the same output file path.

## Functional Requirements
- FR-1: The `create test-plan` command must be implemented in `src/commands/create-test-plan.ts` following the same pattern as `create-project-context.ts`.
- FR-2: The `refine test-plan` command must be implemented in `src/commands/refine-test-plan.ts` following the same pattern as `refine-requirement.ts`.
- FR-3: The `approve test-plan` command must be implemented in `src/commands/approve-test-plan.ts` following the same pattern as `approve-requirement.ts`, including JSON conversion and schema validation.
- FR-4: All commands must use `readState()` / `writeState()` for state management with Zod schema validation.
- FR-5: All commands must use `loadSkill()` and `buildPrompt()` for skill-based agent invocation.
- FR-6: The `create-test-plan` skill must instruct the agent to maximize automation: every test case must be evaluated for automation feasibility, and manual-only tests require explicit justification based on the UI/UX exception rule.
- FR-7: File naming must follow the convention `it_{iteration}_test-plan.md` and `it_{iteration}_TP.json`.
- FR-8: State transitions must follow: `pending` → `pending_approval` (create) → `created` (approve), with refine not changing state.
- FR-9: CLI dispatch in `src/cli.ts` must register `create test-plan`, `refine test-plan`, and `approve test-plan` as valid commands.

## Non-Goals (Out of Scope)
- Executing the test plan (running actual tests) — that is a separate command (`nvst execute test-plan`).
- Generating actual test code or test files (e.g., `*.test.ts`) — the focus is on the plan document and its machine-readable JSON.
- Automated CI integration for the test plan.
- Test result tracking or reporting.

## Open Questions
- Should there be a precondition check that `prototype_build` has started or completed before defining a test plan, or is `project_context.status === "created"` sufficient? (Current assumption: `project_context.status === "created"` is sufficient as test plans are typically drafted before/during build).
