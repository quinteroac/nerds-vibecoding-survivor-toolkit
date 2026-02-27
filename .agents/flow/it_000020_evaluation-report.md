# Evaluation Report — Iteration 000020

## Strengths
- The new `execute-automated-fix` behavior correctly processes all open issues by default when `--iterations` is omitted, while preserving the existing `--iterations N` contract; this is well-covered by targeted unit tests that assert both paths and the terminal summary output.
- `execute-automated-fix` uses a clear dependency-injection pattern (`ExecuteAutomatedFixDeps`) with injectable logging, time source, filesystem, skill loading, agent invocation, and git commit wiring, which makes the command highly testable and keeps side effects isolated.
- Issue parsing in `execute-automated-fix` is robust: it performs defensive validation of the issues JSON, logs detailed warnings for malformed entries, enforces allowed statuses, skips duplicates deterministically, and fails fast with deterministic error messages for missing or invalid JSON.
- The implementation of retries and network error handling in `execute-automated-fix` is explicit and predictable: network-related failures are detected via message inspection, do not consume generic retries, and correctly transition issues to `manual-fix` with corresponding git commits and summary logging.
- The `execute-refactor` command follows the documented architecture closely: it validates state and PRD prerequisites with `assertGuardrail`, uses Zod schemas for both the refactor PRD and execution progress, and keeps JSON I/O behind `nvst write-json`, aligning with the workflow and schema-based validation strategy.
- `execute-refactor` processes refactor items sequentially with resumable progress semantics (pending/failed items are retried, completed items are skipped), providing clear logging per item (`iteration=... item=... outcome=...`) and robust handling of mismatched or corrupted progress files.
- `execute-refactor` invokes the agent in non-interactive mode (`interactive: false`), consistent with how `create-prototype` runs automated work, and this behavior is explicitly verified by unit tests.
- The shared `agent` module encapsulates provider-specific CLI details and prompt construction, exposing a small, coherent API (`invokeAgent`, `loadSkill`, `buildPrompt`, `parseAgentArg`), which centralizes integration with external AI CLIs and keeps command modules focused on workflow logic.
- The `create-prototype` command demonstrates a solid pattern for progress tracking across user stories (status, attempt counts, quality checks, error summaries, timestamps) and integrates project-context–driven quality checks, providing a good reference for other execution-style commands.
- Overall, the prototype code for this iteration maintains TypeScript strictness, avoids synchronous I/O and `process.exit`, keeps commands in `src/commands/`, and uses Bun-native primitives (`Bun.spawn`, `Bun.$`) as required by the project context.

## Technical Debt
- **Mixed approaches to JSON artifact management**  
  Impact: Medium — increases cognitive load and risk of divergence between artifacts.  
  Effort: Medium — requires introducing or adopting a shared helper layer and updating a few commands.  
  Notes: `execute-refactor` uses `nvst write-json` for the progress file, while `create-prototype`, `execute-test-plan`, and `execute-automated-fix` write JSON artifacts directly via `writeFile`/`Bun.write` with ad hoc Zod schemas or manual validation.

- **Inconsistent use of schema-based validation for iteration artifacts**  
  Impact: Medium — inconsistent validation patterns make it easier for one command to drift from the canonical schema and harder to reason about guarantees.  
  Effort: Medium — Zod schemas already exist in `scaffold/schemas/`, but some commands still rely on inline schemas or structural checks.  
  Notes: `execute-refactor` and `execute-test-plan` lean on shared scaffold schemas, whereas `create-prototype` defines `PrototypeProgressSchema` inline and `execute-automated-fix` parses `it_{iteration}_ISSUES.json` with manual checks rather than a shared runtime schema.

- **Reused utility patterns duplicated across commands**  
  Impact: Low to Medium — duplication is small but spread across multiple critical commands.  
  Effort: Low — could be addressed by extracting 1–2 small helpers.  
  Notes: Helpers for sorted ID comparison (`sortedValues` + `idsMatchExactly`) and timestamped progress entry updates appear in `create-prototype`, `execute-test-plan`, and `execute-refactor` with very similar shapes, which slightly increases surface area for subtle divergence.

- **Partial divergence from the “JSON via write-json” architectural intent**  
  Impact: Medium — makes it less obvious which JSON artifacts are guaranteed to match a schema enforced at write time.  
  Effort: Medium — aligning all long-lived artifacts behind `write-json` would involve refactors to command code and, potentially, tests.  
  Notes: The project context states that JSON file generation should go through `nvst write-json`, but some long-lived artifacts (prototype progress, issues files, certain test-execution outputs) are still written directly instead of via the `write-json` CLI plus scaffold schemas.

