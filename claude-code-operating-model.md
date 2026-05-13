# Claude Code Operating Model for CCM

## Purpose
This document explains how the Claude-specific files in this package should be used together.

## Included operating files
```text
/CLAUDE.md
/.claude/settings.json
/.claude/agents/
/.claude/skills/
/input-requirements/
```

## What each file does
### `CLAUDE.md`
Shared project instructions loaded at session start. It sets source priority, phase guardrails, delegation rules, and required output structure.

### `.claude/settings.json`
Project-scoped Claude Code settings intended to be checked into source control. This file contains a conservative example permission profile for a shared engineering repository.

### `.claude/agents/*.md`
Specialist subagents for:
- Product Owner
- Solution Architect
- UX Designer
- Frontend Engineer
- Backend Engineer
- QA Engineer
- DevOps Engineer

Use these when a task requires specialist judgment or when you want clearer handoffs inside a single Claude Code workflow.

### `.claude/skills/*`
Reusable slash-command workflows:
- `/phase-delivery` -> creates a phase-safe plan and specialist work orders
- `/handoff-packet` -> creates structured handoff instructions for the next specialist or for phase closeout

## Recommended execution pattern
1. Open the repository with Claude Code.
2. Confirm the active phase documents under `input-requirements/`.
3. Use `/phase-delivery <phase-or-slice-name>` to create the work order sequence.
4. Delegate to specialist agents as needed.
5. Use `/handoff-packet <target-agent-or-closeout>` whenever work crosses disciplines.
6. Before merge or release, run QA and DevOps checks explicitly.

## Why this operating model is safe for phased delivery
- Functional behavior remains in the requirement files.
- Shared architecture and design rules live separately from phase-specific requirements.
- Subagents are role-focused and bounded.
- Skills standardize planning and handoffs without inventing extra product scope.

## What not to do
- Do not treat `CLAUDE.md` as a replacement for requirement documents.
- Do not add future-phase functionality just because the architecture anticipates it.
- Do not let design-system docs create undocumented fields or workflows.
- Do not store secrets in project-scoped Claude files.
