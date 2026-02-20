# Iteration close checklist (scaffold)

<!-- TODO: Complete. All content in English. Use when closing an iteration (before running start next iteration / archive). -->

- [ ] **prototype_approved** — Prototype has been approved (`phases.prototype.prototype_approved === true`).
- [ ] **Full tests** — Tests for all use cases of the iteration (original + refactor/regression) have been run and pass (or documented exceptions).
- [ ] **PROJECT_CONTEXT.md** — Updated with newly implemented features; summary mechanism applied so file does not exceed 250 lines.
- [ ] **CHANGELOG.md** — Iteration summary recorded (requirements, refactorings, fixes).
- [ ] **Archive** — Ready to run “start iteration” (move `it_<iteration>_*` to `.agents/flow/archived/<iteration>/`, update state.history, reset phase for next iteration).

TBD — Add any project-specific items.
