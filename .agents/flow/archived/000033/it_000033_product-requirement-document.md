# Requirement: Impeccable Skills Integration

## Context

[Impeccable](https://github.com/pbakaus/impeccable) is an Apache 2.0-licensed collection of Claude Code skills focused on high-quality frontend design, UI audit, and interface polish. Integrating these skills into NVST accomplishes two things: (1) every project scaffolded with `nvst init` gets the Impeccable skills out of the box, and (2) the NVST workflow skills (implement, audit, refactor) explicitly guide the agent to leverage Impeccable skills whenever a task involves UI/frontend design, construction, or quality review.

## Goals

- Scaffold all Impeccable skills into `.agents/skills/` of the target project automatically on `nvst init`.
- Make NVST workflow skills skill-aware: reference the relevant Impeccable skills in `implement-user-story`, `audit-prototype`, and `refactor-prototype` prompts.
- Comply with the Apache 2.0 license of Impeccable by adding a `NOTICE.md` and acknowledgements in `README.md` to the NVST repository.

## User Stories

### US-001: Scaffold Impeccable Skills on Init

**As a** developer running `nvst init` in a new project, **I want** all Impeccable skills to be copied into `.agents/skills/` alongside the existing NVST skills **so that** I have high-quality design and audit skills available immediately without manual setup.

**Acceptance Criteria:**
- [ ] All 18 Impeccable skills (`adapt`, `animate`, `audit`, `bolder`, `clarify`, `colorize`, `critique`, `delight`, `distill`, `extract`, `frontend-design`, `harden`, `normalize`, `onboard`, `optimize`, `polish`, `quieter`, `teach-impeccable`) are added to `scaffold/.agents/skills/` as static files with the `tmpl_` prefix convention (e.g. `scaffold/.agents/skills/frontend-design/tmpl_SKILL.md`).
- [ ] The `frontend-design` skill's `reference/` subdirectory files (e.g. `reference/typography.md`) are also included in the scaffold.
- [ ] Impeccable skill files are copied verbatim from the upstream source — no content modifications.
- [ ] After running `bun run src/scripts/generate-scaffold-manifest.ts`, all new skill files appear in `src/scaffold-manifest.ts`.
- [ ] Running `nvst init` in a clean directory creates each Impeccable skill at `.agents/skills/<skill-name>/SKILL.md` (and `reference/` files where applicable).
- [ ] Running `nvst init` a second time skips already-existing Impeccable skill files (existing behavior: "Skipping existing file").
- [ ] `bun run typecheck` passes with no errors.

---

### US-002: Implement User Story References Impeccable for UI Tasks

**As an** AI agent executing the `implement-user-story` skill, **I want** to be explicitly guided to use Impeccable design skills when the user story involves UI or frontend work **so that** the resulting implementation meets high design quality standards and avoids generic AI aesthetics.

**Acceptance Criteria:**
- [ ] The `implement-user-story` SKILL.md contains a section (e.g. `## UI / Frontend Stories`) that instructs the agent: if the user story involves a UI component, page, visual element, or frontend interaction, apply the following Impeccable skills in order: `frontend-design` (design direction and aesthetics), `harden` (edge case resilience), `polish` (final quality pass).
- [ ] The section specifies the detection heuristic for "UI task": look for keywords in acceptance criteria or story description such as "UI", "interface", "page", "component", "visual", "button", "form", "layout", "style", or "frontend".
- [ ] The instruction is clear enough for a junior developer or AI agent to follow without ambiguity.
- [ ] No changes are made to the Impeccable skill files themselves — only the NVST skill references them.

---

### US-003: Audit Prototype References Impeccable for UI Audit

**As an** AI agent executing the `audit-prototype` skill, **I want** to be guided to leverage Impeccable's audit and critique skills when the iteration includes UI/frontend work **so that** the audit covers design quality, UX critique, and interface performance in addition to functional compliance.

**Acceptance Criteria:**
- [ ] The `audit-prototype` SKILL.md contains a section (e.g. `## UI / Frontend Audit`) that instructs the agent: if any audited user story or functional requirement involves UI, apply the following Impeccable skills: `audit` (accessibility, performance, theming, responsive), `critique` (UX design evaluation), `optimize` (interface performance).
- [ ] The section specifies that Impeccable audit findings should be incorporated into the compliance report under "Minor observations" or as separate FR/US assessment notes.
- [ ] The instruction is placed before the "Diagnostic Scan" section of the existing SKILL.md so the agent reads it early.
- [ ] No changes are made to the Impeccable skill files themselves.

---

### US-004: Refactor Prototype References Impeccable for UI Refinement

**As an** AI agent executing the `refactor-prototype` skill, **I want** to be guided to apply Impeccable refinement skills when the refactor plan includes UI changes **so that** the refactored interface is polished, resilient, performant, and consistent with the design system.

**Acceptance Criteria:**
- [ ] The `refactor-prototype` SKILL.md contains a section (e.g. `## UI / Frontend Refactor`) that instructs the agent: if any refactor item involves UI, apply the following Impeccable skills in order: `polish` (alignment, spacing, consistency), `harden` (edge cases, error states, i18n), `optimize` (performance), `normalize` (design system consistency).
- [ ] The section specifies the same detection heuristic as US-002 for identifying UI refactor items.
- [ ] No changes are made to the Impeccable skill files themselves.

---

### US-005: NOTICE.md and README Acknowledgements

**As a** maintainer of the NVST repository, **I want** to add proper Apache 2.0 attribution for the Impeccable skills in `NOTICE.md` and `README.md` **so that** NVST complies with the license terms and gives proper credit to the Impeccable project.

**Acceptance Criteria:**
- [ ] A `NOTICE.md` file is created at the root of the NVST repository containing: the NVST copyright notice, a section "Third-Party Notices", and an entry for Impeccable that includes: project name, author (pbakaus), source URL (`https://github.com/pbakaus/impeccable`), license (Apache 2.0), and the verbatim Apache 2.0 attribution notice from Impeccable's own `NOTICE.md`.
- [ ] `README.md` contains an "Acknowledgements" section (or equivalent) that credits Impeccable with a link to its GitHub repository and a note that the skills are licensed under Apache 2.0.
- [ ] The `NOTICE.md` content is placed before or after any existing copyright block, not replacing it.

---

## Functional Requirements

- **FR-1:** All 18 Impeccable skill `SKILL.md` files must be added verbatim to `scaffold/.agents/skills/<skill-name>/tmpl_SKILL.md`. No content modifications allowed.
- **FR-2:** The `frontend-design` reference files (e.g. `reference/typography.md`) must be added to `scaffold/.agents/skills/frontend-design/reference/` with the `tmpl_` prefix (e.g. `tmpl_typography.md`), so the scaffold manifest strips it and copies them as `reference/typography.md` in the target project.
- **FR-3:** After adding scaffold files, `bun run src/scripts/generate-scaffold-manifest.ts` must be executed to regenerate `src/scaffold-manifest.ts` so the new files are bundled into the CLI.
- **FR-4:** `implement-user-story/SKILL.md` must be updated to include explicit instructions to use Impeccable skills (`frontend-design`, `harden`, `polish`) for user stories with UI/frontend scope.
- **FR-5:** `audit-prototype/SKILL.md` must be updated to include explicit instructions to use Impeccable skills (`audit`, `critique`, `optimize`) for iterations with UI/frontend scope.
- **FR-6:** `refactor-prototype/SKILL.md` must be updated to include explicit instructions to use Impeccable skills (`polish`, `harden`, `optimize`, `normalize`) for refactor items with UI/frontend scope.
- **FR-7:** A `NOTICE.md` file must be created at the NVST repo root with proper Apache 2.0 attribution for Impeccable.
- **FR-8:** `README.md` must be updated with an "Acknowledgements" section crediting Impeccable.
- **FR-9:** No new npm/Bun dependencies may be introduced. Impeccable skills are embedded statically in the scaffold, not fetched at runtime.

## Non-Goals (Out of Scope)

- Dynamically fetching Impeccable skills from GitHub at runtime during `nvst init`.
- Modifying the content of any Impeccable skill files.
- Auto-detecting UI tasks programmatically in TypeScript CLI code — detection is a textual instruction to the AI agent in the SKILL.md, not a code feature.
- Adding a mechanism to update/sync Impeccable skills after `nvst init` (future iteration).
- Including `teach-impeccable` skill in the workflow instructions (it is scaffolded but not referenced in NVST phase skills).
- Any changes to `nvst destroy` — existing teardown behavior is sufficient.

## Open Questions

- None.
