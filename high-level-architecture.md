# High-Level Architecture

## Purpose
This document defines the target high-level architecture for CCM using the fixed stack:
- React + Material UI + TypeScript
- Node.js + TypeScript
- PostgreSQL
- MongoDB
- Dockerized deployment with Docker Compose support

## Agents that use this document
| Agent | How it is used |
|---|---|
| Solution Architect Agent | Finalizes module decomposition and runtime structure |
| Backend Engineer Agent | Implements modules, data access, and integration adapters |
| Frontend Engineer Agent | Aligns UI state and API consumption model |
| DevOps Engineer Agent | Builds container topology and environment promotion flow |
| QA Engineer Agent | Plans integration and environment validation |

## Architectural stance
Recommended implementation model:
- **Frontend SPA** served independently
- **Backend modular monolith** exposing HTTP APIs
- **PostgreSQL** for workflow and relational truth
- **MongoDB** for flexible read models/integration payload retention where justified
- **Adapter-based integration layer** for external systems
- **Structured audit/event trail** for operational traceability

## Context diagram
```text
+--------------------+         +-------------------------------+
|   Agent User       | <-----> |      React Web Application   |
+--------------------+         +---------------+---------------+
                                                |
                                                | HTTPS / JSON
                                                v
                                 +--------------+---------------+
                                 |      CCM Backend API         |
                                 |  Node.js + TypeScript        |
                                 |  Modular Monolith            |
                                 +------+------------+----------+
                                        |            |
                      SQL transactions   |            | Document / flexible persistence
                                        v            v
                               +--------+--+     +---+---------+
                               | PostgreSQL |    |  MongoDB    |
                               +-----------+    +-------------+
                                        |
                                        | Adapter layer / MCP-based integration
                                        v
    +----------------+    +---------------------+
    | Vahan masters  |    | iDMS transaction    |
    | reference data |    | service context     |
    +----------------+    +---------------------+
```

## Backend module view
```text
/backend
  /src
    /modules
      /auth
      /interaction
      /search
      /context
      /audit
      /master-data
      /integration
      /health
    /shared
      /config
      /errors
      /logging
      /security
      /validation
      /database
```

## Recommended logical modules

### 1. Auth module
Responsibilities:
- authentication entrypoint,
- session or token validation,
- role and permission resolution,
- user identity context for auditing.

### 2. Interaction module
Responsibilities:
- create interaction,
- track state transitions,
- store wrap-up,
- close or mark incomplete,
- expose interaction lifecycle APIs.

### 3. Search module
Responsibilities:
- input normalization,
- invoke search connectors,
- store search attempts,
- return standardized result objects,
- support ambiguity handling.

### 4. Context module
Responsibilities:
- load customer, vehicle, and dealer context,
- compose context response,
- manage snapshot/read model behavior if required.

### 5. Audit module
Responsibilities:
- capture event records,
- persist actor/timestamp/correlation metadata,
- expose audit trail APIs as needed.

### 6. Master-data module
Responsibilities:
- controlled values used by the application,
- synchronization or local caching strategies for reference data where approved.

### 7. Integration module
Responsibilities:
- external client interfaces,
- retries/timeouts/circuit-breaker policy integration,
- mapping between external payloads and internal DTOs.

## Request handling flow
```text
HTTP Request
  -> Controller / Route
  -> Request validation
  -> Application service
  -> Domain/module orchestration
  -> Repository and/or integration port
  -> Persistence / adapter call
  -> Response mapper
  -> Structured response
  -> Audit/log emission
```

## Frontend architecture
Recommended structure:
```text
/frontend
  /src
    /app
    /pages
    /features
    /widgets
    /entities
    /shared
      /api
      /ui
      /hooks
      /utils
      /theme
```

### Frontend responsibilities
- route composition,
- UI state,
- API invocation,
- optimistic behavior only when safe,
- standardized loading/error/empty states,
- no hidden business rules.

### Frontend state model
Prefer:
- server state handled via a query library,
- local UI state for transient screen behavior,
- minimal global state,
- clear boundary between selected context, search state, and session state.

## Data ownership model
| Data category | System of record | Local storage rule |
|---|---|---|
| Interaction lifecycle | CCM PostgreSQL | Authoritative local write |
| Audit events | CCM PostgreSQL or approved audit store | Authoritative local write |
| Controlled master values used by UI | External source or approved CCM reference cache | Cache/sync with ownership declared |
| Customer/vehicle/dealer source truth | External enterprise master | Local snapshot only when needed |
| Raw integration payloads | External source origin | Retain in MongoDB only when justified and governed |

## Runtime deployment view
```text
[Browser]
   |
   v
[Frontend Container]
   |
   v
[API Container] ---> [PostgreSQL Container]
       |
       +-----------> [MongoDB Container]
```

Optional dev-only utilities:
- pgAdmin
- mongo-express
- mock adapter service or stub data provider

## Resilience requirements
- health endpoints for liveness/readiness
- timeout and retry policy for external adapters
- correlation ID propagation
- graceful degradation for non-critical upstream failures
- audit-safe failure handling

## Evolution path
Phase 1 does not require microservices.
Future extraction candidates only if justified:
- interaction service
- integration gateway
- reporting/analytics pipeline

Do not extract early unless:
- release cadence differs materially,
- scaling characteristics diverge,
- ownership boundaries become independent.
