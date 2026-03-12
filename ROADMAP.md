# Nerds Vibecoding Survivor Toolkit - Roadmap

## Core Workflow & Architecture Updates
- **Process Refactor:** Update the main development loop to follow this sequence: *Define/Refine/Approve Requirement* ➔ *Create Prototype* ➔ *Audit Prototype* ➔ *Refactor Prototype* ➔ *Approve Prototype*.
- **Ideation Phase:** Add an optional "Ideation" phase before each iteration. This phase will output updates to `ROADMAP.md`, `PROJECT_CONTEXT.md`, and `TECHNICAL_DEBT.md`.
- **Prompt-Based Execution:** Instead of internally calling an agent within the commands, output the instructions as prompts. This will improve compatibility with IDEs and Web environments (Cursor, Antigravity, Claude Code Web, GitHub Copilot).
- **Interactive Requirements:** During the "define requirement" phase, proactively ask the user to clarify any open questions instead of leaving them unresolved.

## Version Control & Collaboration Features
- **Prototyping Branches:** Automatically create branches in the format `feature/it_XXXXXX-[Req-Description]` during the "create prototype" phase.
- **Team-based Naming Conventions:** Manage different naming conventions for iterations based on GitHub usernames to seamlessly support team development.

## Post-Iteration Automation
- **Prototype Approval Cycle:** During the "approve prototype" phase, automatically update `PROJECT_CONTEXT.md` and `ROADMAP.md`, push changes to git, and create a Pull Request.
