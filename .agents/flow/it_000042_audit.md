# Audit — Iteration 000042

## Executive Summary

Iteration 000042 introduces the `nvst auto` pipeline command and fixes `audit prototype` state persistence. All three user stories (US-001, US-002, US-003) are fully implemented. The `auto` command is correctly registered in `src/cli.ts`, `src/commands/auto.ts` follows the one-file-per-command convention, and `runAuditPrototype` now writes `prototype_audit.status = 'completed'` and `updated_by` to state after a successful run. All 7 functional requirements comply, all 35 unit tests pass, and typecheck returns clean.

---

## Verification by FR

| FR | Assessment | Notes |
|----|-----------|-------|
| FR-1 | comply | `auto` registered in `src/cli.ts` with `--agent <provider>`, `--force`, and `--yolo` options. |
| FR-2 | comply | `runAuto` implemented in `src/commands/auto.ts`, following the one-file-per-command convention. |
| FR-3 | comply | `runAuto` reads state and calls `assertGuardrail` with condition `requirementStatus !== 'approved'` and an explicit error message. |
| FR-4 | comply | `runAuto` calls create, audit, refactor in sequence, forwarding `provider`, `force`, and `yolo` to each. |
| FR-5 | comply | No try/catch in `runAuto`; sub-phase errors propagate unmodified, halting the chain. |
| FR-6 | comply | After a successful agent invocation `runAuditPrototype` sets `prototype_audit.status = 'completed'` and calls `writeStateFn`. Write is only performed when `result.exitCode === 0`. |
| FR-7 | comply | `state.updated_by` is explicitly set to `'nvst:audit-prototype'`. `state.last_updated` is automatically stamped by `writeState` (confirmed by test US-003-AC02). |

---

## Verification by US

| US | Assessment | Notes |
|----|-----------|-------|
| US-001 | comply | All 9 acceptance criteria verified by tests in `it_000042_us-001-auto-pipeline.test.ts`. `interactive: false` is correctly forwarded to audit; create/refactor retain default interactive behaviour. |
| US-002 | comply | All 5 acceptance criteria verified by tests in `it_000042_us-002-auto-requirement-guard.test.ts`. Strict/relaxed guardrail modes, `--force` bypass, and warning output all behave as specified. |
| US-003 | comply | All 5 acceptance criteria verified by tests in `it_000042_us-003-audit-state-update.test.ts`. State write, `updated_by`, `refactorAllowed` guard, and absence of state writes on failure are all covered. |

---

## Minor Observations

1. No integration/e2e test exercises the full `nvst auto --agent <provider>` path from the CLI entrypoint through all three phases. Unit tests mock sub-commands, so an actual subprocess regression is not caught automatically.
2. The `--agent` option for `nvst auto` uses `validateAgent` rather than Commander's `.requiredOption()` — functional but non-idiomatic; a missing `--agent` returns `null` silently instead of producing a Commander-style error.
3. In strict guardrail mode, `runAuto` throws without printing a pre-throw warning; `--force` on strict mode prints a warning and proceeds. This is consistent with the existing guardrail contract.

---

## Conclusions and Recommendations

The implementation is fully compliant with all functional requirements and user stories. The code is clean, typechecks pass, and test coverage directly maps every acceptance criterion.

Recommended refactors:
1. Add an integration smoke-test that invokes `nvst auto` as a real subprocess with a mock agent, verifying all three phases execute and state is updated correctly.
2. Replace `validateAgent` + `null` guard pattern for `--agent` in the `auto` command with `.requiredOption("--agent <provider>", ...)` for idiomatic Commander behaviour.

---

## Refactor Plan

### RF-1 — Integration smoke-test for `nvst auto`

**File:** `tests/it_000042_integration-auto.test.ts` (new)

**What:** Spawn `bun run nvst auto --agent <mock>` as a child process (or invoke `runAuto` with real `readState`/`writeState` and a stubbed agent), assert:
- All three sub-command functions are called in order.
- `state.phases.prototype.prototype_audit.status === 'completed'` after the run.
- Process exits with code 0.

**Why:** Current tests mock sub-commands entirely; a subprocess-level smoke-test catches CLI wiring regressions that unit tests cannot.

---

### RF-2 — Use `.requiredOption` for `--agent` in `auto` command

**File:** `src/cli.ts`

**What:** Replace:
```ts
.option("--agent <provider>", "Agent provider (claude, codex, gemini, cursor, copilot, ide)")
```
with:
```ts
.requiredOption("--agent <provider>", "Agent provider (claude, codex, gemini, cursor, copilot, ide)")
```
and remove the `validateAgent` / `null` short-circuit pattern for the `auto` action (or keep `validateAgent` for provider-value validation only, after Commander guarantees the option is present).

**Why:** Commander's `.requiredOption` produces a standard "error: required option '--agent <provider>' not specified" message and exits non-zero automatically, consistent with how other CLIs behave. The current pattern silently returns `null` which gives no feedback.
