# Audit — Iteration 000043

## Executive Summary

Iteration 000043 implements knowledge transfer between agent invocations within a single `nvst create prototype` run. Both user stories are fully implemented: US-001 (agent writes lessons-learned post-story) and US-002 (agent reads lessons-learned pre-story). The `create-prototype.ts` command correctly reads the lessons-learned file before each story prompt is built, passes the content as a `lessons_learned` context variable, and the SKILL.md provides both a pre-implementation review step and a post-implementation write step with a detailed entry template. All 19 acceptance criteria tests pass and typecheck succeeds. One minor gap: FR-6 requires `lessons_learned` to follow the same `{{variable}}` pattern as other context variables, but neither it nor existing variables use that syntax in SKILL.md — and `lessons_learned` is missing from the Inputs table.

---

## Verification by FR

| FR ID | Assessment | Notes |
|-------|------------|-------|
| FR-1 | ✅ comply | `defaultReadLessonsLearned` reads the file and returns `""` if absent; path uses `FLOW_REL_DIR` and iteration. |
| FR-2 | ✅ comply | `buildPrompt` is called with `lessons_learned: lessonsLearnedContent` in both IDE and non-IDE code paths. |
| FR-3 | ✅ comply | SKILL.md Step 3: "Review lessons learned — if `lessons_learned` is present and non-empty, read it carefully before planning. Skip silently if absent or empty." |
| FR-4 | ✅ comply | SKILL.md has a post-implementation "Lessons Learned" section with a full entry template (story ID, summary, key decisions, pitfalls, useful context). Checklist item also present. |
| FR-5 | ✅ comply | Path in source: `join(projectRoot, FLOW_REL_DIR, 'it_${iteration}_lessons-learned.md')`. SKILL.md instructs writing to `it_{iteration}_lessons-learned.md`. |
| FR-6 | ⚠️ partially_comply | `lessons_learned` is referenced correctly in prose but is not listed in the Inputs table of SKILL.md (unlike `iteration`, `project_context`, `user_story`). No `{{variable}}` syntax is used for any variable (consistent internally, but diverges from PRD intent). |

---

## Verification by US

| US ID | Assessment | Notes |
|-------|------------|-------|
| US-001 | ✅ comply | All 5 ACs satisfied: SKILL.md instructs creating/appending the entry (AC01), template includes all required fields (AC02), instruction is after the checklist (AC03), naming convention `it_{iteration}_lessons-learned.md` used (AC04), typecheck passes (AC05). |
| US-002 | ✅ comply | All automatable ACs satisfied: `create-prototype.ts` reads file before each prompt (AC01), SKILL.md includes pre-implementation review step (AC02), empty string returned gracefully when file absent (AC03), `## Lessons Learned from Previous Stories` heading added to content (AC04), typecheck passes (AC05). AC06 (manual multi-story verification) is not automatable but is covered by unit tests. |

---

## Minor Observations

- **FR-6 / Inputs table gap**: `lessons_learned` is not listed in the Inputs table of SKILL.md, while the other three context variables (`iteration`, `project_context`, `user_story`) are explicitly documented there. Adding a row would make the skill's interface self-describing.
- **FR-6 / Placeholder pattern**: The PRD referenced a `{{variable}}` placeholder pattern, but `buildPrompt` appends all context variables as markdown sections rather than replacing inline placeholders. No context variable in the create-prototype SKILL.md uses `{{variable}}` syntax; the implementation is internally consistent but diverges from the PRD's stated pattern.
- **US-002-AC06**: Manual verification of multi-story prompt population cannot be validated in an automated audit. Expected to work given unit test coverage.
- **Good design**: `defaultReadLessonsLearned` is exported from `create-prototype.ts`, enabling clean unit testing via dependency injection.

---

## Conclusions and Recommendations

The implementation fully satisfies both user stories and five of six functional requirements. The only gap (FR-6) is documentation-level: `lessons_learned` should be added to the Inputs table in SKILL.md so the skill's interface is self-describing. No production code changes are required.

---

## Refactor Plan

**One change required** (documentation only, no code changes):

### 1. Add `lessons_learned` to the Inputs table in `nvst-skills/create-prototype/SKILL.md`

**File**: `nvst-skills/create-prototype/SKILL.md`  
**Change**: Add the following row to the Inputs table:

```markdown
| `lessons_learned` (context variable) | Accumulated insights from previous agents in this iteration; empty string if none exist yet |
```

This should be inserted after the `iteration` row in the existing Inputs table:

```markdown
| Source | Used for |
|--------|----------|
| `user_story` (context variable) | The user story JSON with id, title, description, and acceptanceCriteria |
| `project_context` (context variable) | Project conventions, tech stack, code standards, testing strategy, and architecture |
| `iteration` (context variable) | Current iteration number for file naming and context |
| `lessons_learned` (context variable) | Accumulated insights from previous agents in this iteration; empty string if none exist yet |
```

**Rationale**: FR-6 requires `lessons_learned` to be documented consistently with other context variables. This is a zero-risk change that improves skill discoverability.
