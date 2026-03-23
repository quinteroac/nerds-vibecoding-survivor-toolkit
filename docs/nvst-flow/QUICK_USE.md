# NVST Quick Use

Quick reference for the main development loop. See [COMMANDS.md](COMMANDS.md) for full command reference.

**Running commands:** Use `bun nvst` so Bun resolves the binary. Or add `node_modules/.bin` to your PATH: `export PATH="$PATH:$(pwd)/node_modules/.bin"` to run `nvst` directly.

## First-time setup

```bash
# Install the toolkit from npm (package is published)
npm install @quinteroac/agents-coding-toolkit
# or with Bun
bun add @quinteroac/agents-coding-toolkit

# From local path (development)
# bun add /path/to/nerds-vibecoding-survivor-toolkit

# Initialize scaffold in your project
bun nvst init
```

## Typical iteration flow (end-to-end)

```bash
bun nvst define requirement --agent codex
bun nvst refine requirement --agent codex --challenge   # optional
bun nvst approve requirement
bun nvst create prototype --agent codex --iterations 10
bun nvst audit prototype --agent codex
bun nvst refactor prototype --agent codex
bun nvst approve prototype
```

Use this command order as the standard loop:

`Define/Refine/Approve Requirement → Create Prototype → Audit Prototype → Refactor Prototype → Approve Prototype`

## Agent providers

Use `--agent` with: `claude`, `codex`, `gemini`, `cursor`, `copilot`, or `ide`.

Example:

```bash
bun nvst define requirement --agent cursor
```

## Standalone Skill Invocation

Every NVST workflow skill can be invoked directly from any AI agent CLI that loads skills via `npx skills add` — without installing or running the `nvst` binary and without an active NVST iteration.

**Available standalone skills:** `/define-requirement`, `/refine-requirement`, `/create-prototype`, `/audit-prototype`, `/refactor-prototype`, `/approve-prototype`

**How to add NVST skills to your agent CLI:**

```bash
npx skills add nerds-vibecoding-survivor-toolkit
```

**How standalone fallback works:**

When a skill is invoked without NVST orchestrating the session, it self-detects the absence of `.agents/state.json` and resolves required context in this order:

1. Injected context variable (set by NVST when orchestrating)
2. `.agents/state.json` — read `current_iteration` if the file exists
3. Artifact files — look for `.agents/flow/it_{iteration}_PRD.json` or the matching `.md` file
4. Ask the user — prompt interactively for any information that could not be resolved automatically

Skills that normally write to `state.json` skip that step when running standalone, and notify the user that state was not persisted. This means standalone invocation is safe and non-destructive — it will never create or corrupt a `state.json`.
