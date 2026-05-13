# Customer Contact Management (CCM) Application — Scope and Capability Overview

## Purpose

The CCM application is a workflow-driven platform for managing inbound customer contacts in the automotive domain. It enables agents and operational teams to capture customer interactions, identify customer and vehicle context, create and manage service-related cases, assign work to Dealers or Head Office (HO) teams, track follow-ups, and govern SLAs and escalations.

## Business Objective

CCM is intended to become the central operational layer for inbound customer contact handling. It will provide a structured, auditable, and scalable way to manage customer issues from first contact through resolution, while integrating with enterprise master and transactional systems.

## Current Scope

The current scope is focused on voice inbound handling with a dual operating model: manual interaction handling and CTI-assisted (TeleCMI) interaction handling. CTI integration is implemented and operational. Manual mode and CTI mode co-exist and are selected per-session at login.

The application will support four core user personas:

- **Agent** — handles inbound customer contacts
- **Supervisor** — monitors queues, reassigns work, manages escalations
- **Dealer** — receives assigned cases and performs execution/update activities
- **Head Office (HO) User** — handles escalated, exceptional, or centrally managed work

## Core Capabilities in CCM

CCM will support the following functional capabilities:

### 1. Interaction Handling

- Capture every inbound customer contact as an interaction
- Support manual interaction handling (agent creates interaction manually)
- Support CTI-assisted interaction handling via TeleCMI telephony integration (implemented)
- Capture structured disposition and outcome for each interaction
- Enforce wrap-up completion before returning agent to ready state in CTI mode

### 2. Customer, Vehicle, and Dealer Context

- Search and retrieve customer, vehicle, dealer, and install base context
- Use enterprise master data to identify the active customer/vehicle relationship
- Present relevant contextual information to support call handling

### 3. Service Case Management

- Create and manage service-related cases such as complaints, queries requiring action, suggestions requiring follow-up, and escalation scenarios
- Track case lifecycle from creation to closure
- Maintain ownership, status, activity trail, and resolution history

### 4. Assignment and Ownership Transfer

- Route work across Agent, Dealer, Supervisor, and HO teams
- Support controlled queue-based assignment
- Track ownership changes and reassignment reasons

### 5. Follow-ups and Resolution Activities

- Create and track follow-up tasks such as callbacks and pending actions
- Log structured activities taken toward resolution
- Ensure case progress is auditable and operationally visible

### 6. SLA and Escalation Management

- Apply SLA policies to service cases
- Track timelines for assignment, follow-up, and resolution
- Escalate delayed or sensitive cases to Supervisor/HO as required

### 7. Operational Work Queues

- Provide user-specific and role-specific work queues
- Support operational monitoring of open, overdue, escalated, and pending work
- Enable Supervisor oversight of team workload and exceptions

### 8. Auditability and Event History

- Maintain timestamped history of important workflow events
- Reconstruct who did what, when, and why
- Reduce dependency on free-text-only tracking

## Phase 1.5 Additions (Authorized)

The following capabilities are added to the in-scope set for Phase 1.5. Each item is system-designed, not future-phase speculation.

### Agent Status Extensions

Two new agent statuses are introduced. Both are **system-managed** — they are set by automated CTI event processing and are not selectable by the agent from the status picker.

| Status | Set by | Cleared by |
|---|---|---|
| `on_call` | TeleCMI `started` live event AND `session_mode = 'cti'` | TeleCMI `hangup` live event (transitions to `wrap_up`) |
| `wrap_up` | TeleCMI `hangup` live event AND `session_mode = 'cti'` | Agent submits/closes the wrap-up interaction (transitions to `ready_for_calls`) |

These statuses are not applicable in manual mode. In manual mode the agent controls their own status transitions through the existing status picker.

### Session Mode

A `session_mode` field is stored on the agent profile (persisted in the `users` table). It records which operating mode the agent selected at their most recent login.

| Value | Meaning |
|---|---|
| `'manual'` | Agent manages interactions and status manually |
| `'cti'` | Interactions and status transitions are driven by TeleCMI telephony events |
| `NULL` | Not yet selected (pre-login state or legacy row) |

Rules:
- Mode is selected via a dialog presented on every login, before the agent reaches the workspace.
- Mode resets to `NULL` on logout so the choice is re-prompted on the next login.
- Only `session_mode = 'cti'` activates any CTI-driven auto-transition behavior.

### Proactive Caller Pre-fetch

When a TeleCMI `waiting` live event is received (call is ringing, not yet answered), the system performs a background customer lookup using the caller's CLI. The result is held in memory so it is immediately available when the agent accepts the call.

### Wrap-up Enforcement (CTI mode only)

When an agent is in `wrap_up` status (CTI mode only), the system locks the workspace to the wrap-up interaction. The agent cannot change status, start new interactions, or navigate away until the wrap-up interaction is closed (submitted). On close, the system automatically transitions the agent to `ready_for_calls`.

### Interactions List Page

A read-only interactions list page is available to agents with the `agent` role. It shows all interactions across all agents for all time, filtered to `INCOMPLETE` and `COMPLETE` statuses only. No create/edit actions are available on this page.

---

## Enterprise Integrations

CCM will integrate with external systems through an MCP-based integration layer.

### Vahan Portal (master/reference data)

Planned source for:

- Dealer Master
- Customer Master
- Vehicle Master
- Install Base
- Picklist Master
- User Master
- Other future reference masters as needed

### iDMS (transactional data)

Planned source for:

- Relevant transactional/service context
- Historical operational/service information needed during case handling

## Future Scope

The following capabilities are expected in later phases:

- Sales enquiry / lead management when CRM capabilities are introduced
- Advanced reporting and analytics
- Richer productivity and monitoring capabilities
- Supervisor escalation routing and queue management dashboards

## Out of Scope for Current Phase

- Active sales lead workflow
- Advanced analytics and dashboards
- Full CRM functionality
- Broad reporting suite
- Supervisor, HO, or reporting dashboards

## Design Principle

CCM will act as the workflow and operational system of record, while external systems such as Vahan and iDMS will provide master and transactional context through controlled integrations.
