# Nerds Vibecoding Survivor Toolkit

All content in this repo is in English.

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
  iteration_close_checklist.md
  ralph_loop.md
  providers.md
  .agents/
    PROJECT_CONTEXT.md
    state.json
    state_rules.md
    scripts/
      ralph.ts
    skills/
      create-pr-document/SKILL.md
      refine-pr-document/SKILL.md
      create-project-context/SKILL.md
      evaluate/SKILL.md
      plan-refactor/SKILL.md
      refactor-prd/SKILL.md
      debug/SKILL.md
    flow/
      README.md
      archived/
  docs/templates/
    CHANGELOG.md
    TECHNICAL_DEBT.md
  schemas/
    state.ts
    progress.ts
    validate-state.ts
    validate-progress.ts
  ```

  Template files in this repository live under [`scaffold/`](scaffold/) with a `tmpl_` prefix (e.g. `tmpl_AGENTS.md`, `tmpl_ralph_loop.md`); `bun nvst init` copies them into the target project and writes them without the prefix to avoid naming conflicts when the toolkit is integrated elsewhere.

- **Command-line tool** — Sends instructions to your chosen agent provider (Claude, Codex, Gemini, etc.) so it follows the framework. Commands drive the Define → Prototype → Refactor flow and keep state in sync, giving you a single way to run the process regardless of which agent you use.

  **Command summary** (see [process_design.md](process_design.md) for full details):

  | Phase | Commands |
  |-------|----------|
  | **Iteration** | `bun nvst start iteration` — Start or advance to the next iteration (archives current, resets state). |
  | **Define** | `bun nvst define requirement` → `bun nvst refine requirement` (optional) → `bun nvst approve requirement` → `bun nvst create prd` |
  | **Prototype** | `bun nvst create project-context` → `bun nvst approve project-context` → `bun nvst create prototype` → `bun nvst define test-plan` → `bun nvst approve test-plan` → `bun nvst execute test-plan` → `bun nvst execute automated-fix` / `bun nvst execute manual-fix` → `bun nvst approve prototype` |
  | **Refactor** | `bun nvst define refactor-plan` → `bun nvst approve refactor-plan` → `bun nvst create prd --refactor` → `bun nvst execute refactor` → update PROJECT_CONTEXT, CHANGELOG → then `bun nvst start iteration` for next iteration |


## Installation

Installation and usage instructions will be added once the package is built and published.

## Acknowledgement

Acknowledgements and credits will be added after the initial release.

## References

- [process_design.md](process_design.md) — Full process specification.
- [scaffold/.agents/flow/tmpl_README.md](scaffold/.agents/flow/tmpl_README.md) — Flow directory and naming conventions (scaffold template).
