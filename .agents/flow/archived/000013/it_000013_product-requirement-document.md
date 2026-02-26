# Requirement: Refactor Plan Definition Commands

## Context

NVST currently supports the Define phase (`define requirement → refine requirement → approve requirement`) and the Prototype phase fully. The Refactor phase state schema is already defined in `tmpl_state.ts` (`refactor_plan: pending | pending_approval | approved`) but no CLI commands exist to drive it. This iteration adds the three commands that complete the Refactor phase entry point: `define refactor-plan`, `refine refactor-plan`, and `approve refactor-plan`, mirroring the Define phase pattern.

## Goals

- Allow a developer to run `bun nvst define refactor-plan` to invoke an agent (using the `plan-refactor` skill, which incorporates evaluation) and produce a structured refactor plan document.
- Allow iterative refinement of the plan via `bun nvst refine refactor-plan` with `--edit` (default) and `--challenge` modes, matching the UX of `refine requirement`.
- Allow the developer to approve the plan via `bun nvst approve refactor-plan`, which transitions state to `approved` and generates a validated `it_000013_refactor-prd.json`.

## User Stories

### US-001: Define Refactor Plan

**As a** developer, **I want** to run `bun nvst define refactor-plan` **so that** an agent evaluates the prototype codebase and interactively produces a refactor plan document for the current iteration.

**Acceptance Criteria:**
- [ ] Command is rejected with a descriptive error if `current_phase !== "refactor"`.
- [ ] Command is rejected with a descriptive error if `refactor.refactor_plan.status !== "pending"`.
- [ ] The `plan-refactor` skill is loaded from `.agents/skills/plan-refactor/SKILL.md` and its body is passed to `buildPrompt` with `{ current_iteration }`.
- [ ] Agent is invoked interactively (`interactive: true`) via `invokeAgent`.
- [ ] On agent success (`exitCode === 0`), `state.phases.refactor.refactor_plan.status` is set to `"pending_approval"` and `state.phases.refactor.refactor_plan.file` is set to `it_000013_refactor-plan.md`.
- [ ] `state.last_updated` and `state.updated_by` (`"nvst:define-refactor-plan"`) are updated and persisted via `writeState`.
- [ ] Typecheck / lint passes.

---

### US-002: Refine Refactor Plan

**As a** developer, **I want** to run `bun nvst refine refactor-plan [--challenge]` **so that** I can iteratively improve the plan either by editing it freely or by having the agent critically challenge it.

**Acceptance Criteria:**
- [ ] Command is rejected with a descriptive error if `refactor.refactor_plan.status !== "pending_approval"`.
- [ ] Command is rejected with a descriptive error if `refactor.refactor_plan.file` is missing or the file does not exist on disk.
- [ ] A `refine-refactor-plan` skill is loaded from `.agents/skills/refine-refactor-plan/SKILL.md`.
- [ ] The current refactor plan file content is read and included in the prompt context (`{ current_iteration, refactor_plan_file, refactor_plan_content }`).
- [ ] When `--challenge` flag is passed, `context.mode = "challenger"` is added to the prompt context (matching the `refine requirement` pattern).
- [ ] Agent is invoked interactively. State is NOT mutated (status remains `pending_approval`).
- [ ] Typecheck / lint passes.

---

### US-003: Approve Refactor Plan

**As a** developer, **I want** to run `bun nvst approve refactor-plan` **so that** the refactor plan is locked and a validated `it_000013_refactor-prd.json` is generated for downstream use.

