# Requirement: Implement Audit Prototype Command

## Context

The NVST workflow includes an Audit phase (`nvst audit prototype`) that is currently a stub. This requirement implements the full audit flow: after "create prototype", the user runs the command so that an agent validates the PRD against the implemented code and delivers a compliance report. The user then chooses how to act on the recommendations (follow, change, or leave as is). The command must produce structured artifacts (`it_{iteration}_audit.md`, and when applicable `it_{iteration}_audit.json` in `.agents/flow/`, and updates to `TECHNICAL_DEBT.md`) with a mandatory format, so that outcomes are consistent regardless of which agent runs the audit.

**Execution pattern and scope:** The command must follow the same pattern as other skill-based commands (e.g. `define requirement`, `create prototype`): a CLI handler in `src/commands/` loads the skill from `.agents/skills/`, builds the prompt, and invokes the agent via the shared machinery in `src/agent.ts`. Implementation must update both the runtime layout (`.agents/`: skills, state, flow artifacts) and the project template (`scaffold/`: skill templates under `scaffold/.agents/skills/`) so that new projects created with `nvst init` exhibit the same audit behaviour.

## Goals

- Deliver a compliance report between the PRD and the prototype for each use case / FR, with clear recommendations (fix in code, adjust in PRD, or record as technical debt).
- Allow the user to drive next steps by choosing to follow recommendations, change them, or leave as is.
- Persist the audit result and refactor plan in defined artifacts (`it_{iteration}_audit.md`, `it_{iteration}_audit.json` when refactor is chosen, in `.agents/flow/`) and update technical debt when the user marks items as debt.

## User Stories

Each story is scoped so it can be implemented in one focused session.

### US-001: Run audit prototype after create prototype

**As an** end user, **I want** to run `nvst audit prototype` only after I have run `nvst create prototype` **so that** the audit validates the current iteration’s PRD against the code that was just produced.

**Acceptance Criteria:**

- [ ] The command fails or refuses to run if the current phase/state does not allow audit (e.g. create prototype has not been run for this iteration).
- [ ] When allowed, the command invokes the audit skill so the agent can validate PRD vs implemented code per use case / FR.
- [ ] The command is implemented following the same skill-based pattern as other agent-backed commands (handler in `src/commands/`, skill loaded from `.agents/skills/audit-prototype/`), and the audit skill template exists in `scaffold/.agents/skills/audit-prototype/` so that scaffolded projects get the same behaviour.
- [ ] Typecheck / lint passes.

### US-002: Receive compliance report with mandatory structure

**As an** end user, **I want** the agent to produce a compliance report with a fixed structure **so that** I get a consistent summary and per-FR / per-US verification.

**Acceptance Criteria:**

- [ ] The report includes: Executive summary, Verification by FR (comply / partially comply / does not comply), Verification by US (comply / partially comply / does not comply), Minor observations, Conclusions and recommendations.
- [ ] Each FR and US is explicitly assessed with one of: cumple / parcialmente cumple / no cumple (or equivalent English labels if the document is in English).
- [ ] Typecheck / lint passes.

### US-003: Choose how to act on recommendations

**As an** end user, **I want** to tell the agent what to do with the recommendations: follow them, change them, or leave as is **so that** I control whether to refactor, adjust the PRD, or record debt.

**Acceptance Criteria:**

- [ ] After presenting the report, the agent asks the user to choose: (a) follow recommendations, (b) change recommendations, (c) leave as is.
- [ ] If the user chooses (b), the agent asks what they want to change and updates the recommendations accordingly.
- [ ] The chosen outcome is used to drive generation of `it_{iteration}_audit.md` (and when applicable `it_{iteration}_audit.json` and `TECHNICAL_DEBT.md`).
- [ ] Typecheck / lint passes.

### US-004: Generate it_{iteration}_audit.md with refactor plan

**As an** end user, **I want** the command to always produce an audit artifact `it_{iteration}_audit.md` in `.agents/flow/` with the report sections plus the refactor plan **so that** the result is persisted and reproducible.

**Acceptance Criteria:**

