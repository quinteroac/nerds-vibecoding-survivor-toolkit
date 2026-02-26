# Requirement: Execute Refactor Command

## Context

The NVST workflow's refactor phase currently stops at plan approval (`nvst approve refactor-plan`). There is no command to drive the actual application of approved refactor items. The `state.json` schema already reserves `refactor_execution` (`pending → in_progress → completed`), but no command populates it. This feature closes that gap by adding `nvst execute refactor --agent <provider>`, which iterates through each `RI-NNN` item from the approved `refactor-prd.json` and invokes the agent once per item to apply the code changes — mirroring how `create prototype` works for user stories.

## Goals

- Provide a single command that drives refactor execution end-to-end in the refactor phase.
- Process each refactor item sequentially with one agent invocation per item.
- Track per-item progress in a persistent file so interrupted runs resume from where they left off.
- Produce a human-readable markdown report when all items are processed.
- Transition `refactor_execution.status` → `completed` upon full success.

## User Stories

### US-001: Execute approved refactor items via agent

**As a** developer, **I want** to run `nvst execute refactor --agent <provider>` **so that** each approved refactor item (`RI-NNN`) is applied to the codebase by the agent in order.

**Acceptance Criteria:**
- [ ] Command is invoked as `bun nvst execute refactor --agent <provider>` (where `<provider>` is `claude`, `codex`, `gemini`, or `cursor`).
- [ ] Command rejects with a clear error if `current_phase !== "refactor"`.
- [ ] Command rejects with a clear error if `refactor_plan.status !== "approved"`.
- [ ] Command rejects with a clear error if `refactor_execution.status` is already `"completed"`.
- [ ] Reads and validates `it_{iteration}_refactor-prd.json` using `RefactorPrdSchema`; rejects with a clear error if file is missing or schema mismatch.
- [ ] Sets `refactor_execution.status = "in_progress"` in state before processing begins.
- [ ] For each `RI-NNN` item in order, invokes the agent once with a prompt built from the `execute-refactor-item` skill and the item's `id`, `title`, `description`, and `rationale`.
- [ ] Agent is invoked in interactive mode (same as `create prototype` per user story).
- [ ] After each agent invocation, the item's result (`completed` or `failed`) is recorded to the progress file before moving to the next item.
- [ ] A non-zero agent exit code marks the item as `failed` in the progress file; execution continues to the next item.
- [ ] If all items complete successfully, `refactor_execution.status = "completed"` is written to state.
- [ ] If any item failed, `refactor_execution.status` remains `"in_progress"` (allowing the user to retry or investigate).
- [ ] `refactor_execution.file` is set to the progress file name (e.g. `it_{iteration}_refactor-execution-progress.json`).
- [ ] Typecheck / lint passes.

### US-002: Resume interrupted execution

**As a** developer, **I want** a partially completed `execute refactor` run to resume from the first non-completed item **so that** I do not have to re-process items that already succeeded.

**Acceptance Criteria:**
- [ ] If `it_{iteration}_refactor-execution-progress.json` already exists and `refactor_execution.status === "in_progress"`, the command loads the existing progress file.
- [ ] Progress file is validated against its schema on load; rejects with a clear error if schema mismatch.
- [ ] Items whose progress entry is already `"completed"` are skipped (not re-invoked).
- [ ] Items whose progress entry is `"pending"` or `"failed"` are re-attempted.
- [ ] Command correctly rejects if existing progress item IDs do not match the IDs in the current `refactor-prd.json` (same guard as `execute-test-plan`).
- [ ] Typecheck / lint passes.

### US-003: Generate a markdown execution report

**As a** developer, **I want** a markdown report produced after all items are processed **so that** I can see which refactor items succeeded or failed at a glance.

**Acceptance Criteria:**
- [ ] After all items are processed, `it_{iteration}_refactor-execution-report.md` is written to `.agents/flow/`.
- [ ] Report includes: iteration number, total items, count completed, count failed, and a table with columns `RI ID | Title | Status | Agent Exit Code`.
- [ ] Report is written regardless of whether items failed.
- [ ] Typecheck / lint passes.

