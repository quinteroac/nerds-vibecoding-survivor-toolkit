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
