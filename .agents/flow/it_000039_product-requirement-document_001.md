# Requirement: Chain of Draft Reasoning in NVST Workflow Skills

## Context

NVST workflow skills (`SKILL.md` files) currently instruct the AI agent to perform complex, multi-step tasks (requirement gathering, prototype creation, auditing, etc.) without any explicit reasoning strategy. Chain of Draft (CoD) is a prompting technique where the model generates ultra-concise internal reasoning steps (~5 words each) before producing its final output — saving 75–92% of reasoning tokens compared to Chain of Thought while matching its accuracy. This iteration embeds CoD instructions into the 10 NVST workflow skills so agents reason more efficiently while keeping all user-facing communication fully intact and readable.

## Goals

- Reduce token consumption during agent reasoning steps by 75–92% across all NVST workflow skills.
- Maintain full quality and completeness of user-facing output (documents, questions, prompts).
- Establish a consistent, reusable CoD instruction pattern across all workflow SKILL.md files.

## User Stories

### US-001: CoD Reasoning in `define-requirement` skill
**As an** AI agent executing the `define-requirement` skill, **I want** to use Chain of Draft for my internal reasoning steps **so that** I consume fewer tokens when deciding which clarifying questions to ask and how to structure the PRD, without reducing the quality of questions or the final document.

**Acceptance Criteria:**
- [ ] `nvst-skills/define-requirement/SKILL.md` contains a `## Reasoning Protocol` section (or equivalent clearly-labeled block) with CoD instructions.
- [ ] The CoD section explicitly states it applies to internal reasoning only, not to user-facing output.
- [ ] CoD instructions specify that each draft step must be ≤ ~5 words.
- [ ] All existing user-facing sections (job steps, output structure, questions flow) remain complete and unmodified in substance.
- [ ] Typecheck / lint passes.

### US-002: CoD Reasoning in `refine-requirement` skill
**As an** AI agent executing the `refine-requirement` skill, **I want** to apply CoD for internal reasoning **so that** I efficiently determine what aspects of the PRD need refinement before communicating feedback to the user.

**Acceptance Criteria:**
- [ ] `nvst-skills/refine-requirement/SKILL.md` contains the CoD `## Reasoning Protocol` section.
- [ ] CoD applies only to internal reasoning; user-facing output (clarifying questions, updated PRD) is unaffected.
- [ ] Each draft step ≤ ~5 words.
- [ ] Existing sections remain intact.
- [ ] Typecheck / lint passes.

### US-003: CoD Reasoning in `create-prototype` skill
**As an** AI agent executing the `create-prototype` skill, **I want** to use CoD for internal reasoning **so that** I efficiently plan implementation decisions (file structure, test strategy, approach) before writing code or producing prompts.

**Acceptance Criteria:**
- [ ] `nvst-skills/create-prototype/SKILL.md` contains the CoD `## Reasoning Protocol` section.
- [ ] CoD applies only to internal reasoning; implementation prompts and user output remain complete.
- [ ] Each draft step ≤ ~5 words.
- [ ] Existing sections remain intact.
- [ ] Typecheck / lint passes.

### US-004: CoD Reasoning in `audit-prototype` skill
**As an** AI agent executing the `audit-prototype` skill, **I want** to apply CoD when reasoning about findings **so that** I efficiently triage issues before producing the audit report.

**Acceptance Criteria:**
- [ ] `nvst-skills/audit-prototype/SKILL.md` contains the CoD `## Reasoning Protocol` section.
- [ ] CoD applies only to internal reasoning; the audit report output is complete and readable.
- [ ] Each draft step ≤ ~5 words.
- [ ] Existing sections remain intact.
- [ ] Typecheck / lint passes.

### US-005: CoD Reasoning in `refactor-prototype` skill
**As an** AI agent executing the `refactor-prototype` skill, **I want** to use CoD for internal reasoning **so that** I efficiently plan refactoring decisions before generating the refactor plan.

**Acceptance Criteria:**
- [ ] `nvst-skills/refactor-prototype/SKILL.md` contains the CoD `## Reasoning Protocol` section.
- [ ] CoD applies only to internal reasoning; the refactor plan output is complete and readable.
- [ ] Each draft step ≤ ~5 words.
- [ ] Existing sections remain intact.
- [ ] Typecheck / lint passes.

### US-006: CoD Reasoning in `approve-prototype` skill
**As an** AI agent executing the `approve-prototype` skill, **I want** to use CoD for internal reasoning **so that** I efficiently evaluate approval criteria before producing the approval output and triggering downstream steps.

