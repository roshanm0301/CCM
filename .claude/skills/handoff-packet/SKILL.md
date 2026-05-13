---
name: handoff-packet
description: Create a structured handoff packet for a specialist agent or for phase closeout using the CCM operating templates.
disable-model-invocation: true
allowed-tools: Read, Glob, Grep, Write, Edit
---
Use this skill when work must be handed from one specialist to another or when a phase needs a formal closeout note.

## What this skill must do
1. Identify the correct target template.
2. Populate the handoff packet with source-bound, phase-safe instructions.
3. Make constraints, files, validation needs, and non-decisions explicit.
4. Keep the packet concise enough to execute but detailed enough to avoid ambiguity.

## Template selection
- Product clarification -> `templates/product-owner-handoff.md`
- Architecture decision or design seam -> `templates/solution-architect-handoff.md`
- UX layout or interaction work -> `templates/ux-handoff.md`
- React/MUI implementation -> `templates/frontend-handoff.md`
- API/service/persistence work -> `templates/backend-handoff.md`
- Validation and regression work -> `templates/qa-handoff.md`
- Docker/Compose/CI/CD/runtime work -> `templates/devops-handoff.md`
- Phase finish or release-ready summary -> `templates/phase-closeout-template.md`

## Hard rules
- No invented requirements.
- Explicitly state out-of-scope items.
- Include exact files or docs to read.
- Include validation expectations and negative cases where relevant.
