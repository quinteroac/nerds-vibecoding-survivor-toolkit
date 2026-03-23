# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Changed — it_000037 (Standalone Skill Invocation)

Skills that previously required NVST to be active can now be invoked directly from any AI agent CLI (e.g. Claude Code, Cursor) that loads skills via `npx skills add`.

**Skills updated:**

- `nvst-skills/define-requirement/SKILL.md` — detects missing `state.json`, asks user for iteration context; skips state write when running standalone.
- `nvst-skills/refine-requirement/SKILL.md` — detects missing `state.json`, asks user for PRD file path; skips state write when running standalone.
- `nvst-skills/create-project-context/SKILL.md` — detects missing `state.json`, asks user for required context; skips state write when running standalone.
- `nvst-skills/create-prototype/SKILL.md` — resolves `user_story` and `iteration` via lookup order: injected context → `state.json` → PRD artifact files → ask user.
- `nvst-skills/refactor-prototype/SKILL.md` — resolves `iteration` and `audit_json_path` via lookup order: injected context → `state.json` → audit artifact files → ask user.
- `nvst-skills/approve-prototype/SKILL.md` — resolves `iteration` via: injected context → `state.json` → ask user.
- `nvst-skills/audit-prototype/SKILL.md` — resolves `iteration` via: injected context → `state.json` → PRD artifact files → ask user.

### Added — it_000037

- All four workflow skills previously marked `user-invocable: false` (`audit-prototype`, `create-prototype`, `refactor-prototype`, `approve-prototype`) now have `user-invocable: true` in their frontmatter, making them discoverable as slash commands in any compatible agent CLI.

---

### Changed — it_000036 (Skill Directory Rename)

Skill directories were renamed to align 1:1 with the corresponding `nvst` CLI commands, eliminating the divergence between skill names and command names.

| Old name | New name |
|----------|----------|
| `create-pr-document` | `define-requirement` |
| `refine-pr-document` | `refine-requirement` |
| `implement-user-story` | `create-prototype` |

**Affected source files:**

- `nvst-skills/define-requirement/` (previously `nvst-skills/create-pr-document/`)
- `nvst-skills/refine-requirement/` (previously `nvst-skills/refine-pr-document/`)
- `nvst-skills/create-prototype/` (previously `nvst-skills/implement-user-story/`)
- `src/commands/define-requirement.ts` — updated `loadSkill()` call
- `src/commands/refine-requirement.ts` — updated `loadSkill()` call
- `src/commands/create-prototype.ts` — updated `loadSkill()` call
- `src/nvst-skills-manifest.ts` — regenerated to reflect new skill directory names
- `tests/` — updated test fixtures and references to old skill names
