---
name: plan-refactor
description: "Produces an ordered refactor plan from the evaluation report. Triggered by: bun nvst define refactor-plan."
user-invocable: true
---

# Plan Refactor

Read the evaluation report for the current iteration and produce an ordered refactor plan saved as `it_{current_iteration}_refactor-plan.md`.

**Do NOT implement code. Only produce the refactor plan document.**

## Inputs

| Source | Used for |
|--------|----------|
| `current_iteration` | Iteration identifier used in the output filename |
| `it_{current_iteration}_evaluation-report.md` | Source of identified issues, technical debt, and improvement recommendations |

## Outputs

`it_{current_iteration}_refactor-plan.md` — ordered refactor plan with one entry per refactor item.

## Instructions

1. Read the evaluation report in full before writing any output.
2. Identify quick wins (low effort, high impact) and critical refactorings (high urgency or high risk).
3. For items that require a user decision (e.g. trade-offs between approaches), ask the user before committing to an entry.
4. Order items by priority: critical blockers first, quick wins second, long-term improvements last.
5. Assign each item a unique id in `RI-NNN` format (e.g. `RI-001`, `RI-002`).
6. Write the output file using the structure defined below.

## Output Structure

```markdown
# Refactor Plan — Iteration {current_iteration}

## Refactor Items

### RI-001: <Title>

**Description:** One or two sentences describing what needs to change and why it is a problem.

**Rationale:** Why this item is prioritised at this position — impact, urgency, or risk reduction.

### RI-002: <Title>

**Description:** ...

**Rationale:** ...
```

## Checklist

- [ ] Output is in English
- [ ] Output file is `it_{current_iteration}_refactor-plan.md`
- [ ] Each item has a unique `RI-NNN` id, a `**Description:**`, and a `**Rationale:**`
- [ ] Items are ordered by priority
- [ ] State files are not modified by this skill
