---
name: scope-drift-check
description: Scan all implementation files for Phase 2+ behavior that has crept into Phase 1 code. Detects out-of-scope fields, routes, components, statuses, and business logic. Routes confirmed drift findings to the product-owner agent for judgment.
---

You are executing the `/scope-drift-check` skill for the CCM project.

## What this skill does

Scans the entire codebase against the Phase 1 scope boundary defined in:
- `input-requirements/ccm-scope.md`
- `input-requirements/CCM_Phase1_Agent_Interaction_Documentation.md`
- `CLAUDE.md` (Out of scope now section)

Produces a classified drift report and routes confirmed out-of-scope findings to the `product-owner` agent for disposition.

---

## Phase 1 scope boundary — reference

### IN SCOPE (Phase 1)
Agent login, workspace access, manual interaction start, customer search (Mobile/RegNo/Name/Email), customer/vehicle/dealer context retrieval, search result selection and disambiguation, reselect, interaction disposition and closure, incomplete interaction handling, interaction event logging, agent status management (Ready/Break/Offline/Training).

### OUT OF SCOPE (Phase 1) — drift patterns to detect
- Case creation / case management
- Follow-up tasks / callbacks
- Resolution activities
- SLA tracking / SLA breach / SLA policy
- Escalation handling / escalation queue
- Supervisor workflow / supervisor dashboard
- Dealer workflow / dealer portal / dealer assignment
- Head Office (HO) workflow
- Contact creation inside CCM
- Sales enquiry / lead management / CRM
- Analytics / dashboards / reporting / metrics charts
- Customer 360 / case history panel

---

## Step 1 — Scan backend for out-of-scope patterns

Search the backend source (`apps/api/src/`) for each pattern group:

### Case management
```
Grep: pattern="case_id|caseId|case_number|createCase|CaseModule|/cases" path="apps/api/src"
```

### SLA / escalation
```
Grep: pattern="sla_|SlaService|escalat|breachAt|dueDate|overdue" path="apps/api/src"
```

### Supervisor / Dealer / HO workflows
```
Grep: pattern="supervisor|dealer_assign|HO_|head_office|reassign_queue|transferToDealer" path="apps/api/src"
```

### Contact creation
```
Grep: pattern="createContact|contact_creation|POST.*contacts" path="apps/api/src"
```

### Analytics / reporting
```
Grep: pattern="analytics|dashboard_metric|report_export|chart_data|aggregate_stat" path="apps/api/src"
```

---

## Step 2 — Scan frontend for out-of-scope patterns

```
Grep: pattern="CasePanel|SlaTimer|EscalationBadge|SupervisorView|DealerAssign|AnalyticsChart|Customer360|CaseHistory|SalesEnquiry|LeadCapture|CallTimer|DialerWidget" path="apps/web/src"
```

Also check for out-of-scope routes:
```
Grep: pattern="path=\"/cases|path=\"/supervisor|path=\"/dealer|path=\"/escalations|path=\"/analytics|path=\"/sales" path="apps/web/src"
```

---

## Step 3 — Classify each finding

For every match found, classify it as:

| Classification | Meaning |
|---|---|
| **CONFIRMED DRIFT** | Clearly implements Phase 2+ business logic — must be removed or deferred |
| **INFRASTRUCTURE STUB** | Code exists as an empty stub or future-ready seam without business logic — acceptable with documentation |
| **FALSE POSITIVE** | Pattern match is coincidental — not actually out-of-scope behavior |
| **AMBIGUOUS** | Unclear — needs product-owner judgment |

Note the file path, line number, classification, and one-line reason for each finding.

---

## Step 4 — Produce drift report

Output the following report:

```
SCOPE DRIFT REPORT — CCM Phase 1
==================================

Scan date: [today]
Files scanned: [count]

CONFIRMED DRIFT (requires action):
- [file:line] [pattern matched] — [what it does] — Owner: [backend-engineer or frontend-engineer]

INFRASTRUCTURE STUBS (acceptable — verify intent):
- [file:line] [what it is] — [why it is acceptable as a stub]

AMBIGUOUS (needs product-owner judgment):
- [file:line] [pattern] — [why it is unclear]

FALSE POSITIVES: [count] — not listed

OVERALL ASSESSMENT:
- Confirmed drift count: [n]
- Action required: [yes/no]
```

---

## Step 5 — Route confirmed drift to product-owner

If any CONFIRMED DRIFT or AMBIGUOUS items exist, invoke the `product-owner` agent with:
1. The full drift report from Step 4
2. The specific files and lines containing the drift
3. A request for: (a) disposition of each item, (b) whether removal is required before the next gate review, (c) whether any item should be reclassified as an acceptable stub

If no confirmed drift exists, present the clean report to the user and state: "No Phase 2+ drift detected in current implementation."

---

## Hard rules

- Do not remove drift yourself. The product-owner agent decides disposition; the named engineer implements removal.
- Do not mark an item as false positive without a stated reason.
- Run this skill before every gate review and whenever a significant new module or feature is added.