- [ ] After the user has made their choice (follow / change / leave as is), the agent produces `it_{iteration}_audit.md` in `.agents/flow/` containing: Executive summary, Verification by FR, Verification by US, Minor observations, Conclusions and recommendations, and Refactor plan.
- [ ] The file is written to `.agents/flow/it_{iteration}_audit.md` with the mandatory structure.
- [ ] Typecheck / lint passes.

### US-005: Generate it_{iteration}_audit.json via write-json when user opts to refactor

**As an** end user, **I want** when I choose to follow or apply refactor recommendations that the command produces `it_{iteration}_audit.json` with structure similar to `PRD.json` **so that** downstream refactor/approval flows can consume it.

**Acceptance Criteria:**

- [ ] When the user chooses to refactor (option a or after changing recommendations to include refactor), the command generates `it_{iteration}_audit.json` using `nvst write-json` (or the programmatic equivalent used by write-json).
- [ ] The JSON structure is similar to the existing PRD JSON (e.g. goals, userStories, functionalRequirements or equivalent refactor-oriented fields).
- [ ] The file is written to `.agents/flow/it_{iteration}_audit.json`.
- [ ] Typecheck / lint passes.

### US-006: Update TECHNICAL_DEBT.md when user marks items as debt

**As an** end user, **I want** when I choose to leave some recommendations as technical debt that `TECHNICAL_DEBT.md` is updated **so that** debt is tracked in one place.

**Acceptance Criteria:**

- [ ] When the user marks one or more recommendations as technical debt (e.g. via option c or by explicitly choosing “leave as debt”), the command updates `.agents/TECHNICAL_DEBT.md` (or the project’s designated technical-debt file) with those items.
- [ ] Updates are additive or merge correctly so existing debt entries are not lost.
- [ ] Typecheck / lint passes.

## Functional Requirements

- **FR-1:** The `nvst audit prototype` command must only run when the workflow state indicates that “create prototype” has been completed for the current iteration (e.g. phase/status checks in `state.json`).
- **FR-2:** The audit skill must instruct the agent to validate the current iteration’s PRD (and optionally `it_*_PRD.json`) against the codebase and produce the compliance report with the mandatory sections (Executive summary, Verification by FR, Verification by US, Minor observations, Conclusions and recommendations).
- **FR-3:** The audit flow must present recommendations to the user and collect their choice: (a) follow recommendations, (b) change recommendations, (c) leave as is. If (b), the agent must ask what to change and adjust before continuing.
- **FR-4:** The command must always generate `it_{iteration}_audit.md` in `.agents/flow/` with the mandatory structure plus Refactor plan, after the user’s choice is known.
- **FR-5:** When the user’s choice implies refactor, the command must generate `it_{iteration}_audit.json` in `.agents/flow/` using the same mechanism as `nvst write-json` (schema-driven write), with structure similar to the PRD JSON.
- **FR-6:** When the user marks recommendations as technical debt, the command must update `TECHNICAL_DEBT.md` (location per project convention, e.g. `.agents/TECHNICAL_DEBT.md`) with the new debt items.
- **FR-7:** The implementation must follow the same skill-based command pattern as other agent-backed commands (handler in `src/commands/`, skill loaded from `.agents/skills/<name>/SKILL.md`, prompt building and agent invocation via shared utilities) and must update both `.agents/` (runtime skills and flow) and `scaffold/` (skill templates under `scaffold/.agents/skills/`) so that the audit skill and behaviour are available in instantiated and scaffolded projects alike.

## Non-Goals (Out of Scope)

- Implementing automated static analysis or test execution inside the CLI; the agent may use such tools, but the requirement is the flow and artifacts, not specific tooling.
- Changing the existing PRD or prototype code from within the audit command; the command produces reports and refactor/debt artifacts; applying changes is a separate phase (refactor prototype / approve).
- Supporting audit without having run create prototype in the same iteration.

## Open Questions

- None (audit artifacts: `it_{iteration}_audit.md` and `it_{iteration}_audit.json` in `.agents/flow/`).
