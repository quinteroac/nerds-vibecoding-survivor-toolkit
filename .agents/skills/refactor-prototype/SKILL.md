---
name: refactor-prototype
description: "Load the refactor plan from it_{iteration}_audit.json and invoke the agent to apply code changes."
user-invocable: false
---

# Refactor Prototype

Apply the refactor plan produced by the audit phase to the codebase in a **single, autonomous agent session**.

## Your task

1. **Read the audit JSON** at the path provided in the Context section below (`audit_json_path`). This file contains the refactor plan (e.g. goals, user stories, refactor items, and quality checks) from `nvst audit prototype`.

2. **Understand the refactor plan** — goals, recommended changes, any structured refactor items, and any specified quality checks or validation commands.

3. **Apply all recommended code changes** — implement each refactor item in the codebase. Follow project conventions and the existing architecture. Do not leave any planned change partially applied.

4. **Run the quality checks defined in the refactor plan** — for each quality check or command listed in the plan, run it and fix any issues until the checks pass. At minimum, ensure the project's typecheck (`bun run typecheck`) and test suite (`bun test` when appropriate) succeed before finishing.

5. **Perform the full refactor autonomously** — do not stop mid-way to ask the user what to do next or whether to continue. Use the refactor plan and the existing codebase as your source of truth, carry out the entire refactor in this single session, and only use interaction (if any) to report progress and final status.

## Context

You will receive:

- `iteration`: current iteration (e.g. `000026`).
- `audit_json_path`: absolute path to `it_{iteration}_audit.json` in `.agents/flow/`. Read this file to get the refactor plan and quality checks.

Use the audit JSON as the single source of truth for what to refactor; then apply all changes and verify with the project's quality checks in this single run.
