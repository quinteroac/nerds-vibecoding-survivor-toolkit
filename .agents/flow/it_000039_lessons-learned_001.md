# Lessons Learned — Iteration 000039

## US-001 — CoD Reasoning in `define-requirement` skill

**Summary:** Added a `## Reasoning Protocol` section to `nvst-skills/define-requirement/SKILL.md` with Chain of Draft (CoD) instructions for internal AI reasoning.

**Key Decisions:** Placed the new section between the introductory block and `## The Job` so it is read before any execution steps begin. Used bullet points to clearly separate scope, step-length constraint, purpose, and the guarantee that user-facing output is unaffected.

**Pitfalls Encountered:** None — this is a documentation-only change with no TypeScript or runtime components involved; no typecheck issues possible.

**Useful Context for Future Agents:** `nvst-skills/` contains SKILL.md prompt files consumed by AI agents, not TypeScript code. Changes to these files only require verifying the Markdown structure is correct and all existing sections remain intact. The `## Reasoning Protocol` pattern established here can be reused verbatim in other skill files (e.g. `refine-requirement`, `audit-prototype`) if CoD is desired there too.
