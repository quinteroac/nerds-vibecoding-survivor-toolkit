---
name: create-test-plan
description: "Creates a structured test plan from the PRD and project context with automation-first guidance. Triggered by: bun nvst create test-plan."
user-invocable: true
---

# Create Test Plan

Create a complete test plan for the current iteration and save it as:
`.agents/flow/it_{iteration}_test-plan.md`

All generated content must be in English.

---

## Inputs

Read these first to understand what must be tested:

1. `it_{iteration}_PRD.json`
2. `.agents/PROJECT_CONTEXT.md`

Use the PRD to identify user stories, acceptance criteria, and functional requirements (`FR-N`).
Use project context to align test types, tooling, and conventions.

---

## Output Format

Produce a Markdown test plan structured by user story.

Use this structure:

```markdown
# Test Plan - Iteration {iteration}

## User Story: <id> - <title>

| Test Case ID | Description | Type (unit/integration/e2e) | Mode (automated/manual) | Correlated Requirements (US-XXX, FR-X) | Expected Result |
|---|---|---|---|---|---|
| TC-... | ... | ... | ... | US-001, FR-1 | ... |
```

Every test case must include:
- `Test Case ID`
- `Description`
- `Type` (`unit`, `integration`, or `e2e`)
- Whether it is `automated` or `manual`
- `Correlated Requirements` with at least one requirement ID (`US-XXX`, `FR-X`)
- `Expected Result`

---

## Automation-First Rules (Mandatory)

1. Prioritize automated testing for this plan.
2. Every functional requirement (`FR-N`) must have automated coverage.
3. Every functional requirement (`FR-N`) must appear in at least one test case `Correlated Requirements` field.
4. Manual tests are allowed only for UI/UX nuances that cannot be reliably validated through DOM/state assertions (for example: subjective visual "feel").
5. If a test is marked manual, explicitly justify why automation is not reliable for that case.

---

## Checklist

- [ ] Read `it_{iteration}_PRD.json`
- [ ] Read `.agents/PROJECT_CONTEXT.md`
- [ ] Test cases are grouped by user story
- [ ] Every `FR-N` is covered by automated test cases
- [ ] Every test case includes correlated requirement IDs (`US-XXX`, `FR-X`)
- [ ] Manual tests are only UI/UX nuance checks that cannot be validated via DOM/state assertions
- [ ] File written to `.agents/flow/it_{iteration}_test-plan.md`
