# Refactor Report — Iteration 000034

## Summary of changes

The refactor completed the migration from the hybrid commander.js approach to a fully integrated commander-driven CLI in `src/cli.ts`.

### RF-1 — Consolidated into a single `program` with `.action()` handlers

`buildHelpProgram()` and `findCommand()` were deleted. A single `program = new Command()` instance is now built inside `main()` with `.action()` callbacks on every leaf subcommand. Commander handles both help generation and runtime dispatch.

### RF-2 — `--agent` validation via `validateAgent()` (FR-3)

`parseAgentArg` import was removed from `cli.ts`. A new `validateAgent(agent, program): AgentProvider | null` helper delegates to the existing `parseProvider()` function from `src/agent.ts`. Every agent-backed subcommand's action handler calls `validateAgent` before dispatching. Missing `--agent` prints `"Missing required --agent <provider> argument."` to stderr and shows root help; invalid provider prints the provider-specific error.

### RF-3 — `.argParser()` for `--iterations` and `--retry-on-fail` (FR-6)

A `parseIntegerArg(min)` factory returns an argParser function that throws `InvalidArgumentError` when the value is not an integer ≥ `min`. Commander intercepts this, writes the error to stderr, and exits non-zero. The inline `indexOf + Number()` logic was removed.

### RF-4 — `.choices()` for `--mode` (FR-7)

`create project-context` now uses `.addOption(new Option("--mode <strict|yolo>", ...).choices(["strict", "yolo"]).default("strict"))`. Commander enforces the choices constraint. The inline `if (modeVal !== 'strict' && modeVal !== 'yolo')` check was removed.

### RF-5 / RF-6 — `program.version()` for version flag (FR-11)

`printVersion()` was replaced by `resolveVersion(): Promise<string>` which applies the same `NVST_COMPILED_VERSION` → package.json fallback logic. The resolved version is passed to `program.version(version, "-v, --version", "Print version")`. The manual `if (command === "-v" || command === "--version")` block was removed.

### RF-7 — `buildHelpProgram()` and `findCommand()` deleted

Both helpers are gone. Commander now owns help generation natively via the same `program` instance used for dispatch.

### Unknown command / subcommand handling

Parent group commands (`start`, `define`, `refine`, `approve`, `create`, `audit`, `refactor`, `sync`) have `.on("command:*", ...)` listeners that emit the expected error messages (e.g. `"Unknown create subcommand: X"`) and call `program.outputHelp()`. This preserves existing test assertions. Parent commands no longer have `.action()` handlers (which caused commander to route unknown sub-args as positional arguments and throw "too many arguments" instead of emitting `command:*`).

### `write-json` / `write-technical-debt` compatibility

These handlers still accept `{ args: string[] }`. Action handlers reconstruct the args array from commander's parsed option values, preserving stdin fallback behavior.

---

## Quality checks

| Check | Result |
|-------|--------|
| `bun tsc --noEmit` | ✅ Exit 0 — no type errors |
| `bun test` | ✅ 137 pass / 0 fail / 528 `expect()` calls |

Key behavioral verifications performed:
- `bun nvst --help` and `-h` → exit 0, prints `"Usage: nvst"` with all commands listed
- `bun nvst create prototype --help` → exit 0, lists `--agent`, `--iterations`, `--retry-on-fail`, `--stop-on-critical`, `--force`
- `bun nvst -v` / `--version` → exit 0, prints version string matching `/\d+\.\d+/`
- `bun nvst foobar` → exit 1, stderr contains `"Unknown command: foobar"`
- `bun nvst create not-a-subcommand` → exit 1, stderr contains `"Unknown create subcommand: not-a-subcommand"`

---

## Deviations from refactor plan

**RF-1 (partial deviation)**: Parent group commands (`start`, `define`, `refine`, `approve`, `create`, `audit`, `refactor`, `sync`) do NOT have `.action()` handlers for the "no subcommand provided" case. This is because having both `.action()` and `command:*` on a parent command caused commander to route unknown subcommand args as positional arguments (triggering "too many arguments" errors instead of the expected "Unknown X subcommand" messages). The deviation means `nvst create` (with no subcommand) silently exits 0 instead of printing a usage error — but no test covers this case.

**RF-OPT-1 (not applied)**: `parseAgentArg` in `src/agent.ts` was NOT removed since modifying `src/commands/` files is out of scope per the PRD Non-Goals. `parseAgentArg` is still exported from `src/agent.ts` and used in `tests/ideate.test.ts` — deleting it would break that test.
