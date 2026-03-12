# Nerds Vibecoding Survivor Toolkit

> 🚧 **Work in Progress**: This toolkit is currently under active development.

## Purpose

This repository contains nerds-vst (Nerd's Vibecoding Survivor Toolkit).

nerds-vst is a framework and command-line tool built on Bun, designed to help you create and develop projects from scratch using a specification-driven development pattern powered by AI coding—a process informally known as vibecoding. This repository is the toolkit implementation; usage and workflow documentation will be published with the package.

The framework is built on the following principles:

- Single source of truth — State is centralized, minimizing the risk of AI hallucination and reducing ambiguity.
- Context is everything — Leveraging diverse project context and specialized skills helps both AI and humans to better understand and reason about the project.
- Human in the loop — Mandatory review and decision points ensure that humans define and validate key steps in every iteration.
- Build fast / Fail fast — Developers can grant AI a controlled degree of autonomy to enable rapid prototyping, embodying the agile principle of building quickly and embracing early failure.
- Iterative development — Strongly encourages building software incrementally, block by block, allowing time to refactor and address technical debt during each iteration instead of all at once.
- Agnostic agent support — Whether you prefer Claude, Codex, Gemini, or another CLI-based agent, the toolkit is designed to easily integrate with most agent providers and lets you choose or combine the tools that best fit your workflow.


## Features

nerds-vst is a package that provides:

- **Scaffold tool** — Running `bun nvst init` copies the template from this repo’s `scaffold/` directory into the target project, creating the following structure:

  ```
  AGENTS.md
  .agents/
    PROJECT_CONTEXT.md
    state_rules.md
    state.example.json
    skills/
      create-pr-document/SKILL.md
      refine-pr-document/SKILL.md
      create-project-context/SKILL.md
      refine-project-context/SKILL.md
      create-test-plan/SKILL.md
      refine-test-plan/SKILL.md
      implement-user-story/SKILL.md
      create-issue/SKILL.md
      execute-test-case/SKILL.md
      execute-test-batch/SKILL.md
      evaluate/SKILL.md
      plan-refactor/SKILL.md
      refactor-prd/SKILL.md
      refine-refactor-plan/SKILL.md
      execute-refactor-item/SKILL.md
      automated-fix/SKILL.md
      debug/SKILL.md
    flow/
      it_000001_progress.example.json
      archived/
  docs/
    nvst-flow/
      COMMANDS.md
      QUICK_USE.md
      templates/
        CHANGELOG.md
        TECHNICAL_DEBT.md
        it_000001_product-requirement-document.md
        it_000001_test-plan.md
        it_000001_evaluation-report.md
        it_000001_refactor_plan.md
  schemas/
    state.ts
    prd.ts
    progress.ts
    test-plan.ts
    issues.ts
    prototype-progress.ts
    test-execution-progress.ts
    refactor-prd.ts
    refactor-execution-progress.ts
    validate-state.ts
    validate-progress.ts
  ```

  Template files in this repository live under [`scaffold/`](scaffold/) with a `tmpl_` prefix (e.g. `tmpl_AGENTS.md`, `tmpl_state.ts`); `bun nvst init` copies them into the target project and writes them without the prefix to avoid naming conflicts when the toolkit is integrated elsewhere. The `state.json` file is created and managed by the toolkit at runtime.

- **Command-line tool** — Sends instructions to your chosen agent provider (Claude, Codex, Gemini, etc.) so it follows the framework. Commands drive the main development loop and keep state in sync, giving you a single way to run the process regardless of which agent you use.

  **Command summary** (see [process_design.md](process_design.md) for full details):

  `Define/Refine/Approve Requirement → Create Prototype → Audit Prototype → Refactor Prototype → Approve Prototype`

  | Group | Commands |
  |-------|----------|
  | **Main loop** | `bun nvst define requirement` → `bun nvst refine requirement` (optional) → `bun nvst approve requirement` → `bun nvst create prototype` → `bun nvst audit prototype` → `bun nvst refactor prototype` → `bun nvst approve prototype` |
  | **Utilities** | `bun nvst init`, `bun nvst destroy [--clean]`, `bun nvst write-json --schema <name> --out <path> [--data '<json>']` |

  **Typical iteration example**:

  ```bash
  bun nvst define requirement --agent codex
  bun nvst refine requirement --agent codex --challenge   # optional
  bun nvst approve requirement
  bun nvst create prototype --agent codex --iterations 10
  bun nvst audit prototype --agent codex
  bun nvst refactor prototype --agent codex
  bun nvst approve prototype
  ```


## Installation

**Prerequisites:** [Bun](https://bun.sh/) v1 or later must be installed.

You can install the toolkit from the local file system or from a registry (when published).

### From local file system

Install from a local directory or a packed tarball:

```bash
# From project root
bun add /path/to/nerds-vibecoding-survivor-toolkit

# Or from a packed .tgz (run `bun run package` first)
bun add ./quinteroac-agents-coding-toolkit-0.1.1-preview.0.tgz
```

### From npm

When the package is published to npm:

```bash
bun add @quinteroac/agents-coding-toolkit
# or
npm install @quinteroac/agents-coding-toolkit
```

### Verify installation

After installation, the `nvst` command should be available. Prefer `bun nvst` so Bun resolves the binary from the local package:

```bash
# Check that the command works
bun nvst --help

# Verify installed version matches the package
bun nvst --version
```

**If `nvst` is not found:** add your project’s `node_modules/.bin` to your `PATH`, or run it explicitly:

```bash
# Add to PATH for the current shell (adjust path if your project root differs)
export PATH="$PATH:$(pwd)/node_modules/.bin"
nvst --help

# Or run the binary directly (from the project that has the toolkit as a dependency)
./node_modules/.bin/nvst --help
```

## Acknowledgement

Acknowledgements and credits will be added after the initial release.

## References

- [process_design.md](process_design.md) — Full process specification.
- [docs/nvst-flow/COMMANDS.md](docs/nvst-flow/COMMANDS.md) — Full CLI command reference.
- [docs/nvst-flow/QUICK_USE.md](docs/nvst-flow/QUICK_USE.md) — Quick start and common workflows.