### US-004: Add `execute-refactor-item` agent skill

**As a** developer, **I want** a skill prompt at `.agents/skills/execute-refactor-item/SKILL.md` **so that** the agent has structured instructions for applying a single refactor item.

**Acceptance Criteria:**
- [ ] File `.agents/skills/execute-refactor-item/SKILL.md` exists.
- [ ] Skill includes front-matter fields: `name: execute-refactor-item`, `description`, `user-invocable: false`.
- [ ] Skill instructs the agent to: read the refactor item's `id`, `title`, `description`, and `rationale`; locate and apply the necessary code changes; verify the change compiles/type-checks; and confirm completion.
- [ ] Skill references `.agents/PROJECT_CONTEXT.md` as the source of conventions to follow.
- [ ] Typecheck / lint passes (skill is a Markdown file, not compiled).

### US-005: Register command in CLI router and help text

**As a** developer, **I want** `nvst execute refactor --agent <provider>` routed correctly in `src/cli.ts` **so that** the command is discoverable via `--help`.

**Acceptance Criteria:**
- [ ] `src/cli.ts` routes `execute refactor` to the new `runExecuteRefactor` handler.
- [ ] `printUsage()` includes `execute refactor --agent <provider>` with a one-line description.
- [ ] Unknown options after `--agent <provider>` cause a clear error and exit code 1 (consistent with other `execute` subcommands).
- [ ] Typecheck / lint passes.

## Functional Requirements

- **FR-1:** Command signature: `nvst execute refactor --agent <provider>` — no other flags required for MVP.
- **FR-2:** Precondition guards (in order): `current_phase === "refactor"`, `refactor_plan.status === "approved"`, `refactor_execution.status !== "completed"`.
- **FR-3:** Read and `RefactorPrdSchema.safeParse()` the approved `it_{iteration}_refactor-prd.json`; error on missing file or schema failure.
- **FR-4:** Progress file schema: `{ entries: Array<{ id: string; title: string; status: "pending" | "in_progress" | "completed" | "failed"; attempt_count: number; last_agent_exit_code: number | null; updated_at: string }> }`.
- **FR-5:** Progress file path: `.agents/flow/it_{iteration}_refactor-execution-progress.json`.
- **FR-6:** Agent invocation: interactive mode (`interactive: true`), skill `execute-refactor-item`, prompt built via `buildPrompt()` with variables `current_iteration`, `item_id`, `item_title`, `item_description`, `item_rationale`.
- **FR-7:** Per-item result recording: update progress entry via `nvst write-json` before proceeding to next item (crash-safe, schema-validated).
- **FR-8:** Report file path: `.agents/flow/it_{iteration}_refactor-execution-report.md`.
- **FR-9:** State update: `refactor_execution.status = "completed"` only if all items are `"completed"`; if any item is `"failed"`, status stays `"in_progress"`. `refactor_execution.file = "it_{iteration}_refactor-execution-progress.json"`, `last_updated`, `updated_by = "nvst:execute-refactor"` are always written after the run.
- **FR-10:** New source file: `src/commands/execute-refactor.ts` exporting `runExecuteRefactor`.
- **FR-11:** New skill file: `.agents/skills/execute-refactor-item/SKILL.md`.
- **FR-12:** `src/cli.ts` updated to import and route `runExecuteRefactor`.

## Non-Goals (Out of Scope)

- `--iterations` or `--retry-on-fail` flags — not needed for MVP; items are attempted once.
- Automatic changelog generation — the `changelog` state field exists but is a separate future concern.
- Parallel execution of refactor items — sequential only.
- Interactive confirmation between items — agent runs non-interruptibly per item.
- Any changes to the `define-refactor-plan`, `approve-refactor-plan`, or `refine-refactor-plan` commands.

## Open Questions

None — all questions resolved.
