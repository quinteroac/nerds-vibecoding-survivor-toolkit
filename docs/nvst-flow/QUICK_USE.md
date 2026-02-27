# NVST Quick Use

Quick reference for common workflows. See [COMMANDS.md](COMMANDS.md) for full command reference.

## First-time setup

```bash
# Install the toolkit (from local path or npm)
bun add /path/to/nerds-vibecoding-survivor-toolkit

# Initialize scaffold in your project
nvst init

# Start the first iteration
nvst start iteration
```

## Typical iteration flow

### 1. Define

```bash
nvst define requirement --agent codex
# Review, then optionally:
nvst refine requirement --agent codex --challenge
nvst approve requirement
# PRD JSON is created when needed (e.g. via create prototype)
```

### 2. Prototype

```bash
nvst create project-context --agent codex --mode yolo
nvst approve project-context

nvst create prototype --agent codex --iterations 10

nvst define test-plan --agent codex
nvst refine test-plan --agent codex   # optional
nvst approve test-plan

nvst execute test-plan --agent codex

# If tests fail:
nvst execute automated-fix --agent codex
# or for manual debugging:
nvst execute manual-fix --agent codex

# When all pass:
nvst approve prototype
```

### 3. Refactor

```bash
nvst define refactor-plan --agent codex
nvst refine refactor-plan --agent codex   # optional
nvst approve refactor-plan

nvst execute refactor --agent codex

# Run all tests, update PROJECT_CONTEXT.md, record CHANGELOG.md
# Then start next iteration:
nvst start iteration
```

## Flow command (semi-automated)

`nvst flow` runs the next pending step(s) until it hits an approval gate:

```bash
nvst flow --agent codex
```

Use `--force` to bypass guardrail confirmations.

## Agent providers

Use `--agent` with: `claude`, `codex`, `gemini`, or `cursor`.

Example:

```bash
nvst define requirement --agent cursor
```
