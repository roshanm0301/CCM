---
name: test-gap
description: Audit test coverage against all 11 Phase 1 documented features. Identifies missing test files, missing negative and permission scenarios, uncovered interaction event types, and unvalidated API error codes. Routes prioritised gaps to the qa-engineer agent.
allowed-tools: Glob, Grep, Read, Agent
---

You are executing the `/test-gap` skill for the CCM project.

## What this skill does

Maps every Phase 1 documented feature and requirement against existing test files. Identifies gaps by category, severity, and owner. Produces an actionable gap report and routes it to the `qa-engineer` agent.

---

## Phase 1 feature checklist — every item must have test coverage

Source: `input-requirements/CCM_Phase1_Agent_Interaction_Documentation.md`

| ID | Feature | Backend test required | Frontend test required |
|---|---|---|---|
| F1 | Agent login — valid credentials | `auth.service.test` or `auth.integration.test` | `LoginPage` / `LoginForm` test |
| F2 | Agent login — invalid credentials (401) | auth negative test | form error display test |
| F3 | Agent login — inactive user (403) | auth negative test | error message test |
| F4 | Agent login — non-agent role blocked | auth RBAC test | — |
| F5 | Start manual interaction — creates record with Voice/Manual | `interaction.service.test` | `IdleWorkspace` / start button test |
| F6 | Start manual interaction — concurrent open interaction blocked (409) | interaction negative test | — |
| F7 | Start manual interaction — disabled when status ≠ Ready for Calls | — | button disabled state test |
| F8 | Customer search — Mobile filter validation | `search.service.test` | `SearchPanel` validation test |
| F9 | Customer search — Install Base searched first | search adapter sequence test | — |
| F10 | Customer search — falls back to Customer Master | search fallback test | — |
| F11 | Customer search — no results returned | search empty test | empty state display test |
| F12 | Select search result — single result auto-loads context | `context.service.test` | context card render test |
| F13 | Select search result — multiple vehicles require explicit selection | context disambiguation test | vehicle selection UI test |
| F14 | Reselect context — replaces customer/vehicle/dealer cards | interaction reselect test | context card refresh test |
| F15 | Context cards — chassis number masked | — | `VehicleCard.masking.test` |
| F16 | Context cards — dealer missing does not block interaction | context partial test | dealer unavailable state test |
| F17 | Capture disposition — mandatory fields enforced | `interaction.validator.test` | `WrapupForm` validation test |
| F18 | Capture disposition — remarks mandatory for 5 dispositions | interaction remarks validation test | `WrapupForm.remarksRequired.test` |
| F19 | Close interaction — requires valid wrap-up | interaction close state machine test | close button enabled state test |
| F20 | Close interaction — sets status=Closed, stores end timestamp | interaction close persistence test | — |
| F21 | Mark incomplete — requires remarks | interaction incomplete validation test | — |
| F22 | Agent status change — all 4 values accepted | `agent-status.service.test` | `AgentStatusWidget` test |
| F23 | Agent status change — event logged with old/new status | agent-status audit test | — |
| F24 | Agent status change — UI waits for API before updating | — | optimistic update prevention test |

---

## Interaction event type checklist — all 10 must be verified in tests

Source: Phase doc C10, `input-requirements/CCM_Phase1_Agent_Interaction_Documentation.md`

| Event | Test that verifies it is written to DB |
|---|---|
| `interaction_created` | |
| `search_started` | |
| `search_result_returned` | |
| `customer_selected` | |
| `vehicle_selected` | |
| `dealer_loaded` | |
| `customer_reselected` | |
| `disposition_saved` | |
| `interaction_closed` | |
| `interaction_marked_incomplete` | |
| `agent_status_changed` | |

---

## API error code checklist — every protected endpoint must have negative tests

| Scenario | Expected status | Test required |
|---|---|---|
| No JWT cookie on protected route | 401 | Integration test |
| Wrong role (non-agent) on agent route | 403 | Integration test |
| Invalid request body | 422 | Integration test |
| Start interaction while one open | 409 | Integration test |
| Invalid CSRF token on mutation | 403 | Security integration test |

---

## Step 1 — Discover existing test files

```
Glob: pattern="**/__tests__/**/*.test.ts" path="apps/"
Glob: pattern="**/__tests__/**/*.test.tsx" path="apps/"
Glob: pattern="**/*.test.ts" path="apps/api/src"
Glob: pattern="**/*.test.tsx" path="apps/web/src"
```

List every test file found with its path.

---

## Step 2 — Map features to tests

For each feature in the Phase 1 feature checklist, search for a matching test:

```
Grep: pattern="concurrent|already have an open|409" path="apps/api/src"
Grep: pattern="interaction_created|search_started|customer_selected|disposition_saved|interaction_closed|agent_status_changed" path="apps/api/src/__tests__"
Grep: pattern="401|403|422" path="apps/api/src/__tests__"
Grep: pattern="remarksRequired|remarks.*mandatory|Incomplete Interaction" path="apps/web/src"
Grep: pattern="chassis.*mask|masked|chassisNumberMasked" path="apps/web/src"
```

---

## Step 3 — Produce gap report

For each feature in the checklist, mark it as:
- ✅ **COVERED** — test exists and exercises the scenario
- ⚠️ **PARTIAL** — test exists but only covers happy path; negative/edge case missing
- ❌ **MISSING** — no test exists for this scenario

Output the gap report in this format:

```
TEST GAP REPORT — CCM Phase 1
==============================

Scan date: [today]
Total test files found: [n backend] backend, [n frontend] frontend

FEATURE COVERAGE:
F1  Agent login valid         ✅/⚠️/❌  [evidence or gap]
F2  Agent login invalid       ✅/⚠️/❌  [evidence or gap]
...

INTERACTION EVENT COVERAGE:
interaction_created           ✅/⚠️/❌  [file:line or MISSING]
search_started                ✅/⚠️/❌
...

API ERROR CODE COVERAGE:
401 on protected routes       ✅/⚠️/❌  [file or MISSING]
403 wrong role                ✅/⚠️/❌
409 concurrent interaction    ✅/⚠️/❌
422 invalid body              ✅/⚠️/❌
403 invalid CSRF              ✅/⚠️/❌

SUMMARY:
- Covered: [n]
- Partial: [n]
- Missing: [n]
- Coverage estimate: [n]% of Phase 1 scenarios

PRIORITY GAPS (must fix before phase closeout):
1. [highest risk missing test]
2. ...
```

---

## Step 4 — Route to qa-engineer

If any MISSING or PARTIAL items exist, invoke the `qa-engineer` agent with:
1. The full gap report
2. The list of test files already present (so the agent knows what to extend vs. create)
3. A request to: write or extend tests for every MISSING and PARTIAL item, prioritising by risk (security/auth gaps first, state machine gaps second, audit event gaps third)
4. Instruction to target the 80% threshold required by `testing-strategy.md`

If all items are COVERED, present the clean report and state: "Phase 1 test coverage meets documented requirements. No gaps identified."

---

## Hard rules

- Do not write tests yourself. Gap identification is this skill's job; qa-engineer writes the tests.
- Do not mark a feature as COVERED unless you found a test that actually exercises the documented scenario, not just a test that imports the module.
- Run this skill before every gate review and whenever the qa-engineer completes a test writing task.