**Acceptance Criteria:**
- [ ] `nvst-skills/approve-prototype/SKILL.md` contains the CoD `## Reasoning Protocol` section.
- [ ] CoD applies only to internal reasoning; approval output and user communication remain complete.
- [ ] Each draft step ≤ ~5 words.
- [ ] Existing sections remain intact.
- [ ] Typecheck / lint passes.

### US-007: CoD Reasoning in `create-project-context` skill
**As an** AI agent executing the `create-project-context` skill, **I want** to apply CoD when reasoning about codebase conventions **so that** I efficiently synthesize patterns before writing `PROJECT_CONTEXT.md`.

**Acceptance Criteria:**
- [ ] `nvst-skills/create-project-context/SKILL.md` contains the CoD `## Reasoning Protocol` section.
- [ ] CoD applies only to internal reasoning; the generated `PROJECT_CONTEXT.md` is complete and unaffected.
- [ ] Each draft step ≤ ~5 words.
- [ ] Existing sections remain intact.
- [ ] Typecheck / lint passes.

### US-008: CoD Reasoning in `refine-project-context` skill
**As an** AI agent executing the `refine-project-context` skill, **I want** to use CoD for internal reasoning **so that** I efficiently detect discrepancies between the documented context and the actual codebase before proposing updates.

**Acceptance Criteria:**
- [ ] `nvst-skills/refine-project-context/SKILL.md` contains the CoD `## Reasoning Protocol` section.
- [ ] CoD applies only to internal reasoning; all user-facing output and context updates remain complete.
- [ ] Each draft step ≤ ~5 words.
- [ ] Existing sections remain intact.
- [ ] Typecheck / lint passes.

### US-009: CoD Reasoning in `ideate` skill
**As an** AI agent executing the `ideate` skill, **I want** to apply CoD when reasoning about ideas and roadmap candidates **so that** I efficiently evaluate options before presenting them to the user.

**Acceptance Criteria:**
- [ ] `nvst-skills/ideate/SKILL.md` contains the CoD `## Reasoning Protocol` section.
- [ ] CoD applies only to internal reasoning; the ideation output (interview, roadmap proposals) remains complete and readable.
- [ ] Each draft step ≤ ~5 words.
- [ ] Existing sections remain intact.
- [ ] Typecheck / lint passes.

### US-010: CoD Reasoning in `execute-automated-fix` skill
**As an** AI agent executing the `execute-automated-fix` skill, **I want** to use CoD for internal reasoning **so that** I efficiently diagnose and plan fixes before modifying code.

**Acceptance Criteria:**
- [ ] `nvst-skills/execute-automated-fix/SKILL.md` contains the CoD `## Reasoning Protocol` section.
- [ ] CoD applies only to internal reasoning; the fix implementation and user communication remain complete.
- [ ] Each draft step ≤ ~5 words.
- [ ] Existing sections remain intact.
- [ ] Typecheck / lint passes.

## Functional Requirements

- **FR-1:** Each of the 10 NVST workflow SKILL.md files (`define-requirement`, `refine-requirement`, `create-prototype`, `audit-prototype`, `refactor-prototype`, `approve-prototype`, `create-project-context`, `refine-project-context`, `ideate`, `execute-automated-fix`) must include a `## Reasoning Protocol` section.
- **FR-2:** The `## Reasoning Protocol` section must instruct the model to use Chain of Draft for all internal reasoning: concise draft steps of ≤ ~5 words each, written only in a private scratchpad or thinking block, never surfaced to the user.
- **FR-3:** The `## Reasoning Protocol` section must explicitly distinguish between internal reasoning (CoD, concise) and user-facing output (normal, complete prose).
- **FR-4:** The CoD instruction pattern must be consistent in wording and placement across all 10 skills to establish a reusable standard.
- **FR-5:** No existing user-facing section in any SKILL.md may be removed or substantively altered — only the CoD section is added.
- **FR-6:** The `## Reasoning Protocol` section must be placed near the top of each SKILL.md, after the frontmatter and title, before the main job steps — so it is loaded into context first.

## Non-Goals (Out of Scope)

- UI/design skills (`adapt`, `animate`, `audit`, `bolder`, `colorize`, `critique`, `distill`, `frontend-design`, `harden`, `normalize`, `onboard`, `optimize`, `polish`, `quieter`, `teach-impeccable`) are excluded from this iteration.
- Measuring or benchmarking actual token savings in production — this is a prompt-engineering change, not an instrumentation task.
- Changing how `nvst` CLI commands invoke or load skills.
- Modifying any TypeScript source files in `src/`.

## Open Questions

- None
