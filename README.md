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

- **Scaffold tool** — Running `nvst init` initializes the framework by copying the template to the target project, creating the core structure:

  ```
  AGENTS.md         # Entry point for agents
  .agents/          # Workflow state and artifacts
    state.json      # Current iteration state
    PROJECT_CONTEXT.md
    skills/         # Specialized agent skills
    flow/           # Iteration artifacts (PRDs, etc.)
  ```

  Template files live under [`scaffold/`](scaffold/) and are synced to the target project.

- **Command-line tool** — Prompts and orchestrates the development loop, keeping state in sync. Instead of internally calling an agent within the commands, it outputs instructions as prompts to be executed by your preferred AI environment (e.g., Cursor, Antigravity, Claude Code Web, GitHub Copilot).

  **Command summary** (see [docs/nvst-flow/COMMANDS.md](docs/nvst-flow/COMMANDS.md) for the full reference):

  `nvst start iteration` → `nvst define requirement` → `nvst refine requirement` → `nvst approve requirement` → `nvst create prototype` → `nvst audit prototype` → `nvst refactor prototype` → `nvst approve prototype`

  | Group | Commands |
  |-------|----------|
  | **Main loop** | `nvst start iteration`, `nvst define requirement`, `nvst refine requirement` (optional), `nvst approve requirement`, `nvst create prototype`, `nvst audit prototype`, `nvst refactor prototype`, `nvst approve prototype` |
  | **Utilities** | `nvst init`, `nvst destroy [--clean]`, `nvst sync skills`, `nvst write-json`, `nvst write-technical-debt` |

  **Agent providers:** `claude`, `codex`, `gemini`, `cursor`, `copilot`, `ide` — where `ide` prints skill prompts to stdout instead of invoking an agent subprocess.

  **Typical iteration example**:

  ```bash
  nvst start iteration
  nvst define requirement --agent [claude|gemini|codex]
  nvst refine requirement --agent [claude|gemini|codex] --challenge # optional
  nvst approve requirement
  nvst create prototype --agent [claude|gemini|codex] 
  nvst audit prototype --agent [claude|gemini|codex]
  nvst refactor prototype --agent [claude|gemini|codex]
  nvst approve prototype
  ```

  _Note: Using CLI-based agents (claude, gemini, codex) is the recommended way to run NVST for a fully automated experience. You can also use `--agent ide` to output skill prompts directly to the terminal, which you can then copy into web-based agents or IDE tools (Cursor, Antigravity, ChatGPT)._


## Installation

**Prerequisites:** [Bun](https://bun.sh/) v1 or later must be installed.

You can install the toolkit via standalone binaries (recommended for quick use), from the local file system, or from a registry.

### Standalone Binaries (Recommended)

The easiest way to get started is to download the pre-compiled binary for your platform from the [GitHub Releases](https://github.com/quinteroac/nerds-vibecoding-survivor-toolkit/releases):

1.  Download the binary for your OS (e.g., `nvst-linux-x64`).
2.  Make it executable: `chmod +x nvst-linux-x64`.
3.  Move it to your path: `sudo mv nvst-linux-x64 /usr/local/bin/nvst`.

### From local file system

Install from a local directory or a packed tarball:

```bash
# From project root
bun add /path/to/nerds-vibecoding-survivor-toolkit

# Or from a packed .tgz (run `bun run package` first, then install the generated file)
bun add ./quinteroac-agents-coding-toolkit-<version>.tgz
```


### Verify installation

After installation, the `nvst` command should be available.

**If you installed the standalone binary:**
```bash
nvst --version
nvst --help
```

**If you installed via Bun (local or npm):**
Prefer `bun nvst` so Bun resolves the binary from the local package:

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

### Build standalone binary

Build a single platform binary from this repository:

```bash
bun run build:binary
```

Optional flags:

```bash
bun run build:binary --target bun-linux-x64 --outdir dist --name nvst
```

Build all release binaries (macOS, Linux, Windows x64):

```bash
bun run build:binaries
```

The produced executables are standalone artifacts built with `bun build --compile`. They are intended to run on target machines without Bun or Node.js installed.

Quick verification for Linux in a clean environment (no Bun/Node installed in the container):

```bash
docker run --rm -v "$PWD/dist:/dist" debian:stable-slim /dist/nvst-linux-x64 --help
```

## Acknowledgement

This toolkit draws inspiration from other excellent projects in the specification-driven development space. Special thanks to the following libraries for their contribution to the agentic coding ecosystem:

- **[Ralph Loop](https://github.com/mizchi/ralph-loop)**
- **[GSD](https://github.com/gsd-build/get-shit-done)**
- **[spec-kit](https://github.com/spec-kit/spec-kit)**

## References

- [docs/nvst-flow/COMMANDS.md](docs/nvst-flow/COMMANDS.md) — Full CLI command reference.
- [docs/nvst-flow/QUICK_USE.md](docs/nvst-flow/QUICK_USE.md) — Quick start and common workflows.
- [process_design.md](process_design.md) — Full process specification.
