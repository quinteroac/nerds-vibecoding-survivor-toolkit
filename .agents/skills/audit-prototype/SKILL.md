---
name: audit-prototype
description: "Validate the current iteration's PRD against the implemented code via the audit prototype skill."
user-invocable: false
---

# Audit Prototype

Validate the product requirement document (PRD) for the current iteration against the implemented code.

## Context

- Iteration artifacts live under `.agents/flow/`.
- Relevant files:
  - `.agents/flow/it_{iteration}_PRD.json` — PRD (user stories, acceptance criteria, functional requirements)
  - `.agents/flow/it_{iteration}_progress.json` — implementation progress

## Task

For each use case / user story and its acceptance criteria (and any referenced functional requirements), validate that the codebase satisfies the PRD. Report any gaps or non-compliance.

## Output: Compliance report (mandatory structure)

Produce a **compliance report** with the following fixed structure so the user receives a consistent summary and per-FR / per-US verification. Write the report as JSON to:

`.agents/flow/it_{iteration}_compliance-report.json`

The report must include exactly these sections:

1. **Executive summary** — string.
2. **Verification by FR** — array of `{ "frId": "<id>", "assessment": "<value>" }` for each functional requirement. Assessment must be one of: `"comply"`, `"partially_comply"`, `"does_not_comply"` (or in Spanish: cumple / parcialmente cumple / no cumple — use English keys in JSON).
3. **Verification by US** — array of `{ "usId": "<id>", "assessment": "<value>" }` for each user story. Assessment must be one of: `"comply"`, `"partially_comply"`, `"does_not_comply"`.
4. **Minor observations** — array of strings (zero or more).
5. **Conclusions and recommendations** — string.

Each FR and US from the PRD must be explicitly assessed with one of: comply / partially comply / does not comply (English), or cumple / parcialmente cumple / no cumple if the surrounding document is in Spanish. In the JSON file use the English enum values: `"comply"`, `"partially_comply"`, `"does_not_comply"`.
