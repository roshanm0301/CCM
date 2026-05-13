# Architecture Principles

## Purpose
This document defines the architecture principles for CCM so Claude agents make compatible technical decisions across frontend, backend, data, security, and delivery.

## Agents that use this document
| Agent | How it is used |
|---|---|
| Solution Architect Agent | Governs system decomposition and decision quality |
| Backend Engineer Agent | Designs services, module boundaries, persistence, and integration seams |
| Frontend Engineer Agent | Aligns UI structure with backend contracts and state boundaries |
| DevOps Engineer Agent | Supports deployment/runtime topology that matches the architecture |
| QA Engineer Agent | Validates architecture through test coverage and non-functional checks |

## Scope guardrail
This document governs cross-phase technical design. It must not be used to add missing business logic.

## Principles

### 1. Modular monolith first, service-ready seams always
Start with a **modular monolith backend** in TypeScript unless scale, deployment independence, or ownership requires service extraction later.

Why:
- lower operational overhead for early phases,
- simpler transactions and auditing,
- easier local development,
- easier coordination for multi-agent implementation.

Requirement:
- modules must be isolated by domain boundaries,
- APIs between modules must be explicit,
- internal contracts must remain extractable later.

### 2. Separate transactional truth from flexible integration documents
Use:
- **PostgreSQL** for transactional and relational truth,
- **MongoDB** for flexible, document-oriented read models, raw integration payloads, or schematically variable operational documents when justified.

Do not duplicate authoritative writes across both stores without a clear ownership rule.

### 3. Workflow system of record, external systems as context providers
CCM owns its workflow and audit state.
External systems provide:
- master/reference context,
- transactional context,
- future telephony events.

Local snapshots may be stored for traceability, performance, or resilience, but source ownership must remain explicit.

### 4. Explicit boundaries around integrations
External systems must be accessed through adapter layers.
No feature module should call external systems directly.

Required layers:
- application service,
- integration port,
- adapter/client,
- mapping/normalization,
- resilience handling.

### 5. API contracts are versioned and typed
All backend contracts must be:
- typed,
- versioned,
- documented,
- backward-compatible within a release window,
- validated at runtime for external inputs.

### 6. Event and audit thinking from day one
All key workflow transitions must be reconstructible.
Architecture must support:
- event capture,
- actor tracking,
- timestamps,
- correlation IDs,
- request tracing.

### 7. Security and privacy by default
Sensitive data must be:
- access-controlled,
- masked in UI where appropriate,
- minimized in logs,
- encrypted in transit,
- protected in storage and backups.

### 8. Fail clearly, degrade safely
When upstream systems fail:
- the system must surface the impact clearly,
- partial failure handling must be explicit,
- retry paths must exist where safe,
- critical workflow data must not be lost silently.

### 9. Frontend is a thin orchestration layer, not a rules engine
The frontend can manage presentation state and user interaction flow.
It must not become the authoritative layer for:
- workflow state transitions,
- permission logic,
- data validation that belongs to backend trust boundaries,
- audit decisions.

### 10. Shared foundations before feature proliferation
Before adding more workflow depth, establish:
- design system,
- coding conventions,
- test strategy,
- observability,
- deployment model,
- security baseline.

### 11. Phase-safe extensibility
Current architecture must support later phases, but later phases must not dictate current implementation complexity.
Use extension points, not speculative builds.

### 12. Documentation is part of the architecture
If a module, API, or workflow cannot be clearly described, it is not ready for implementation. Every architectural decision must be discoverable by future agents.

## Required architecture qualities
- traceable
- testable
- observable
- evolvable
- least-surprise
- low-ambiguity
- low-hidden-coupling

## Mandatory decision filters
Before accepting an architecture decision, ask:
1. Does it reduce ambiguity for future agents?
2. Does it keep phase 1 simpler without blocking phase 2?
3. Does it preserve transactional integrity?
4. Does it make auditability and debugging easier?
5. Does it avoid coupling UI behavior to upstream integration quirks?
