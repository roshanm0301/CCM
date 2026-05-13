---
name: gate-review
description: Prepare and submit a formal Devil's Advocate gate review after any wave of implementation. Collects changed files, categorises by domain, maps to the DA checklist, and invokes the devils-advocate agent. Use after every meaningful wave — backend, frontend, infrastructure, or any combination touching more than one file.
allowed-tools: Bash, Glob, Grep, Read, Agent
---

You are executing the `/gate-review` skill for the CCM project.

## What this skill does

Collects the current wave's changes, categorises them against the Devil's Advocate checklist domains, and submits a complete, structured gate review request to the `devils-advocate` agent. The DA agent reads actual files — your job is to give it complete, accurate context so it can review without guessing.

---

## Step 1 — Identify changed files

Run the following to find what changed in this wave:

```bash
git -C D:/excellongit/apt-iDMS-app-CCM diff --name-only HEAD 2>/dev/null || \
git -C D:/excellongit/apt-iDMS-app-CCM status --short 2>/dev/null
```

If git is unavailable or returns nothing meaningful, ask the user: "Which files were changed or created in this wave?" and use their answer.

List every changed file with its full path.

---

## Step 2 — Categorise by domain

Map each changed file to one or more of these DA checklist domains:

| Domain | File patterns |
|---|---|
| **Security** | `auth/`, `middleware/`, `csrf`, `authenticate`, `authorize`, `jwt`, `cookie`, `cors`, `Dockerfile`, `.env` |
| **Data Integrity** | `interaction/`, `migrations/`, `repository`, `wrapup`, `interaction_events`, `search_attempts` |
| **Architecture & API** | `controller`, `service`, `routes`, `validator`, `integration/`, `adapter`, `health/` |
| **DevOps & Docker** | `Dockerfile`, `docker-compose`, `nginx/`, `ops/`, `.dockerignore` |
| **Frontend** | `apps/web/`, `.tsx`, `.ts` in web, `store`, `hooks`, `api/client` |
| **Test Coverage** | `__tests__/`, `.test.ts`, `.test.tsx`, `vitest`, `jest` |
| **Deployment Readiness** | ANY wave that adds/changes routes, services, migrations, or frontend pages |

---

## Step 3 — Build the gate review summary

Construct a summary with the following sections. Be precise — the DA agent will cross-check every claim:

```
GATE REVIEW REQUEST
===================

Wave description: [one sentence describing what this wave implemented]

Gate number: [1 / 2 / 3 / 4 / ad-hoc — if unsure, write "ad-hoc"]

Files changed:
- [full path] — [brief description of what changed]
- ...

Domains touched:
- Security: [yes/no — list files if yes]
- Data Integrity: [yes/no — list files if yes]
- Architecture & API: [yes/no — list files if yes]
- DevOps & Docker: [yes/no — list files if yes]
- Frontend: [yes/no — list files if yes]
- Test Coverage: [yes/no — list files if yes]

High-risk items in this wave (self-assessment):
- [any items you know need close scrutiny — auth changes, state machine changes, migration DDL, etc.]

Deployment readiness assessment (MANDATORY — answer all three):
- Container build model: compiled-image (no volume mounts) OR volume-mounted source?
- Does this wave add new API routes, change existing routes, or add frontend pages? [yes/no]
- If yes: will a `docker compose up --build` be required before browser verification? [yes/no — state which services]

Prior gate conditions to verify:
- [list any PASS WITH CONDITIONS items from the previous gate that should now be resolved]
- [write "None — first gate" if this is Gate 1]

Reference files for DA to read:
- input-requirements/CCM_Phase1_Agent_Interaction_Documentation.md
- security-principles.md
- data-model-outline.md
- architecture-principles.md
- testing-strategy.md
- [any specific files from the changed list that are most critical]
```

---

## Step 4 — Invoke the devils-advocate agent

Invoke the `devils-advocate` agent using the Agent tool with the complete summary from Step 3 as the prompt. The prompt must instruct the DA agent to:

1. Read every changed file listed — not summaries, actual file content
2. Cross-check against the DA checklist in its agent definition
3. Issue a formal verdict: 🔴 BLOCKED / 🟡 PASS WITH CONDITIONS / 🟢 PASS
4. List all CRITICAL issues (if any), all HIGH issues (if any), MEDIUM and LOW issues
5. Verify resolution of any prior gate conditions

---

## Step 5 — Present verdict to user

After the DA agent returns:

- If **🔴 BLOCKED**: state which CRITICAL issues must be fixed before any next step. Do not proceed with any implementation task.
- If **🟡 PASS WITH CONDITIONS**: list each HIGH condition with its assigned agent and fix description. Implementation of the next task may begin.
- If **🟢 PASS**: confirm the wave is cleared. Next task proceeds unconditionally.

Record the verdict in your response so the user has a clear record.

---

## Deployment domain — DA must check this on EVERY gate review

The CCM docker-compose uses `target: production` with **no source volume mounts** for `ccm-api` and `ccm-web`. Code is compiled INTO the image at build time.

The DA agent MUST include the following assessment in every verdict:

```
DEPLOYMENT READINESS
  Build model:              compiled-image (no volume mounts)
  New/changed API routes:   [yes/no — list them]
  New/changed frontend pages: [yes/no — list them]
  New/changed migrations:   [yes/no — list them]
  Rebuild required before browser verification:
    ccm-api: [YES — new routes/services changed / NO]
    ccm-web: [YES — frontend pages/components changed / NO]
  Rebuild command (if required):
    docker compose -f D:/excellongit/apt-iDMS-app-CCM/apt-idms-ccm/docker-compose.yml up --build --no-deps -d api web
```

If the wave adds any new route or changes any existing route and the DA does NOT flag a rebuild requirement, that is a **process failure** equivalent to missing a CRITICAL issue.

---

## Hard rules

- Do not skip Step 1. Do not fabricate the file list from memory.
- Do not soften, edit, or re-interpret the DA agent's verdict.
- Do not allow the next implementation task to begin if the verdict is BLOCKED.
- If the DA agent fails to issue a formal verdict, report that as a process failure and re-invoke.
- The DA verdict MUST include a DEPLOYMENT READINESS section. If it does not, re-invoke the DA agent.