- **Limited guardrail usage for issue execution flows**  
  Impact: Low in the current iteration (behavior is correct per PRD) but Medium long-term for consistency with the rest of the flow.  
  Effort: Medium — would require designing and implementing appropriate guardrails and potentially adjusting specs.  
  Notes: `execute-test-plan` and `execute-refactor` enforce phase and prerequisite invariants via `assertGuardrail`, whereas `execute-automated-fix` only checks for the presence of the issues file; this is acceptable per the current PRD but creates a different mental model for “execute” commands.

## Violations of PROJECT_CONTEXT.md
- **Not all JSON artifacts are generated via `nvst write-json`**  
  The project context specifies that JSON file generation should be performed through `nvst write-json`, but several commands (e.g. `create-prototype`, `execute-test-plan`, `execute-automated-fix`) still write JSON artifacts directly via filesystem APIs, rather than delegating to the `write-json` command and shared scaffold schemas.

- **Inconsistent centralization of schema definitions**  
  While the architecture calls for schemas to live in `scaffold/schemas/` and `schemas/`, some validation logic (such as the prototype progress schema and parts of test execution progress handling) is implemented inline in command files, instead of consistently using or mirroring the scaffold schemas, which weakens the intended centralization.

## Recommendations
- **R-001: Standardize JSON artifact writing behind `nvst write-json` or a single shared helper**  
  Impact: High — improves confidence that all long-lived iteration artifacts conform to schemas and reduces drift between commands.  
  Urgency: Medium — not blocking current iteration behavior but important for maintainability as more commands are added.  
  Effort: Medium — refactor `create-prototype`, `execute-test-plan`, and `execute-automated-fix` to use either the `write-json` CLI or a thin shared helper that internally calls `write-json` with the appropriate scaffold schemas.  
  Scope: Affects execution-style commands and any code that writes iteration-scoped JSON files in `.agents/flow/`.

- **R-002: Align iteration artifact validation on shared scaffold schemas**  
  Impact: Medium — simplifies reasoning about invariants and ensures that tools like `validate-progress` and `validate-state` see the same shapes as the commands themselves.  
  Urgency: Medium — alignment is beneficial before introducing further workflow variants.  
  Effort: Medium — extract or add Zod schemas for prototype progress and issues where missing, and update commands to validate via those shared schemas instead of ad hoc checks.  
  Scope: `create-prototype`, `execute-automated-fix`, and any future commands that read or write `*_ISSUES.json` or progress-like artifacts.

- **R-003: Extract shared utilities for ID matching and progress entry updates**  
  Impact: Medium — reduces duplication in core flow logic and makes it easier to update behavior (e.g. sorting, matching rules, timestamping) in one place.  
  Urgency: Low — current duplication is manageable but will grow as more commands adopt similar patterns.  
  Effort: Low — introduce a small utility module (e.g. `progress-utils`) to host common helpers like `sortedValues`, `idsMatchExactly`, and a helper for marking entries `in_progress`/`completed` with consistent timestamp updates.  
  Scope: `create-prototype`, `execute-test-plan`, `execute-refactor`, and any future execution flows.

- **R-004: Document and, if desired, converge guardrail expectations for execute-style commands**  
  Impact: Medium — clarifies when commands like `execute-automated-fix` should participate in the phase/guardrail machinery versus acting as more ad hoc utilities.  
  Urgency: Low — the current behavior matches the iteration PRD and existing tests; this is more about future consistency than fixing a bug.  
  Effort: Medium — requires a short design decision (product + architecture) and possible future refactors to add or adjust guardrails and tests.  
  Scope: `execute-automated-fix` primarily, with knock-on effects for documentation and potentially other `execute` commands.

- **R-005: Tighten alignment between iteration artifacts and reporting markdown**  
  Impact: Medium — improves traceability from JSON artifacts to human-readable reports and makes it easier to reason about workflow status across commands.  
  Urgency: Low to Medium — nice-to-have now, more important as the number of iterations grows.  
  Effort: Low to Medium — review how `execute-refactor` builds its markdown execution report from `RefactorExecutionProgress` and consider mirroring that pattern (or centralizing report builders) for test execution and prototype progress, without changing file names or external interfaces.  
  Scope: Reporting logic in `execute-refactor`, `execute-test-plan`, and any future refactor/prototype reporting commands.

