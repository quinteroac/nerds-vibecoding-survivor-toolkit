# Ralph loop (scaffold)

<!-- TODO: Complete. All content in English. Pseudoflow and contracts; no executable implementation in this phase. -->

## Pseudoflow

TBD — Select next use case from PRD; validate against `it_<iteration>_progress.json`; if not implemented, implement + tests per PROJECT_CONTEXT.md; commit that use case; update progress.json (implementation + tests). Termination: when all use cases are done or iteration limit reached.

## Git contract

TBD — On start of `bun create prototype` (or equivalent): first agent creates a branch (e.g. `feature/it_000001` or `iteration/000001`). For each use case implemented in the loop: one commit (code + tests for that use case).

## Relation to progress.json

TBD — Each entry in `entries` corresponds to one use case; agent updates `implementation.status` and `tests` array as it goes.
