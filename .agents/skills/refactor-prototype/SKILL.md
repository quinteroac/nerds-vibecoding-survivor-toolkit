---
name: refactor-prototype
description: "Load the refactor plan from it_{iteration}_audit.json and invoke the agent to apply code changes."
user-invocable: false
---

# Refactor Prototype

Apply the refactor plan produced by the audit phase to the codebase.

## Your task

1. **Read the audit JSON** at the path provided in the Context section below (`audit_json_path`). This file contains the refactor plan (e.g. goals, user stories, refactor items) from `nvst audit prototype`.

2. **Understand the refactor plan** — goals, recommended changes, and any structured refactor items.

3. **Apply the code changes** — implement each refactor item in the codebase. Follow project conventions and the existing architecture.

4. **Run quality checks** — at minimum run the project's typecheck (e.g. `bun run typecheck`). Fix any issues before finishing.

## Context

You will receive:

- `iteration`: current iteration (e.g. `000026`).
- `audit_json_path`: absolute path to `it_{iteration}_audit.json` in `.agents/flow/`. Read this file to get the refactor plan.

Use the audit JSON as the single source of truth for what to refactor; then apply the changes and verify with the project's quality checks.
