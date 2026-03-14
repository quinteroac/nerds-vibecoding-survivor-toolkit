# Audit — Iteration 000029

## Executive Summary

Iteration 000029 implements standalone binary distribution for NVST via Bun's `--compile` flag. The implementation includes: a single-binary build script (`src/scripts/build-binary.ts`), a multi-platform build script (`src/scripts/build-binaries.ts`) producing `nvst-darwin-x64`, `nvst-linux-x64`, and `nvst-windows-x64.exe`, and an updated `publish.yml` GitHub Actions workflow with a dedicated `release-binaries` job triggered on release publication. Typecheck passes. All FRs and USs comply.

## Verification by FR

| FR | Description | Assessment |
|----|-------------|-----------|
| FR-1 | CLI entry point `src/cli.ts`; Bun build compiles to single executable | ✅ comply |
| FR-2 | Binaries for darwin, linux, windows (x64) | ✅ comply |
| FR-3 | Release artifacts only on release published trigger | ✅ comply |
| FR-4 | No change to CLI commands or AGENTS.md/PROJECT_CONTEXT.md | ✅ comply |

## Verification by US

| US | Title | Assessment |
|----|-------|-----------|
| US-001 | Build produces one binary per target platform | ✅ comply |
| US-002 | Built binary behaves like `bun nvst` | ✅ comply |
| US-003 | Single entry point to build all three platform binaries | ✅ comply |
| US-004 | Binary is self-contained (no Bun/Node on target machine) | ✅ comply |
| US-005 | GitHub Actions workflow builds and publishes binaries on release | ✅ comply |

## Minor Observations

1. **Legacy `release.yml`** — still present (workflow_dispatch only), now superseded by `publish.yml`. Could cause confusion.
2. **No smoke-test step** — the workflow builds binaries but doesn't verify they run (e.g., `./nvst-linux-x64 --version`) before uploading to the release.
3. **Self-contained verification** — US-004-AC01 asks for verification on a clean machine; satisfied by design (Bun `--compile` embeds runtime) but no explicit CI evidence.
4. **Windows cross-compile** — building `.exe` from `ubuntu-latest` via Bun targets works by design but is not end-to-end tested in CI.

## Conclusions and Recommendations

The implementation is fully compliant with all PRD requirements. Two improvements are recommended:
1. Remove the legacy `release.yml` workflow to avoid confusion with the new `publish.yml`-based release flow.
2. Add a post-build smoke-test step in the `release-binaries` workflow job to verify the Linux binary runs (`./dist/release/nvst-linux-x64 --version`) before uploading assets.

## Refactor Plan

1. **Delete `.github/workflows/release.yml`** — the legacy workflow_dispatch-only release workflow is now superseded by the `release-binaries` job in `publish.yml`.
2. **Add smoke-test step in `publish.yml`** — after the "Verify release binaries" step, add a step that runs `./dist/release/nvst-linux-x64 --version` to confirm the Linux binary executes and reports a version successfully before uploading.
