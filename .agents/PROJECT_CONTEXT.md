# Project Context

<!-- Created or updated by `bun nvst create project-context`. Cap: 250 lines. -->

## Conventions
- Naming: files use `kebab-case.ts`; exported command handlers use `camelCase` with `run` prefix (e.g. `runCreateProjectContext`); other exported helpers use standard `camelCase`; types/interfaces use `PascalCase`; Zod schemas use `PascalCaseSchema` (e.g. `StateSchema`); constants use `UPPER_SNAKE_CASE`
- Formatting: no enforced formatter (no Prettier/ESLint config); rely on TypeScript strict mode for correctness
- Git flow: trunk-based on `main`; conventional commit prefixes (`feat:`, `fix:`, `refactor:`); iteration work commonly happens on `feature/it_XXXXXX` branches
- Workflow: NVST manages iterations via `state.json`; all commands validate state before acting and persist transitions back

## Tech Stack
- Language: TypeScript (strict mode, ESNext target)
- Runtime: Bun (v1+)
- Frameworks: none — pure CLI application
- Key libraries: `zod` (^3.23.8) for runtime schema validation; `typescript` (^5.6.3) for type checking only
- Package manager: Bun (`bun.lock`)
- Build / tooling: no build step; Bun runs `.ts` files directly; `tsconfig.json` used for type checking only (`outDir: "dist"` unused)

## Code Standards
- Style patterns: one file per CLI command in `src/commands/`; pure orchestration in `src/agent.ts`; pure state I/O in `src/state.ts`; argv parsing and routing in `src/cli.ts`
- Error handling: commands throw `Error` with descriptive messages; `cli.ts` wraps in `try/catch` and sets `process.exitCode = 1` (never `process.exit()`); `schema.safeParse()` for validation (not `.parse()`)
- Module organisation: `src/` for toolkit code; `scaffold/schemas/` for Zod schemas used by `state.ts` and `write-json`; `schemas/` for validation scripts/copies; `scaffold/` for project templates; `.agents/` for runtime agent state/skills/flow
- Forbidden patterns: no `process.exit()` calls (use `process.exitCode`); no synchronous I/O; no third-party CLI frameworks (keep deps minimal)

## Testing Strategy
- Approach: initial unit tests for core modules; schema validation scripts and manual CLI verification for the rest
- Runner: `bun:test` (Bun built-in)
- Coverage targets: none defined yet
- Test location convention: co-located `src/**/*.test.ts` for most unit/command tests; `tests/**/*.test.ts` for workflow/integration tests; `schemas/**/*.test.ts` for schema tests

## Product Architecture
- NVST is a CLI toolkit (`bun nvst <command>`) that orchestrates an iterative development workflow through three phases: Define → Prototype → Refactor
- Commands delegate content generation to AI agents (Claude, Codex, Gemini) via `src/agent.ts` which loads skill prompts from `.agents/skills/<name>/SKILL.md`
- Workflow state is tracked in `.agents/state.json` (validated by Zod schema); workflow-transition commands read/validate/update state, while utility commands (`init`, `destroy`, `write-json`) and `refine requirement` do not persist state
- JSON file generation must be performed through `nvst write-json`; direct ad hoc JSON file creation is out of scope for the workflow
- Iteration artifacts (PRDs, progress files, changelogs) live in `.agents/flow/` with `it_XXXXXX_` prefixes

## Modular Structure
- `src/cli.ts`: CLI router — parses argv and dispatches to command handlers
- `src/agent.ts`: agent invocation — provider config, skill loading, prompt building, subprocess spawning
- `src/state.ts`: state I/O — read/write/validate `.agents/state.json`
- `src/commands/*.ts`: one handler per command (`create-project-context`, `approve-requirement`, etc.)
- `scaffold/schemas/`: Zod schemas used by `state.ts` and `write-json` for runtime validation
- `schemas/`: validation scripts/copies of scaffold schemas
- `scaffold/`: project templates copied by `nvst init`
- `.agents/skills/`: agent skill prompts (SKILL.md per skill)
- `.agents/flow/`: iteration artifacts (PRDs, progress, changelogs)

## Constraints
- CLI-only: must remain a pure CLI tool, no web UI
- Minimal dependencies: avoid adding third-party packages unless strictly necessary
- Bun-native: use `Bun.spawn` for direct process spawning and `Bun.$` (shell tagged template) for shell pipelines; `Bun.write`/`Bun.file` for file copying; `node:fs/promises` and `node:path` are the primary file I/O layer

## Implemented Capabilities
<!-- Updated at the end of each iteration by bun nvst create project-context -->
- `nvst init` / `nvst destroy`: scaffold and tear down project structure
- `nvst start iteration`: begin a new iteration cycle
- `nvst create project-context` / `refine project-context` / `approve project-context`: full project context definition and refinement flow
- `nvst define requirement` / `refine requirement` / `approve requirement`: full requirement definition flow with interactive refinement and challenge mode
- `nvst create test-plan` / `refine test-plan` / `approve test-plan`: test plan definition and approval flow
- `nvst define refactor-plan` / `refine refactor-plan` / `approve refactor-plan`: refactor plan definition and approval flow
- `nvst create prototype`: iterative agent-driven implementation of user stories with progress tracking, quality checks, and git automation
- `nvst create issue`: issue creation flow (including `--test-execution-report`)
- `nvst execute test-plan`: execute approved structured test plan JSON via agent
- `nvst execute automated-fix` / `nvst execute manual-fix`: issue-driven fixing flows
- `nvst execute refactor`: execute approved refactor items via agent
- `nvst write-json`: schema-validated JSON generation from agent output
- Agent invocation system: multi-provider support (Claude, Codex, Gemini, Cursor CLI) with skill-based prompt loading
- State management: Zod-validated `state.json` with phase/status tracking
