### TD-001: Replace parse with safeParse in state loader

- **Source:** Challenge mode — iteration 000001
- **Date:** 2026-02-20T14:30:19-06:00
- **Section:** Code Standards
- **Description:** `readState` uses `StateSchema.parse(...)` directly instead of the documented `safeParse` validation flow.
- **Evidence:** `src/state.ts` calls `StateSchema.parse(JSON.parse(raw))`.
- **Suggested resolution:** Update `readState` to use `safeParse`, handle invalid state with a controlled error path, and align behavior with documented validation standards.

### TD-002: Remove process.exit from validation scripts

- **Source:** Challenge mode — iteration 000001
- **Date:** 2026-02-20T14:30:19-06:00
- **Section:** Code Standards
- **Description:** Validation scripts call `process.exit(1)` while project conventions disallow direct exit calls.
- **Evidence:** `schemas/validate-state.ts`, `schemas/validate-progress.ts`, `scaffold/schemas/tmpl_validate-state.ts`, and `scaffold/schemas/tmpl_validate-progress.ts` use `process.exit(1)`.
- **Suggested resolution:** Replace direct `process.exit(1)` usage with `process.exitCode = 1` and allow normal process termination.

### TD-003: Broaden tsconfig.json include to cover src/

- **Source:** Challenge mode — iteration 000001
- **Date:** 2026-02-20
- **Section:** Tech Stack
- **Description:** `tsconfig.json` only includes `scaffold/schemas/**/*.ts`, so `tsc` type checking does not cover the main `src/` source code. The documented convention states `tsconfig.json` is "used for type checking only", implying project-wide coverage.
- **Evidence:** `tsconfig.json` has `"include": ["scaffold/schemas/**/*.ts"]` — no `src/` entry.
- **Suggested resolution:** Add `"src/**/*.ts"` to the `include` array in `tsconfig.json` so that `tsc` covers the CLI source code.

### TD-004: Replace synchronous I/O in validation scripts

- **Source:** Challenge mode — iteration 000001
- **Date:** 2026-02-20T21:05:00Z
- **Section:** Code Standards
- **Description:** Validation scripts use synchronous I/O (`readFileSync`), which violates the project's "no synchronous I/O" code standard.
- **Evidence:** `schemas/validate-state.ts`, `schemas/validate-progress.ts`, and their scaffold counterparts (`scaffold/schemas/tmpl_validate-state.ts`, `scaffold/schemas/tmpl_validate-progress.ts`).
- **Suggested resolution:** Refactor validation scripts to use asynchronous `readFile` or `Bun.file().json()`.