**Acceptance Criteria:**
- [ ] Command is rejected with a descriptive error if `refactor.refactor_plan.status !== "pending_approval"`.
- [ ] Command is rejected with a descriptive error if `refactor.refactor_plan.file` is missing or the file does not exist on disk.
- [ ] The refactor plan markdown is read and parsed into a structured object matching a new `RefactorPrd` Zod schema.
- [ ] `nvst write-json --schema refactor-prd` is invoked to validate and write `it_000013_refactor-prd.json` into `.agents/flow/`.
- [ ] If `write-json` fails, the command prints an error and exits without mutating state (plan remains `pending_approval`).
- [ ] On success, `state.phases.refactor.refactor_plan.status` is set to `"approved"` and state is persisted.
- [ ] `state.last_updated` and `state.updated_by` (`"nvst:approve-refactor-plan"`) are updated.
- [ ] Typecheck / lint passes.

---

## Functional Requirements

- FR-1: Add `define refactor-plan` routing to `src/cli.ts`, dispatching to a new `src/commands/define-refactor-plan.ts` handler. The handler accepts a `provider` option (same as `define requirement`).
- FR-2: Add `refine refactor-plan` routing to `src/cli.ts`, dispatching to a new `src/commands/refine-refactor-plan.ts` handler. The handler accepts `provider` and `challenge: boolean` options.
- FR-3: Add `approve refactor-plan` routing to `src/cli.ts`, dispatching to a new `src/commands/approve-refactor-plan.ts` handler.
- FR-4: Create `.agents/skills/refine-refactor-plan/SKILL.md` with edit and challenge mode instructions for refining a refactor plan document.
- FR-5: Create `scaffold/schemas/tmpl_refactor-prd.ts` with a `RefactorPrdSchema` Zod schema. The schema must capture at minimum: a list of refactor items each with `id` (format `RI-NNN`), `title`, `description`, and `rationale` fields. Mirror the structure of `tmpl_prd.ts`.
- FR-6: Register the `refactor-prd` schema in `src/commands/write-json.ts` (or wherever schemas are mapped) so `nvst write-json --schema refactor-prd` resolves correctly.
- FR-7: `define-refactor-plan.ts` must guard that `current_phase === "refactor"` before proceeding.
- FR-8: All three commands must follow the no-`process.exit()` rule; use `process.exitCode = 1` on error and return.
- FR-9: Update `.agents/skills/plan-refactor/SKILL.md` with concrete objectives, inputs (`it_<iteration>_PRD.json`, `PROJECT_CONTEXT.md`, codebase), and output (`it_<iteration>_refactor-plan.md`). The skill must instruct the agent to both evaluate the prototype and produce the ordered plan in a single interactive session. The output document must use the following structure: a `## Refactor Items` section containing one `### RI-NNN: <Title>` subsection per item, each with a `**Description:**` field and a `**Rationale:**` field. This structure must align with `RefactorPrdSchema` (FR-5).

## Non-Goals (Out of Scope)

- Executing the refactor plan (`nvst execute refactor`) — that is a future iteration.
- Updating the existing `it_<iteration>_PRD.json` with refactor use cases (the `refactor-prd` skill's stated purpose); only a new standalone `it_<iteration>_refactor-prd.json` is produced here.
- Generating a changelog or evaluation report as separate state-tracked artifacts.
- Introducing a separate `nvst evaluate` command; evaluation is embedded in the `plan-refactor` skill.
- Any changes to the Define or Prototype phase commands.
- Transitioning `current_phase` away from `"refactor"` — `approve refactor-plan` only advances `refactor_plan.status` to `"approved"`; phase transition is handled by a separate future command.

## Open Questions

_All open questions resolved._

- **Q1 (resolved):** `plan-refactor` skill is self-contained — it embeds evaluation objectives and produces the refactor plan in a single interactive session. No separate `evaluate` step. See FR-9.
- **Q2 (resolved):** `it_<iteration>_refactor-plan.md` must use a `## Refactor Items` section with `### RI-NNN: <Title>` subsections, each containing `**Description:**` and `**Rationale:**` fields. See FR-5 and FR-9.
- **Q3 (resolved):** `approve refactor-plan` does **not** transition `current_phase`. It only sets `refactor_plan.status` to `"approved"`. Phase transition is a separate future command. See Non-Goals.
