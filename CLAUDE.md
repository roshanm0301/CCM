# CCM Project Instructions for Claude Code

## Mission
Implement the CCM application incrementally, using the supplied phase documents as the only functional source of truth.

## Source priority
1. `input-requirements/ccm-scope.md`
2. `input-requirements/CCM_Phase6_Resolution_Activities.md` ← **current active phase**
3. `input-requirements/CCM_Phase1_Agent_Interaction_Documentation.md` (prior phase — implemented)
4. Architecture, design-system, security, testing, and DevOps documents in this repository
5. Existing code and tests

If two sources conflict:
1. Current phase requirement documents win for business behavior.
2. Security and compliance controls win for enforcement.
3. Shared architecture and coding standards win for implementation style.
4. Never resolve business ambiguity by invention. Surface it as an open question.

## Current phase guardrail
This repository is now in **Phase 6: Resolution Activities** (source: `input-requirements/CCM_Phase6_Resolution_Activities.md`).

Phases 1, 4, and 5 are complete and must not be regressed.

### In scope now (Phase 6)
- Post-case-registration screen with tabs: Case (read-only), Follow Up, Resolution
- Dealer Catalog View — filterable/sortable case grid for dealer users
- Resolution tab: current activity driven by activity templates (Loop / MoveForward / Close outcomes)
- Follow Up tab: agents add immutable follow-up entries; all users view history
- File attachments on resolution activities (PDF/JPG/PNG/JPEG, max 5 MB, stored in MongoDB)
- Dealer user role, login endpoint, and seed user
- Case status transitions: Open → In Progress → Closed – Verified

### Still in scope from prior phases (do not regress)
- Agent login and workspace access (Phase 1)
- Interaction lifecycle, search, context retrieval, wrapup (Phase 1)
- Case creation workflow (Phase 4)
- Activity flow configuration — templates, steps, outcomes (Phase 5)

### Out of scope (do not implement)
- SLA timers or escalation routing
- Supervisor, HO, or reporting dashboards
- Contact creation inside CCM
- Sales enquiry workflow
- Broad analytics

## Non-negotiable working rules
- Do not invent new fields, statuses, validations, workflows, or personas.
- Do not pull future-phase behavior into the current phase.
- Use rule-based, implementation-ready language.
- Keep changes traceable to a source document.
- Prefer additive, modular changes over broad rewrites.
- Preserve auditability, security, accessibility, and testability in every change.

## Mandatory skill triggers — when to run each skill automatically

These skills MUST be run at the specified trigger points without waiting to be asked:

| Skill | Mandatory trigger |
|---|---|
| `/scope-drift-check` | Before every gate review |
| `/migration-check` | Immediately when any `.sql` file is added or modified in `ops/migrations/` |
| `/test-gap` | Before every gate review; after any qa-engineer test writing task completes |
| `/gate-review` | After every wave touching more than one file — replaces direct DA agent invocation |
| `/env-check` | Immediately before any browser-based verification step |

**The skill trigger is non-negotiable.** If a trigger condition is met and the skill is not run, that is a process violation equivalent to skipping the gate review itself.

## Devil's Advocate gate — mandatory for every change wave
The `devils-advocate` agent is a **hard gate**, not an advisor. This rule applies to ALL implementation work, not just the 4 formal delivery waves.

**Rule:** After every meaningful wave of implementation (backend changes, frontend changes, infrastructure changes, or any combination that touches more than one file), the `devils-advocate` agent MUST be invoked to review the changes. Work on the next task does NOT proceed until the Devil's Advocate issues a formal verdict.

| Verdict | Meaning | Action |
|---|---|---|
| 🔴 BLOCKED | One or more CRITICAL issues | All CRITICAL issues must be fixed and re-reviewed before any further work |
| 🟡 PASS WITH CONDITIONS | HIGH issues present | Next task may begin only if every HIGH condition is assigned to a named agent and tracked |
| 🟢 PASS | No CRITICAL or HIGH issues | Next task proceeds unconditionally |

**How to invoke after changes — use `/gate-review` skill:**
1. Complete implementation changes across relevant files
2. Run `/gate-review` — this skill collects changed files, categorises by DA checklist domain, and submits the formal review to the `devils-advocate` agent automatically
3. The DA agent reads actual files and issues its verdict
4. Address any CRITICAL issues immediately; track HIGH issues explicitly
5. Only proceed to next implementation task after PASS or PASS WITH CONDITIONS is issued

**Never invoke the `devils-advocate` agent directly without first running `/gate-review`.** The skill ensures the agent receives complete, structured context — unstructured invocations produce incomplete reviews.

This rule exists because defects caught before the next change are 10× cheaper to fix than defects discovered after the next wave is built on top of them.

## How to delegate work
Use specialist subagents for focused work:
- `product-owner` for scope-fit checks, traceability, acceptance clarity, and requirement gap detection.
- `solution-architect` for module boundaries, API shape, data placement, and technical decisions.
- `ux-designer` for enterprise UX, layout, interaction behavior, and design-system application.
- `frontend-engineer` for React + Material UI + TypeScript implementation.
- `backend-engineer` for Node.js + TypeScript APIs, persistence, and integration adapters.
- `qa-engineer` for test design, regression thinking, and release quality gates.
- `devops-engineer` for Docker, Docker Compose, CI/CD, secrets, deployment, and observability.

Use a specialist before editing when the task crosses discipline boundaries.

## Default delivery sequence for a new work item
1. Confirm phase and source documents.
2. Run `/scope-drift-check` to verify no existing drift before adding more code.
3. Ask `product-owner` to validate scope fit and list constraints.
4. Ask `solution-architect` to shape the implementation seam.
5. Ask `ux-designer` if UI behavior, layout, or component choices are affected.
6. Ask `frontend-engineer` and/or `backend-engineer` to implement.
7. If any SQL migration was added or changed: run `/migration-check` immediately.
8. Ask `qa-engineer` to produce test coverage and failure scenarios.
9. Run `/test-gap` to verify the qa-engineer's output covers all Phase 1 scenarios.
10. Ask `devops-engineer` when runtime, pipelines, containers, or environment behavior changes.
11. Run `/gate-review` — this triggers the Devil's Advocate gate review.
12. Summarize outputs, assumptions, files changed, and remaining risks.

## Required output structure for substantial tasks
For any non-trivial implementation, return these sections:
1. **Goal**
2. **Inputs consumed**
3. **Phase boundary check**
4. **Approach**
5. **Files changed or proposed**
6. **Validation performed**
7. **Open questions or risks**

## File map
Consult the root `.md` files (`architecture-principles`, `coding-standards`, `security-principles`, `non-functional-requirements`, `data-model-outline`, `high-level-architecture`, `testing-strategy`, `devops-ci-cd`, `logging-and-monitoring`) and `design-system/*` when the task domain requires them. Do not read them all preemptively.

## Implementation preferences
- Frontend: React + Material UI + TypeScript
- Progressive Web Application which is device agnostic, browser agnostic
- Backend: Node.js + TypeScript
- Databases: PostgreSQL for relational workflow truth; MongoDB only where the documented architecture justifies flexible document storage or integration payload retention
- Deployment: Dockerized services with Docker Compose for local and integration environments

## Done criteria
Work is not done until all steps in the delivery sequence above are completed and `/gate-review` has issued PASS or PASS WITH CONDITIONS.

## Local development and verification workflow
See `docs/local-dev-workflow.md` for Docker vs Hybrid mode instructions, first-time setup, environment files, and mandatory browser verification steps.