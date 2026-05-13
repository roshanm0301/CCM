---
name: phase-delivery
description: Start or review a CCM phase or feature slice, produce a phase-safe execution plan, and identify the subagent work order and validation gates.
disable-model-invocation: true
allowed-tools: Read, Glob, Grep
---
Use this skill when a new phase, workstream, or feature slice is about to start.

## What this skill must do
1. Read the authoritative requirement documents for the requested phase.
2. Read the shared architecture, design-system, security, testing, and DevOps documents relevant to the work.
3. Produce a phase-safe execution plan that does **not** invent business behavior.
4. Identify which specialist subagents should be used, in what order, and for what output.
5. Highlight dependencies, blockers, validation gates, and explicit out-of-scope items.

## Required output
Use [templates/phase-plan-template.md](templates/phase-plan-template.md) for the phase plan and [templates/work-order-template.md](templates/work-order-template.md) for each agent work order.

## Hard rules
- Do not add future-phase logic.
- Do not create undocumented requirements.
- When requirements are unclear, produce `Open Questions` instead of assumptions.
- The plan must be implementation-oriented, not generic.

## Inputs to inspect
- `input-requirements/`
- `README.md`
- `CLAUDE.md`
- architecture, design-system, testing, security, DevOps docs

## Expected deliverables
- One consolidated phase plan
- One work order per required specialist agent
- A short risk list
- A validation-gates list
