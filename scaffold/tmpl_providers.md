# Agent providers (scaffold)

<!-- TODO: Complete. All content in English. No implementation in this phase; this document specifies how to plug providers. -->

## Common interface

TBD — Mental model: `runAgent(provider, prompt, inputs, options) -> outputs`. Define inputs/outputs contract (e.g. which files are read/written, how stdout is captured).

## Retries and stop-on-critical

TBD — `retry-on-fail`: how many retries, on what conditions. `stop-on-critical`: when to abort the loop (e.g. critical test failure).

## Iteration limits

TBD — Max iterations per run; behavior when limit is reached.

## Logs and traces

TBD — How to capture agent logs/traces for debugging and audit.

## Adapters

### Cursor Agent

TBD — Config/credentials required. How context is passed (files vs prompt). How to get deterministic output (e.g. “write only this file”).

### Codex CLI

TBD — Same points as above.

### Gemini

TBD — Same points as above.

### Claude Code

TBD — Same points as above.
