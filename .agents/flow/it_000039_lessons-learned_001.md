# Lessons Learned — Iteration 000039

## US-001 — CoD Reasoning in `define-requirement` skill

**Summary:** Added a `## Reasoning Protocol` section to `nvst-skills/define-requirement/SKILL.md` with Chain of Draft (CoD) instructions for internal AI reasoning.

**Key Decisions:** Placed the new section between the introductory block and `## The Job` so it is read before any execution steps begin. Used bullet points to clearly separate scope, step-length constraint, purpose, and the guarantee that user-facing output is unaffected.

**Pitfalls Encountered:** None — this is a documentation-only change with no TypeScript or runtime components involved; no typecheck issues possible.

**Useful Context for Future Agents:** `nvst-skills/` contains SKILL.md prompt files consumed by AI agents, not TypeScript code. Changes to these files only require verifying the Markdown structure is correct and all existing sections remain intact. The `## Reasoning Protocol` pattern established here can be reused verbatim in other skill files (e.g. `refine-requirement`, `audit-prototype`) if CoD is desired there too.

## US-002 — CoD Reasoning in `refine-requirement` skill

**Summary:** Added a `## Reasoning Protocol` section to `nvst-skills/refine-requirement/SKILL.md` with Chain of Draft (CoD) instructions for internal AI reasoning, matching the pattern from US-001.

**Key Decisions:** Inserted the new section between the introductory block (mode description) and `## The Job`, identical placement to `define-requirement`. Example draft steps were tailored to refine-requirement context (e.g. "missing edge case found", "scope creep in US-003").

**Pitfalls Encountered:** None — pure Markdown change; no TypeScript involved.

**Useful Context for Future Agents:** The `## Reasoning Protocol` section is now consistently present in both `define-requirement` and `refine-requirement`. When adding CoD to remaining skills (e.g. `audit-prototype`, `create-prototype`), follow the same placement (before `## The Job`) and tailor example draft steps to the skill's domain.

## US-003 — CoD Reasoning in `create-prototype` skill

**Summary:** Added a `## Reasoning Protocol` section to `nvst-skills/create-prototype/SKILL.md` with Chain of Draft (CoD) instructions for internal AI reasoning.

**Key Decisions:** Inserted the section between the introductory front-matter block and `## The Job`, matching the exact placement used in `define-requirement` and `refine-requirement`. Example draft steps were tailored to prototype-creation context (e.g. "parse argv first", "reuse state helper", "add unit test AC01").

**Pitfalls Encountered:** None — pure Markdown change; no TypeScript involved.

**Useful Context for Future Agents:** The `## Reasoning Protocol` CoD pattern is now consistently applied across `define-requirement`, `refine-requirement`, and `create-prototype`. For any remaining skills needing CoD (e.g. `audit-prototype`, `refactor-prototype`), follow the same placement and tailor the example draft steps to the skill domain. No typecheck or build steps are required for SKILL.md edits.

## US-004 — CoD Reasoning in `audit-prototype` skill

**Summary:** Added a `## Reasoning Protocol` section to `nvst-skills/audit-prototype/SKILL.md` with Chain of Draft (CoD) instructions for internal AI reasoning.

**Key Decisions:** Placed the new section between the title/description block and `## Context`, before any execution sections, consistent with the pattern used in the other three skills. Example draft steps were tailored to audit context (e.g. "AC01 missing test", "FR-02 partially covered").

**Pitfalls Encountered:** None — pure Markdown change; no TypeScript involved. `audit-prototype` has no `## The Job` section (unlike other skills), so the section was placed right after the introductory paragraph, before `## Context`.

**Useful Context for Future Agents:** The `## Reasoning Protocol` CoD pattern is now applied to all four skills: `define-requirement`, `refine-requirement`, `create-prototype`, and `audit-prototype`. The placement rule is: insert after the introductory block, before the first substantive section. No typecheck or build steps are required for SKILL.md edits.

## US-005 — CoD Reasoning in `refactor-prototype` skill

**Summary:** Added a `## Reasoning Protocol` section to `nvst-skills/refactor-prototype/SKILL.md` with Chain of Draft (CoD) instructions for internal AI reasoning.

**Key Decisions:** Placed the new section between the introductory paragraph and `## Your task`, matching the placement pattern used in other skills. Example draft steps were tailored to refactor-prototype context (e.g. "parse audit JSON first", "group items by file", "run typecheck after each change").

**Pitfalls Encountered:** None — pure Markdown change; no TypeScript involved.

**Useful Context for Future Agents:** The `## Reasoning Protocol` CoD pattern is now applied to all five skills: `define-requirement`, `refine-requirement`, `create-prototype`, `audit-prototype`, and `refactor-prototype`. The placement rule is: insert after the introductory block, before the first substantive section (`## Your task` or `## The Job`). No typecheck or build steps are required for SKILL.md edits.

## US-006 — CoD Reasoning in `approve-prototype` skill

**Summary:** Added a `## Reasoning Protocol` section to `nvst-skills/approve-prototype/SKILL.md` with Chain of Draft (CoD) instructions for internal AI reasoning.

**Key Decisions:** Placed the new section after the `All generated content **must be in English**.` line and before `## Files and artifacts you must use`, consistent with the placement pattern across all other skills. Example draft steps were tailored to approve-prototype context (e.g. "read PRD artifacts first", "context doc needs update", "roadmap item completed").

**Pitfalls Encountered:** None — pure Markdown change; no TypeScript involved.

**Useful Context for Future Agents:** The `## Reasoning Protocol` CoD pattern is now applied to all six skills: `define-requirement`, `refine-requirement`, `create-prototype`, `audit-prototype`, `refactor-prototype`, and `approve-prototype`. The CoD section is always placed after the introductory block, before the first substantive section. No typecheck or build steps are required for SKILL.md edits.
