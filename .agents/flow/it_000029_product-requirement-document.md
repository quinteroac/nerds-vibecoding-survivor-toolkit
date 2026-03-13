# Requirement: Distribute NVST as Bun-built binaries (replace npm package)

## Context

Today NVST is distributed as an npm package; users need Node/npm or Bun to install and run it. Changing to Bun-built standalone binaries for macOS, Linux, and Windows removes the need for a Node/npm (or Bun) runtime on the target machine and provides a single-download executable for easier installation and updates.

## Goals

- Distribute NVST as standalone executables (no Node/npm/Bun required on the user machine).
- Simplify installation and updates via a single executable per platform.
- Produce and publish binaries for macOS, Linux, and Windows when a release (tag) is created, matching the current tag-based release flow.

## User Stories

### US-001: Build produces one binary per target platform

**As a** maintainer, **I want** to build a single executable with Bun for a given platform **so that** I can ship one file per OS.

**Acceptance Criteria:**

- [ ] A Bun build (or equivalent) produces one binary (e.g. `nvst` or `nvst.exe`) for the current or specified platform.
- [ ] Build is reproducible from the repo (documented script or command, e.g. `bun run build:binary` or `bun build src/cli.ts --outdir=dist`).
- [ ] Typecheck / lint passes.
- [ ] **[UI stories only]** N/A (CLI only).

### US-002: Built binary behaves like `bun nvst`

**As an** end user, **I want** the downloaded binary to behave like `bun nvst` **so that** I get the same CLI and behavior without Bun.

**Acceptance Criteria:**

- [ ] Running the binary (e.g. `./nvst --help` or `nvst.exe --help`) shows the same help and subcommands as `bun nvst`.
- [ ] At least one non-trivial command (e.g. `nvst define requirement` or `nvst --version`) runs successfully when invoked via the binary.
- [ ] Typecheck / lint passes.
- [ ] **[UI stories only]** N/A (CLI only).

### US-003: Single entry point to build all three platform binaries

**As a** maintainer, **I want** one script or command that produces binaries for macOS, Linux, and Windows **so that** releases can be built consistently.

**Acceptance Criteria:**

- [ ] One script or command (e.g. `bun run build:binaries` or a small script in `scripts/`) builds executables for mac, linux, and windows (e.g. from a single runner using Bun’s target or matrix).
- [ ] Output is predictable (e.g. `dist/nvst-darwin-*`, `dist/nvst-linux-*`, `dist/nvst-windows-*` or similar).
- [ ] Typecheck / lint passes.
- [ ] **[UI stories only]** N/A (CLI only).

### US-004: Binary is self-contained (no Bun/Node on target machine)

**As an** end user, **I want** to run the binary on a machine without Bun or Node installed **so that** I can use NVST with a single download.

**Acceptance Criteria:**

- [ ] The built binary runs on a clean macOS, Linux, or Windows system without Bun or Node.js installed (e.g. verified in a minimal container or VM, or documented as a requirement of the build).
- [ ] No runtime error due to missing Bun/Node when invoking the binary.
- [ ] Typecheck / lint passes.
- [ ] **[UI stories only]** N/A (CLI only).

### US-005: GitHub Actions workflow builds and publishes binaries on release

**As a** maintainer, **I want** a GitHub Actions workflow that builds and publishes the three binaries when a release is created **so that** distribution stays aligned with the current tag-based release flow.

**Acceptance Criteria:**

- [ ] A workflow (new or updated) runs when a GitHub Release is published (same trigger as current publish flow, e.g. `release: types: [published]`).
- [ ] The workflow builds binaries for macOS, Linux, and Windows (e.g. via matrix or Bun native targets).
- [ ] The resulting binaries are attached to the GitHub Release as assets (e.g. `nvst-darwin-amd64`, `nvst-linux-amd64`, `nvst-windows-amd64.exe` or similar).
- [ ] Typecheck / lint passes.
- [ ] **[UI stories only]** N/A (CLI only).

## Functional Requirements

- FR-1: The CLI entry point remains `src/cli.ts`; the Bun build compiles it (and its dependencies) into a single executable.
- FR-2: Binaries are produced for at least: macOS (darwin), Linux (linux), Windows (windows), with architecture (e.g. x64) implied or explicit as needed.
- FR-3: Release artifacts (binaries) are generated only when a release is published (tag/release trigger), not on every push.
- FR-4: The project remains CLI-only; no change to the set of commands or to AGENTS.md/PROJECT_CONTEXT.md beyond distribution and release steps.

## Non-Goals (Out of Scope)

- Publishing the package to npm in this iteration (focus is binary distribution; npm can be deprecated or kept in a later iteration).
- Supporting additional architectures (e.g. arm64) unless required to satisfy “mac, linux, windows” with a single binary per OS.
- A dedicated download page or installer (MSI/pkg); delivery is via GitHub Release assets only for the MVP.
- Changing NVST commands, skills, or agent behavior.

## Open Questions

- None.
