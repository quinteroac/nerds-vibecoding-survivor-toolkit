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
