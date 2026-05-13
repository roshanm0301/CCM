# CCM Phase 1 — Technical Implementation Blueprint

**Version:** 1.0
**Date:** 2026-03-22
**Authority:** Solution Architect Agent
**Audience:** Backend Engineer Agent, Frontend Engineer Agent, QA Engineer Agent
**Phase:** Phase 1 — Agent Interaction Foundation

---

## 1. Problem Framing

CCM Phase 1 is built from zero application code. The design system (139 React/TypeScript components) exists as a library. All business data lives in external systems (Vahan Install Base, Customer Master, iDMS). CCM owns only the workflow, audit trail, and session state.

The core tension to resolve is: external systems are the source of truth for customer/vehicle/dealer data, but CCM must produce an auditable, self-contained record of every interaction. That means the system must be resilient to upstream adapter failures without losing the interaction lifecycle record, and it must snapshot enough context to reconstruct what was shown to the agent at the time of the interaction.

The eleven Phase 1 features decompose into four runtime concerns:

1. **Identity and session** — login, role check, token lifecycle, logout.
2. **Interaction lifecycle** — create, state machine, wrapup, close, incomplete.
3. **Search and context** — federated search across two adapters, disambiguation, three context cards.
4. **Audit trail** — append-only event log for every workflow transition.

---

## 2. Architecture Decision

**Selected model:** Modular monolith backend (Node.js + TypeScript + Express), single-page application frontend (React 18 + Vite + MUI v6 + TypeScript), PostgreSQL as the sole authoritative store for Phase 1, MongoDB wired but empty until justified.

**Rationale against alternatives:**

- Microservices are not justified. There is no independent release cadence, no separate scaling requirement, and no independent team ownership for any slice of Phase 1.
- MongoDB is wired but unused as the authoritative store. The only candidates for Phase 1 are raw integration payload retention (low value, diagnostic only) and context read models (not needed — snapshots fit cleanly in PostgreSQL JSONB). Both can wait.
- Event bus / message queue: not required. Audit writes are synchronous within the same transaction scope or written as a closely coupled follow-on write. The NFR specifies "synchronous or durable queued persistence within 5 seconds" — synchronous in-process write satisfies this.

---

## 3. Monorepo Layout

```
/
  /apps
    /web                  React 18 + Vite + MUI v6 + TypeScript SPA
    /api                  Node.js + Express + TypeScript modular monolith
  /packages
    /types                Shared DTOs, enums, event name constants
    /ui                   Design system component library (existing 139 components)
    /config               Shared ESLint, Prettier, tsconfig bases
    /eslint-config        ESLint rules package
    /tsconfig             Base tsconfig files
  /docs
    /phase1-technical-blueprint.md   (this file)
  /infra
    docker-compose.yml
    docker-compose.override.yml     (dev-only: pgAdmin, mongo-express)
```

---

## 4. Backend Module Boundaries

### 4.1 Module Map

```
/apps/api/src/modules/
  /auth
  /interaction
  /search
  /context
  /audit
  /master-data
  /integration
  /health
/apps/api/src/shared/
  /config
  /database
  /errors
  /logging
  /security
  /validation
  /middleware
```

### 4.2 Module Ownership Rules

#### auth
- Owns: login, logout, token generation and validation, CSRF token issuance, user identity resolution, role and permission lookup.
- Must NOT: access interaction data, perform searches, touch audit events directly.
- Calls: `shared/database` (user/role/permission reads), `shared/security` (token ops), `shared/logging`.
- Dependency direction: inward only — no other module calls auth internals. Other modules receive a resolved `ActorContext` from shared middleware.

#### interaction
- Owns: interaction CRUD, state machine enforcement, wrapup persistence, close, mark incomplete, interaction context reference updates.
- Must NOT: call external adapters directly, perform search logic, issue tokens.
- Calls: `audit` (event writes), `shared/database`, `shared/errors`, `shared/validation`.
- Dependency direction: calls `audit`. Does not call `search`, `context`, or `integration`.

#### search
- Owns: input normalization, filter validation, adapter orchestration (Install Base first, Customer Master fallback), search attempt persistence, result standardization.
- Must NOT: update interaction status directly, persist context snapshots, issue tokens.
- Calls: `integration` (adapter calls), `audit` (search_started, search_result_returned events), `shared/database` (search_attempts write), `shared/validation`.
- Dependency direction: calls `integration` and `audit`. Does not call `interaction` or `context`.

#### context
- Owns: composing customer, vehicle, and dealer context responses from adapter data, context snapshot writes, chassis masking.
- Must NOT: perform search, update interaction status directly, authenticate.
- Calls: `integration` (adapter calls for context retrieval), `shared/database` (context_snapshot writes), `audit` (customer_selected, vehicle_selected, dealer_loaded events).
- Dependency direction: calls `integration` and `audit`. Does not call `search` or `interaction` directly. The interaction module calls context indirectly through the API layer.

#### audit
- Owns: interaction_events table writes and reads (future), structured event construction.
- Must NOT: own business logic, mutate interaction state, call external adapters.
- Calls: `shared/database` only.
- Dependency direction: leaf module. No module-level dependency on anything except database.

#### master-data
- Owns: reference_values table reads, controlled value lists served to the API.
- Must NOT: call external adapters for Phase 1 (values are seeded locally), mutate interaction state.
- Calls: `shared/database`.
- Dependency direction: leaf module.

#### integration
- Owns: all adapter client instances and contracts, retry/timeout policy, payload mapping, mock adapter implementations for Phase 1.
- Must NOT: contain business logic, write to the database, decide search strategy.
- Calls: external HTTP endpoints (or mock in-process stubs for Phase 1), `shared/logging`.
- Dependency direction: called by `search` and `context`. Does not call any feature module.

#### health
- Owns: liveness and readiness probe endpoints.
- Calls: `shared/database` (readiness check — can it reach PostgreSQL).
- Dependency direction: leaf, no feature module dependencies.

---

## 5. REST API Contract

### Conventions

- All routes prefixed `/api/v1`.
- All responses follow the standard envelope:

```typescript
// Success
interface ApiSuccess<T> {
  success: true;
  data: T;
  correlationId: string;
}

// Error
interface ApiError {
  success: false;
  error: {
    code: string;       // machine-readable, e.g. "VALIDATION_ERROR"
    message: string;    // human-readable, safe for display
    details?: unknown;  // validation field errors only, never stack traces
  };
  correlationId: string;
}
```

- Auth required = valid httpOnly JWT cookie + CSRF header token on mutating requests.
- Role required = `AGENT` for all Phase 1 endpoints unless marked otherwise.
- HTTP 401 = unauthenticated (no valid session).
- HTTP 403 = authenticated but wrong role or insufficient permission.
- HTTP 422 = validation failure (business rule violation, not schema error).
- HTTP 400 = malformed request body.
- HTTP 500 = internal error (no details exposed to client).

---

### 5.1 POST /api/v1/auth/login

**Auth required:** No
**CSRF:** Not required (login is the CSRF token issuance point)

**Request:**
```typescript
interface LoginRequest {
  username: string;   // mandatory
  password: string;   // mandatory
}
```

**Response 200:**
```typescript
interface LoginResponse {
  user: {
    id: string;
    username: string;
    displayName: string;
    role: 'AGENT';
  };
  csrfToken: string;  // double-submit CSRF token, returned in body
}
```
Sets `ccm_session` httpOnly cookie on success.

**Business rules enforced:**
- Username and password must be non-empty.
- User must exist and be ACTIVE status.
- User must have AGENT role.
- Failed login does not reveal whether username or password was wrong.

**Error responses:**
| Status | Code | Condition |
|--------|------|-----------|
| 400 | VALIDATION_ERROR | Missing username or password |
| 401 | AUTH_FAILED | Invalid credentials |
| 401 | ACCOUNT_INACTIVE | User account is not active |
| 403 | ROLE_NOT_AGENT | User role is not AGENT |
| 500 | AUTH_SERVICE_ERROR | Internal authentication failure |

---

### 5.2 POST /api/v1/auth/logout

**Auth required:** Yes
**CSRF:** Required (X-CSRF-Token header)

**Request:** No body.

**Response 200:**
```typescript
interface LogoutResponse {
  message: string; // "Signed out successfully."
}
```
Clears `ccm_session` cookie.

**Business rules enforced:**
- If no valid session exists, still returns 200 (idempotent, safe).
- Logout event is written to audit trail.

**Error responses:**
| Status | Code | Condition |
|--------|------|-----------|
| 401 | UNAUTHENTICATED | No valid session (still clears cookie) |
| 500 | LOGOUT_ERROR | Internal failure |

---

### 5.3 GET /api/v1/auth/me

**Auth required:** Yes
**CSRF:** Not required (read-only)

**Response 200:**
```typescript
interface MeResponse {
  id: string;
  username: string;
  displayName: string;
  role: 'AGENT';
  defaultAgentStatus: AgentStatus;
}
```

**Error responses:**
| Status | Code | Condition |
|--------|------|-----------|
| 401 | UNAUTHENTICATED | No valid session |

---

### 5.4 GET /api/v1/agent/status

**Auth required:** Yes
**CSRF:** Not required (read-only)

**Response 200:**
```typescript
interface AgentStatusResponse {
  userId: string;
  currentStatus: AgentStatus;
  updatedAt: string; // ISO 8601
}
```

**Error responses:**
| Status | Code | Condition |
|--------|------|-----------|
| 401 | UNAUTHENTICATED | No valid session |
| 404 | STATUS_NOT_FOUND | No status record found |

---

### 5.5 PATCH /api/v1/agent/status

**Auth required:** Yes
**CSRF:** Required

**Request:**
```typescript
interface UpdateAgentStatusRequest {
  status: AgentStatus; // enum: READY_FOR_CALLS | BREAK | OFFLINE | TRAINING
}
```

**Response 200:**
```typescript
interface AgentStatusResponse {
  userId: string;
  currentStatus: AgentStatus;
  updatedAt: string;
}
```

**Business rules enforced:**
- Status must be one of the four controlled values.
- Status change is audit-logged (agent_status_changed event).
- Any status transition is permitted in Phase 1 (no transition guard table yet).

**Error responses:**
| Status | Code | Condition |
|--------|------|-----------|
| 400 | VALIDATION_ERROR | Invalid status value |
| 401 | UNAUTHENTICATED | No valid session |
| 422 | INVALID_STATUS | Status value not in controlled list |

---

### 5.6 POST /api/v1/interactions

**Auth required:** Yes
**CSRF:** Required

**Request:** No body. All values are system-derived.

**Response 201:**
```typescript
interface CreateInteractionResponse {
  interactionId: string;
  status: InteractionStatus;  // 'IDENTIFYING'
  channel: 'VOICE';
  mode: 'MANUAL';
  startedAt: string;
}
```

**Business rules enforced:**
- Channel is fixed `VOICE`. Mode is fixed `MANUAL`.
- Interaction is created with status `NEW` then immediately transitioned to `IDENTIFYING`.
- `interaction_created` event written.
- Agent must have `INTERACTION_CREATE` permission.

**Error responses:**
| Status | Code | Condition |
|--------|------|-----------|
| 401 | UNAUTHENTICATED | No valid session |
| 403 | FORBIDDEN | Agent lacks create permission |
| 500 | INTERACTION_CREATE_ERROR | Persistence failure |

---

### 5.7 GET /api/v1/interactions/:id

**Auth required:** Yes
**CSRF:** Not required (read-only)

**Response 200:**
```typescript
interface InteractionDetailResponse {
  id: string;
  status: InteractionStatus;
  channel: 'VOICE';
  mode: 'MANUAL';
  startedAt: string;
  endedAt: string | null;
  completionFlag: boolean | null;
  currentCustomerRef: string | null;
  currentVehicleRef: string | null;
  currentDealerRef: string | null;
  correlationId: string;
  wrapup: InteractionWrapupDto | null;
  events: InteractionEventDto[];
}
```

**Business rules enforced:**
- Agent may only fetch interactions they own (`started_by_user_id = actor.id`).

**Error responses:**
| Status | Code | Condition |
|--------|------|-----------|
| 401 | UNAUTHENTICATED | No session |
| 403 | FORBIDDEN | Not the owning agent |
| 404 | INTERACTION_NOT_FOUND | No interaction with this ID |

---

### 5.8 PATCH /api/v1/interactions/:id/context

**Auth required:** Yes
**CSRF:** Required

**Purpose:** Updates the selected customer, vehicle, and dealer references on the interaction and moves status to `CONTEXT_CONFIRMED` when all required selections are present. Also handles reselection (same endpoint, called again with new refs).

**Request:**
```typescript
interface UpdateInteractionContextRequest {
  customerRef: string;          // mandatory
  vehicleRef: string | null;    // null when no vehicle linked
  dealerRef: string | null;     // null when dealer not resolved
  isReselection: boolean;       // true when replacing a prior context selection
}
```

**Response 200:**
```typescript
interface UpdateInteractionContextResponse {
  interactionId: string;
  status: InteractionStatus;
  currentCustomerRef: string;
  currentVehicleRef: string | null;
  currentDealerRef: string | null;
  updatedAt: string;
}
```

**Business rules enforced:**
- Interaction must be in `IDENTIFYING` or `CONTEXT_CONFIRMED` state to accept context update.
- `customerRef` is mandatory.
- When `isReselection = true`, writes `customer_reselected` event and replaces all three refs.
- When `isReselection = false`, writes `customer_selected` and (if vehicleRef present) `vehicle_selected` and (if dealerRef present) `dealer_loaded` events.
- Status is set to `CONTEXT_CONFIRMED` on successful context update.
- A context snapshot is written to `context_snapshots` with `snapshot_type = 'combined'`.

**Error responses:**
| Status | Code | Condition |
|--------|------|-----------|
| 400 | VALIDATION_ERROR | customerRef missing |
| 401 | UNAUTHENTICATED | No session |
| 403 | FORBIDDEN | Not the owning agent |
| 404 | INTERACTION_NOT_FOUND | Interaction does not exist |
| 422 | INVALID_STATE_TRANSITION | Interaction is not in a state that permits context update |

---

### 5.9 PATCH /api/v1/interactions/:id/wrapup

**Auth required:** Yes
**CSRF:** Required

**Purpose:** Saves or updates the wrap-up data. Moves interaction to `WRAPUP` state on first call.

**Request:**
```typescript
interface SaveWrapupRequest {
  contactReasonCode: string;            // mandatory, must be in reference_values
  identificationOutcomeCode: string;    // mandatory, must be in reference_values
  interactionDispositionCode: string;   // mandatory, must be in reference_values
  remarks: string | null;              // mandatory for certain disposition codes
}
```

**Response 200:**
```typescript
interface SaveWrapupResponse {
  interactionId: string;
  status: InteractionStatus;  // 'WRAPUP'
  wrapup: InteractionWrapupDto;
}
```

**Business rules enforced:**
- Interaction must be in `IDENTIFYING` or `CONTEXT_CONFIRMED` or `WRAPUP` state.
- All three code fields must resolve to active reference values.
- Remarks are mandatory when `interactionDispositionCode` is one of: `NO_MATCH_FOUND`, `TECHNICAL_ISSUE`, `ABUSIVE_CALLER`, `INCOMPLETE_INTERACTION`, `OTHERS`.
- On first call: transition to `WRAPUP`, write `disposition_saved` event.
- On subsequent calls (update): overwrite wrapup record, write `disposition_saved` event again.

**Error responses:**
| Status | Code | Condition |
|--------|------|-----------|
| 400 | VALIDATION_ERROR | Missing mandatory fields |
| 401 | UNAUTHENTICATED | No session |
| 403 | FORBIDDEN | Not the owning agent |
| 404 | INTERACTION_NOT_FOUND | Interaction does not exist |
| 422 | INVALID_STATE_TRANSITION | Wrong state |
| 422 | REMARKS_REQUIRED | Remarks mandatory for selected disposition |
| 422 | INVALID_REFERENCE_VALUE | Code not in active reference list |

---

### 5.10 POST /api/v1/interactions/:id/close

**Auth required:** Yes
**CSRF:** Required

**Request:** No body.

**Response 200:**
```typescript
interface CloseInteractionResponse {
  interactionId: string;
  status: 'CLOSED';
  endedAt: string;
  completionFlag: true;
}
```

**Business rules enforced:**
- Interaction must be in `WRAPUP` state with a saved wrapup record.
- Disposition code must NOT be `INCOMPLETE_INTERACTION` (that route goes through `/incomplete`).
- Sets `ended_at`, sets `completion_flag = true`, sets status to `CLOSED`.
- Writes `interaction_closed` event.

**Error responses:**
| Status | Code | Condition |
|--------|------|-----------|
| 401 | UNAUTHENTICATED | No session |
| 403 | FORBIDDEN | Not the owning agent |
| 404 | INTERACTION_NOT_FOUND | Interaction does not exist |
| 422 | WRAPUP_INCOMPLETE | Wrapup not saved or incomplete |
| 422 | INVALID_STATE_TRANSITION | Not in WRAPUP state |

---

### 5.11 POST /api/v1/interactions/:id/incomplete

**Auth required:** Yes
**CSRF:** Required

**Request:** No body. Remarks must have been provided in the wrapup call before this endpoint is invoked.

**Response 200:**
```typescript
interface MarkIncompleteResponse {
  interactionId: string;
  status: 'INCOMPLETE';
  endedAt: string;
  completionFlag: false;
}
```

**Business rules enforced:**
- Interaction must be in `WRAPUP` state.
- Saved wrapup must have `interactionDispositionCode = 'INCOMPLETE_INTERACTION'`.
- Remarks must be present on the wrapup record (validated at wrapup save time).
- Sets `ended_at`, sets `completion_flag = false`, sets status to `INCOMPLETE`.
- Writes `interaction_marked_incomplete` event.

**Error responses:**
| Status | Code | Condition |
|--------|------|-----------|
| 401 | UNAUTHENTICATED | No session |
| 403 | FORBIDDEN | Not the owning agent |
| 404 | INTERACTION_NOT_FOUND | Interaction does not exist |
| 422 | WRAPUP_INCOMPLETE | Wrapup not saved |
| 422 | DISPOSITION_NOT_INCOMPLETE | Disposition is not INCOMPLETE_INTERACTION |
| 422 | INVALID_STATE_TRANSITION | Not in WRAPUP state |

---

### 5.12 POST /api/v1/search

**Auth required:** Yes
**CSRF:** Required

**Request:**
```typescript
interface SearchRequest {
  interactionId: string;
  filter: SearchFilter;  // enum: MOBILE | REGISTRATION_NUMBER | CUSTOMER_NAME | EMAIL
  value: string;
}
```

**Response 200:**
```typescript
interface SearchResponse {
  interactionId: string;
  searchAttemptId: string;
  filter: SearchFilter;
  normalizedValue: string;
  results: SearchResultItem[];
  resultCount: number;
  primarySourceUsed: 'INSTALL_BASE' | 'CUSTOMER_MASTER' | 'NONE';
  fallbackSourceUsed: boolean;
  outcomeStatus: SearchOutcomeStatus;  // RESULTS_FOUND | NO_RESULTS | PARTIAL | ERROR
}

interface SearchResultItem {
  customerRef: string;
  customerName: string;
  primaryMobile: string;
  email: string | null;
  vehicles: SearchResultVehicle[];
  sourceSystem: 'INSTALL_BASE' | 'CUSTOMER_MASTER';
}

interface SearchResultVehicle {
  vehicleRef: string;
  registrationNumber: string;
  modelName: string;
  variant: string;
  dealerRef: string | null;
}
```

**Business rules enforced:**
- Interaction must exist and be owned by the calling agent.
- Interaction must be in `IDENTIFYING` or `CONTEXT_CONFIRMED` state.
- Exactly one filter must be supplied.
- Minimum 3 characters after trimming.
- Per-filter normalization: MOBILE numeric-only, REGISTRATION_NUMBER uppercase alphanumeric, CUSTOMER_NAME alphabets+spaces, EMAIL lowercase format validation.
- Searches Install Base first. Falls back to Customer Master only if Install Base returns zero results.
- Raw and normalized values are stored in `search_attempts`.
- `search_started` event written at start. `search_result_returned` event written after results assembled.
- If both adapters fail, returns 200 with `outcomeStatus: ERROR` and empty results (does not 500 the client).

**Error responses:**
| Status | Code | Condition |
|--------|------|-----------|
| 400 | VALIDATION_ERROR | Missing filter or value |
| 401 | UNAUTHENTICATED | No session |
| 403 | FORBIDDEN | Not the owning agent or wrong state |
| 404 | INTERACTION_NOT_FOUND | Interaction does not exist |
| 422 | INVALID_FILTER | Filter not in controlled list |
| 422 | VALUE_TOO_SHORT | Value less than 3 characters |
| 422 | INVALID_MOBILE | Non-numeric mobile |
| 422 | INVALID_REGISTRATION | Invalid registration format |
| 422 | INVALID_NAME | Invalid name format |
| 422 | INVALID_EMAIL | Invalid email format |

---

### 5.13 GET /api/v1/context/customer/:ref

**Auth required:** Yes
**CSRF:** Not required (read-only)

**Response 200:**
```typescript
interface CustomerContextResponse {
  customerRef: string;
  contactName: string;
  primaryMobile: string;
  secondaryMobile: string | null;
  emailId: string | null;
  address: string | null;
  sourceSystem: string;
}
```

**Business rules enforced:**
- Agent must have an active interaction (session context checked).
- Chassis number masking does NOT apply to this endpoint (customer context only).
- Returns 404 with safe message if adapter cannot find the ref.

**Error responses:**
| Status | Code | Condition |
|--------|------|-----------|
| 401 | UNAUTHENTICATED | No session |
| 404 | CUSTOMER_NOT_FOUND | Ref not resolvable by adapter |
| 502 | UPSTREAM_UNAVAILABLE | Adapter timeout or failure |

---

### 5.14 GET /api/v1/context/vehicle/:ref

**Auth required:** Yes
**CSRF:** Not required (read-only)

**Response 200:**
```typescript
interface VehicleContextResponse {
  vehicleRef: string;
  modelName: string;
  variant: string;
  registrationNumber: string;
  chassisNumberMasked: string;   // last 4 chars visible, rest replaced with *
  soldOnDate: string | null;     // ISO 8601 date
  lastServiceDate: string | null;
  dealerRef: string | null;
  sourceSystem: string;
}
```

**Business rules enforced:**
- Chassis number must always be masked at this layer, regardless of what the adapter returns.
- Masking rule: show only last 4 characters, prefix with `****`.

**Error responses:**
| Status | Code | Condition |
|--------|------|-----------|
| 401 | UNAUTHENTICATED | No session |
| 404 | VEHICLE_NOT_FOUND | Ref not resolvable by adapter |
| 502 | UPSTREAM_UNAVAILABLE | Adapter timeout or failure |

---

### 5.15 GET /api/v1/context/dealer/:ref

**Auth required:** Yes
**CSRF:** Not required (read-only)

**Response 200:**
```typescript
interface DealerContextResponse {
  dealerRef: string;
  dealerName: string;
  dealerCode: string;
  branchName: string | null;
  asc: string | null;
  city: string | null;
  address: string | null;
  pinCode: string | null;
  dealerType: string | null;
  isActive: boolean;
  sourceSystem: string;
}
```

**Business rules enforced:**
- Missing dealer must not block the interaction. A 404 from this endpoint does not prevent interaction from proceeding.

**Error responses:**
| Status | Code | Condition |
|--------|------|-----------|
| 401 | UNAUTHENTICATED | No session |
| 404 | DEALER_NOT_FOUND | Ref not resolvable |
| 502 | UPSTREAM_UNAVAILABLE | Adapter failure |

---

### 5.16 GET /api/v1/master-data/:type

**Auth required:** Yes
**CSRF:** Not required (read-only)

**Path parameter `:type` valid values:**
- `search-filters`
- `contact-reasons`
- `identification-outcomes`
- `interaction-dispositions`
- `agent-statuses`

**Response 200:**
```typescript
interface MasterDataResponse {
  type: string;
  items: ReferenceValueDto[];
}

interface ReferenceValueDto {
  code: string;
  label: string;
  sortOrder: number;
  remarksRequired?: boolean; // only present for interaction-dispositions
}
```

**Business rules enforced:**
- Only `is_active = true` values are returned.
- Ordered by `sort_order` ascending.
- For `interaction-dispositions`, `remarksRequired: true` is set for: `NO_MATCH_FOUND`, `TECHNICAL_ISSUE`, `ABUSIVE_CALLER`, `INCOMPLETE_INTERACTION`, `OTHERS`.

**Error responses:**
| Status | Code | Condition |
|--------|------|-----------|
| 400 | INVALID_TYPE | Unknown type parameter |
| 401 | UNAUTHENTICATED | No session |

---

### 5.17 GET /api/v1/health/live

**Auth required:** No
**CSRF:** Not required

**Response 200:**
```json
{ "status": "ok", "timestamp": "2026-03-22T10:00:00Z" }
```

Response time target: under 200 ms. No database call.

---

### 5.18 GET /api/v1/health/ready

**Auth required:** No
**CSRF:** Not required

**Response 200:**
```typescript
interface ReadinessResponse {
  status: 'ready' | 'not_ready';
  checks: {
    postgres: 'ok' | 'error';
    mongodb: 'ok' | 'error';
  };
}
```

Returns 200 only when all critical dependencies are reachable. Returns 503 when not ready.

---

## 6. PostgreSQL Schema — Exact DDL

```sql
-- ============================================================
-- MIGRATION: 001_initial_schema.sql
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- Table: roles
-- ============================================================
CREATE TABLE roles (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  code        VARCHAR(50) NOT NULL UNIQUE,
  label       VARCHAR(100) NOT NULL,
  is_active   BOOLEAN     NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed
INSERT INTO roles (code, label) VALUES ('AGENT', 'Call Centre Agent');

-- ============================================================
-- Table: permissions
-- ============================================================
CREATE TABLE permissions (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  code        VARCHAR(100) NOT NULL UNIQUE,
  label       VARCHAR(200) NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed: Phase 1 permissions
INSERT INTO permissions (code, label) VALUES
  ('INTERACTION_CREATE',  'Create a new interaction'),
  ('INTERACTION_VIEW',    'View interaction details'),
  ('SEARCH_EXECUTE',      'Execute customer search'),
  ('CONTEXT_VIEW',        'View customer/vehicle/dealer context'),
  ('WRAPUP_SAVE',         'Save interaction wrap-up'),
  ('INTERACTION_CLOSE',   'Close an interaction'),
  ('AGENT_STATUS_CHANGE', 'Change own agent status');

-- ============================================================
-- Table: role_permissions (junction)
-- ============================================================
CREATE TABLE role_permissions (
  role_id       UUID NOT NULL REFERENCES roles(id)       ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

-- All AGENT permissions for Phase 1 (join via code)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.code = 'AGENT';

-- ============================================================
-- Table: users
-- ============================================================
CREATE TABLE users (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  username         VARCHAR(100) NOT NULL UNIQUE,
  display_name     VARCHAR(200) NOT NULL,
  password_hash    VARCHAR(255) NOT NULL,
  status           VARCHAR(20)  NOT NULL DEFAULT 'ACTIVE'
                     CHECK (status IN ('ACTIVE', 'INACTIVE', 'LOCKED')),
  default_agent_status VARCHAR(30) NOT NULL DEFAULT 'OFFLINE'
                     CHECK (default_agent_status IN ('READY_FOR_CALLS','BREAK','OFFLINE','TRAINING')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_status   ON users(status);

-- ============================================================
-- Table: user_role_assignments
-- ============================================================
CREATE TABLE user_role_assignments (
  user_id     UUID NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
  role_id     UUID NOT NULL REFERENCES roles(id)  ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  assigned_by UUID REFERENCES users(id),
  PRIMARY KEY (user_id, role_id)
);

CREATE INDEX idx_ura_user_id ON user_role_assignments(user_id);

-- ============================================================
-- Table: agent_statuses  (current status per user)
-- ============================================================
CREATE TABLE agent_statuses (
  user_id     UUID        PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  status      VARCHAR(30) NOT NULL DEFAULT 'OFFLINE'
                CHECK (status IN ('READY_FOR_CALLS','BREAK','OFFLINE','TRAINING')),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- Table: interactions
-- ============================================================
CREATE TABLE interactions (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  correlation_id       UUID        NOT NULL DEFAULT gen_random_uuid(),
  channel              VARCHAR(20) NOT NULL DEFAULT 'VOICE'
                         CHECK (channel IN ('VOICE')),
  mode                 VARCHAR(20) NOT NULL DEFAULT 'MANUAL'
                         CHECK (mode IN ('MANUAL')),
  status               VARCHAR(30) NOT NULL DEFAULT 'NEW'
                         CHECK (status IN ('NEW','IDENTIFYING','CONTEXT_CONFIRMED','WRAPUP','CLOSED','INCOMPLETE')),
  started_by_user_id   UUID        NOT NULL REFERENCES users(id),
  started_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at             TIMESTAMPTZ,
  completion_flag      BOOLEAN,
  current_customer_ref VARCHAR(200),
  current_vehicle_ref  VARCHAR(200),
  current_dealer_ref   VARCHAR(200),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_interactions_status          ON interactions(status);
CREATE INDEX idx_interactions_started_by      ON interactions(started_by_user_id);
CREATE INDEX idx_interactions_started_at      ON interactions(started_at DESC);
CREATE INDEX idx_interactions_correlation_id  ON interactions(correlation_id);

-- ============================================================
-- Table: interaction_wrapups
-- ============================================================
CREATE TABLE interaction_wrapups (
  id                          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  interaction_id              UUID        NOT NULL UNIQUE REFERENCES interactions(id) ON DELETE CASCADE,
  contact_reason_code         VARCHAR(100) NOT NULL,
  identification_outcome_code VARCHAR(100) NOT NULL,
  interaction_disposition_code VARCHAR(100) NOT NULL,
  remarks                     TEXT,
  saved_by_user_id            UUID        NOT NULL REFERENCES users(id),
  saved_at                    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_wrapups_interaction_id ON interaction_wrapups(interaction_id);

-- ============================================================
-- Table: search_attempts
-- ============================================================
CREATE TABLE search_attempts (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  interaction_id        UUID        NOT NULL REFERENCES interactions(id) ON DELETE CASCADE,
  search_filter_code    VARCHAR(50) NOT NULL
                          CHECK (search_filter_code IN ('MOBILE','REGISTRATION_NUMBER','CUSTOMER_NAME','EMAIL')),
  raw_value             VARCHAR(500) NOT NULL,
  normalized_value      VARCHAR(500) NOT NULL,
  attempted_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  attempted_by_user_id  UUID        NOT NULL REFERENCES users(id),
  result_count          INTEGER     NOT NULL DEFAULT 0,
  primary_source_used   VARCHAR(50)
                          CHECK (primary_source_used IN ('INSTALL_BASE','CUSTOMER_MASTER','NONE')),
  fallback_source_used  BOOLEAN     NOT NULL DEFAULT false,
  outcome_status        VARCHAR(30) NOT NULL
                          CHECK (outcome_status IN ('RESULTS_FOUND','NO_RESULTS','PARTIAL','ERROR'))
);

CREATE INDEX idx_search_interaction_id ON search_attempts(interaction_id);
CREATE INDEX idx_search_attempted_at   ON search_attempts(attempted_at DESC);

-- ============================================================
-- Table: interaction_events
-- ============================================================
CREATE TABLE interaction_events (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  interaction_id    UUID        NOT NULL REFERENCES interactions(id) ON DELETE CASCADE,
  event_name        VARCHAR(100) NOT NULL,
  event_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  actor_user_id     UUID        NOT NULL REFERENCES users(id),
  event_payload     JSONB,
  correlation_id    UUID        NOT NULL
);

CREATE INDEX idx_events_interaction_id ON interaction_events(interaction_id);
CREATE INDEX idx_events_event_name     ON interaction_events(event_name);
CREATE INDEX idx_events_event_at       ON interaction_events(event_at DESC);
CREATE INDEX idx_events_actor          ON interaction_events(actor_user_id);

-- ============================================================
-- Table: context_snapshots
-- ============================================================
CREATE TABLE context_snapshots (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  interaction_id   UUID        NOT NULL REFERENCES interactions(id) ON DELETE CASCADE,
  snapshot_type    VARCHAR(30) NOT NULL
                     CHECK (snapshot_type IN ('customer','vehicle','dealer','combined')),
  source_system    VARCHAR(50) NOT NULL,
  source_reference VARCHAR(200) NOT NULL,
  snapshot_json    JSONB       NOT NULL,
  captured_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_snapshots_interaction_id ON context_snapshots(interaction_id);
CREATE INDEX idx_snapshots_type           ON context_snapshots(interaction_id, snapshot_type);

-- ============================================================
-- Table: reference_values
-- ============================================================
CREATE TABLE reference_values (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_type   VARCHAR(100) NOT NULL,
  code             VARCHAR(100) NOT NULL,
  label            VARCHAR(300) NOT NULL,
  sort_order       INTEGER      NOT NULL DEFAULT 0,
  is_active        BOOLEAN      NOT NULL DEFAULT true,
  metadata         JSONB,           -- e.g. {"remarksRequired": true}
  effective_from   DATE,
  effective_to     DATE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (reference_type, code)
);

CREATE INDEX idx_refvals_type_active ON reference_values(reference_type, is_active);

-- Seed: Search Filters
INSERT INTO reference_values (reference_type, code, label, sort_order) VALUES
  ('search_filter', 'MOBILE',              'Mobile',              1),
  ('search_filter', 'REGISTRATION_NUMBER', 'Registration Number', 2),
  ('search_filter', 'CUSTOMER_NAME',       'Customer Name',       3),
  ('search_filter', 'EMAIL',               'Email',               4);

-- Seed: Contact Reasons
INSERT INTO reference_values (reference_type, code, label, sort_order) VALUES
  ('contact_reason', 'COMPLAINT',   'Complaint',   1),
  ('contact_reason', 'QUERY',       'Query',       2),
  ('contact_reason', 'SUGGESTION',  'Suggestion',  3),
  ('contact_reason', 'FEEDBACK',    'Feedback',    4),
  ('contact_reason', 'OTHER',       'Other',       5);

-- Seed: Identification Outcomes
INSERT INTO reference_values (reference_type, code, label, sort_order) VALUES
  ('identification_outcome', 'CUSTOMER_VEHICLE_IDENTIFIED',         'Customer and Vehicle Identified',              1),
  ('identification_outcome', 'CUSTOMER_IDENTIFIED_VEHICLE_UNRESOLVED', 'Customer Identified, Vehicle Unresolved',   2),
  ('identification_outcome', 'VEHICLE_IDENTIFIED_CUSTOMER_PARTIAL', 'Vehicle Identified, Customer Partially Resolved', 3),
  ('identification_outcome', 'NO_VERIFIED_MATCH',                   'No Verified Match',                            4),
  ('identification_outcome', 'MULTIPLE_MATCHES_RESOLVED',           'Multiple Matches Resolved by Agent',           5);

-- Seed: Interaction Dispositions (remarksRequired stored in metadata)
INSERT INTO reference_values (reference_type, code, label, sort_order, metadata) VALUES
  ('interaction_disposition', 'INFORMATION_PROVIDED',    'Information Provided',    1, '{"remarksRequired": false}'),
  ('interaction_disposition', 'INFORMATION_CAPTURED',    'Information Captured',    2, '{"remarksRequired": false}'),
  ('interaction_disposition', 'NO_MATCH_FOUND',          'No Match Found',          3, '{"remarksRequired": true}'),
  ('interaction_disposition', 'WRONG_NUMBER',            'Wrong Number',            4, '{"remarksRequired": false}'),
  ('interaction_disposition', 'SILENT_CALL',             'Silent Call',             5, '{"remarksRequired": false}'),
  ('interaction_disposition', 'ABUSIVE_CALLER',          'Abusive Caller',          6, '{"remarksRequired": true}'),
  ('interaction_disposition', 'TECHNICAL_ISSUE',         'Technical Issue',         7, '{"remarksRequired": true}'),
  ('interaction_disposition', 'TRANSFERRED_OUTSIDE_CCM', 'Transferred Outside CCM', 8, '{"remarksRequired": false}'),
  ('interaction_disposition', 'INCOMPLETE_INTERACTION',  'Incomplete Interaction',  9, '{"remarksRequired": true}'),
  ('interaction_disposition', 'OTHERS',                  'Others',                  10,'{"remarksRequired": true}');

-- Seed: Agent Statuses
INSERT INTO reference_values (reference_type, code, label, sort_order) VALUES
  ('agent_status', 'READY_FOR_CALLS', 'Ready for Calls', 1),
  ('agent_status', 'BREAK',           'Break',           2),
  ('agent_status', 'OFFLINE',         'Offline',         3),
  ('agent_status', 'TRAINING',        'Training',        4);
```

---

## 7. Interaction State Machine

### 7.1 States

| State Code | Label | Description |
|------------|-------|-------------|
| `NEW` | New | Interaction record created but not yet active. Transient — exists for milliseconds. |
| `IDENTIFYING` | Identifying | Agent is actively searching for the customer. Search panel enabled. |
| `CONTEXT_CONFIRMED` | Context Confirmed | Customer (and optionally vehicle/dealer) context selected. |
| `WRAPUP` | Wrap-up | Agent is capturing disposition. |
| `CLOSED` | Closed | Interaction completed with a productive outcome. |
| `INCOMPLETE` | Incomplete | Interaction ended without a full outcome. |

### 7.2 Allowed Transitions

| From | To | Trigger API | Guard |
|------|----|-------------|-------|
| `NEW` | `IDENTIFYING` | `POST /interactions` (internal, same call) | None — immediate on creation |
| `IDENTIFYING` | `CONTEXT_CONFIRMED` | `PATCH /interactions/:id/context` | `customerRef` must be present |
| `IDENTIFYING` | `WRAPUP` | `PATCH /interactions/:id/wrapup` | All three disposition codes present |
| `CONTEXT_CONFIRMED` | `CONTEXT_CONFIRMED` | `PATCH /interactions/:id/context` (reselection) | `isReselection = true`, new `customerRef` present |
| `CONTEXT_CONFIRMED` | `WRAPUP` | `PATCH /interactions/:id/wrapup` | All three disposition codes present |
| `WRAPUP` | `WRAPUP` | `PATCH /interactions/:id/wrapup` (update) | All three disposition codes present |
| `WRAPUP` | `CLOSED` | `POST /interactions/:id/close` | Wrapup saved, disposition NOT `INCOMPLETE_INTERACTION` |
| `WRAPUP` | `INCOMPLETE` | `POST /interactions/:id/incomplete` | Wrapup saved, disposition IS `INCOMPLETE_INTERACTION`, remarks present |

**Terminal states:** `CLOSED` and `INCOMPLETE`. No transitions out of these states in Phase 1.

### 7.3 Audit Events per Transition

| Transition | Event Written | Event Payload |
|------------|---------------|---------------|
| NEW → IDENTIFYING | `interaction_created` | `{ channel, mode, startedAt }` |
| (on search call) | `search_started` | `{ filter, normalizedValue }` |
| (after search results) | `search_result_returned` | `{ resultCount, sourceUsed, outcomeStatus }` |
| IDENTIFYING → CONTEXT_CONFIRMED | `customer_selected` | `{ customerRef }` |
| (if vehicleRef present) | `vehicle_selected` | `{ vehicleRef }` |
| (if dealerRef present) | `dealer_loaded` | `{ dealerRef }` |
| CONTEXT_CONFIRMED reselection | `customer_reselected` | `{ previousCustomerRef, newCustomerRef }` |
| any → WRAPUP | `disposition_saved` | `{ contactReasonCode, identificationOutcomeCode, interactionDispositionCode }` |
| WRAPUP → CLOSED | `interaction_closed` | `{ endedAt, completionFlag: true }` |
| WRAPUP → INCOMPLETE | `interaction_marked_incomplete` | `{ endedAt, completionFlag: false }` |
| (agent status change) | `agent_status_changed` | `{ previousStatus, newStatus }` |

### 7.4 Guard Enforcement Rule

Guards are enforced exclusively in the backend service layer, never in the frontend. The frontend may mirror state for UX (disable buttons) but the backend rejects illegal transitions with HTTP 422 `INVALID_STATE_TRANSITION`.

---

## 8. Mock Adapter Interface Contracts

### 8.1 IInstallBaseAdapter

```typescript
export interface IInstallBaseAdapter {
  /**
   * Search for customer and vehicle records.
   * Called first on every search. Returns empty array when no match, not an error.
   * Throws AdapterUnavailableError when the adapter cannot be reached.
   */
  search(params: InstallBaseSearchParams): Promise<InstallBaseSearchResult[]>;

  /**
   * Fetch full customer context by customer reference.
   */
  getCustomerByRef(ref: string): Promise<InstallBaseCustomer | null>;

  /**
   * Fetch full vehicle context by vehicle reference.
   */
  getVehicleByRef(ref: string): Promise<InstallBaseVehicle | null>;
}

export interface InstallBaseSearchParams {
  filter: 'MOBILE' | 'REGISTRATION_NUMBER' | 'CUSTOMER_NAME' | 'EMAIL';
  value: string;   // already normalized by search module
}

export interface InstallBaseSearchResult {
  customerRef: string;
  customerName: string;
  primaryMobile: string;
  email: string | null;
  vehicles: InstallBaseVehicleRef[];
}

export interface InstallBaseVehicleRef {
  vehicleRef: string;
  registrationNumber: string;
  modelName: string;
  variant: string;
  dealerRef: string | null;
}

export interface InstallBaseCustomer {
  customerRef: string;
  contactName: string;
  primaryMobile: string;
  secondaryMobile: string | null;
  emailId: string | null;
  address: string | null;
}

export interface InstallBaseVehicle {
  vehicleRef: string;
  modelName: string;
  variant: string;
  registrationNumber: string;
  chassisNumber: string;   // RAW — masking happens in context module, not here
  soldOnDate: string | null;
  lastServiceDate: string | null;
  dealerRef: string | null;
}
```

### 8.2 ICustomerMasterAdapter

```typescript
export interface ICustomerMasterAdapter {
  /**
   * Fallback search. Called only when IInstallBaseAdapter.search returns empty.
   * Returns empty array when no match.
   * Throws AdapterUnavailableError when unreachable.
   */
  search(params: CustomerMasterSearchParams): Promise<CustomerMasterSearchResult[]>;

  /**
   * Fetch customer context by ref.
   */
  getCustomerByRef(ref: string): Promise<CustomerMasterCustomer | null>;
}

export interface CustomerMasterSearchParams {
  filter: 'MOBILE' | 'REGISTRATION_NUMBER' | 'CUSTOMER_NAME' | 'EMAIL';
  value: string;
}

export interface CustomerMasterSearchResult {
  customerRef: string;
  customerName: string;
  primaryMobile: string;
  email: string | null;
  // Customer Master does not return vehicle refs — vehicle list will be empty
  vehicles: never[];
}

export interface CustomerMasterCustomer {
  customerRef: string;
  contactName: string;
  primaryMobile: string;
  secondaryMobile: string | null;
  emailId: string | null;
  address: string | null;
}
```

### 8.3 IiDMSAdapter

```typescript
export interface IiDMSAdapter {
  /**
   * Fetch dealer context by dealer reference code.
   * Returns null when dealer not found (not an error — missing dealer is allowed).
   * Throws AdapterUnavailableError when unreachable.
   */
  getDealerByRef(dealerRef: string): Promise<iDMSDealer | null>;
}

export interface iDMSDealer {
  dealerRef: string;
  dealerName: string;
  dealerCode: string;
  branchName: string | null;
  asc: string | null;
  city: string | null;
  address: string | null;
  pinCode: string | null;
  dealerType: string | null;
  isActive: boolean;
}
```

### 8.4 Shared Adapter Error Type

```typescript
export class AdapterUnavailableError extends Error {
  constructor(
    public readonly adapterName: string,
    public readonly cause?: unknown
  ) {
    super(`Adapter unavailable: ${adapterName}`);
    this.name = 'AdapterUnavailableError';
  }
}
```

### 8.5 Mock Seed Data Specification

The mock adapter implementations must provide deterministic in-memory data covering all relevant test scenarios. Minimum dataset:

**10 customers (IB prefix = Install Base, CM prefix = Customer Master only):**

| customerRef | Name | Mobile | Email | Scenario |
|-------------|------|--------|-------|----------|
| IB-CUST-001 | Arjun Mehta | 9876543210 | arjun@example.com | Single result with 1 vehicle |
| IB-CUST-002 | Priya Sharma | 9876543211 | priya@example.com | Single result with 2 vehicles (disambiguation) |
| IB-CUST-003 | Rahul Verma | 9876543212 | rahul@example.com | Single result with 3 vehicles |
| IB-CUST-004 | Sunita Patel | 9876543213 | null | Customer with no email |
| IB-CUST-005 | Kavya Reddy | 9876543214 | kavya@example.com | Search by name returns multiple matches |
| IB-CUST-006 | Amit Joshi | 9876543210 | amit@example.com | Shares mobile with IB-CUST-001 (ambiguity by mobile) |
| IB-CUST-007 | Deepak Nair | 9999999999 | deepak@example.com | Vehicle with no dealer ref |
| IB-CUST-008 | Meera Iyer | 8888888888 | meera@example.com | Customer Master fallback only (not in IB) |
| CM-CUST-009 | Vikram Singh | 7777777777 | vikram@example.com | Customer Master only, no vehicles |
| CM-CUST-010 | Lata Rao | 6666666666 | lata@example.com | No match scenario (must search value not matching any record) |

**15 vehicles:**

| vehicleRef | customerRef | Registration | Model | Dealer |
|------------|-------------|--------------|-------|--------|
| VH-001 | IB-CUST-001 | MH12AB1234 | Swift Dzire | DL-001 |
| VH-002 | IB-CUST-002 | DL05CD5678 | Baleno | DL-002 |
| VH-003 | IB-CUST-002 | GJ01EF9012 | S-Cross | DL-003 |
| VH-004 | IB-CUST-003 | KA03GH3456 | Ciaz | DL-001 |
| VH-005 | IB-CUST-003 | TN07IJ7890 | Ertiga | DL-002 |
| VH-006 | IB-CUST-003 | UP16KL1234 | Vitara Brezza | DL-004 |
| VH-007 | IB-CUST-004 | HR26MN5678 | Alto K10 | DL-003 |
| VH-008 | IB-CUST-005 | WB22OP9012 | Wagon R | DL-001 |
| VH-009 | IB-CUST-005 | RJ14QR3456 | Celerio | DL-005 |
| VH-010 | IB-CUST-006 | MH12ST7890 | Fronx | DL-002 |
| VH-011 | IB-CUST-007 | AP09UV1234 | Grand Vitara | null |
| VH-012 | IB-CUST-007 | TS08WX5678 | Jimny | null |
| VH-013 | IB-CUST-008 | MP09YZ9012 | Swift | DL-005 |
| VH-014 | IB-CUST-005 | CH04AB3456 | Invicto | DL-004 |
| VH-015 | IB-CUST-001 | PB10CD7890 | Alto 800 | DL-001 |

**5 dealers:**

| dealerRef | Name | Code | City | isActive |
|-----------|------|------|------|----------|
| DL-001 | Sunrise Motors Pvt Ltd | SRM001 | Mumbai | true |
| DL-002 | Capital Auto Wheels | CAW002 | Delhi | true |
| DL-003 | Western Auto Services | WAS003 | Ahmedabad | true |
| DL-004 | Southern Drive Centre | SDC004 | Bangalore | false |
| DL-005 | Eastern Vehicle Hub | EVH005 | Kolkata | true |

**Coverage matrix ensured:**
- Single result exact match (mobile = 9876543210 for IB-CUST-001 alone — note IB-CUST-006 shares it, so mobile search returns ambiguity).
- Single result by registration (unique reg = MH12AB1234 → VH-001 → IB-CUST-001).
- Multiple results by name ("Kavya" → IB-CUST-005 and IB-CUST-009 partial, depending on seed).
- Customer with multiple vehicles (IB-CUST-002, IB-CUST-003).
- Missing dealer (VH-011, VH-012 with dealerRef null).
- No result (search for mobile 0000000000 returns empty from both adapters).
- Customer Master fallback (IB-CUST-008 search in IB returns nothing, CM returns result).
- Inactive dealer (DL-004) — context returned but `isActive: false` shown.

---

## 9. JWT and Session Design

### 9.1 Token Payload (Claims)

```typescript
interface JwtPayload {
  sub: string;          // user UUID
  username: string;
  displayName: string;
  role: 'AGENT';
  iat: number;          // issued at (Unix timestamp)
  exp: number;          // expiry (Unix timestamp)
  jti: string;          // unique token ID (UUID) for revocation support
}
```

### 9.2 Token Strategy

**Phase 1 decision:** Single access token stored in httpOnly cookie. No refresh token in Phase 1.

Rationale: Refresh tokens require a token store (Redis or DB table) and rotation logic. The NFR does not mandate sub-15-minute sessions. A 60-minute access token with server-side session expiry handling is sufficient and simpler.

| Property | Value |
|----------|-------|
| Access token TTL | 60 minutes |
| Algorithm | HS256 (HMAC-SHA256) with a 256-bit secret from environment |
| Storage | httpOnly cookie (`ccm_session`) |
| Refresh strategy | Re-login on expiry (Phase 1). Refresh tokens deferred to Phase 2. |

**Note for Phase 2:** The `jti` claim is included now to make server-side revocation (logout invalidation) straightforward when a token store is added later. For Phase 1, logout clears the cookie only.

### 9.3 Cookie Configuration

```typescript
// Express cookie-parser / res.cookie config
{
  name: 'ccm_session',
  httpOnly: true,
  secure: true,           // true in production; false in local dev (HTTP)
  sameSite: 'strict',     // CSRF mitigation layer 1
  path: '/api',           // scope to API path only
  maxAge: 3600000,        // 60 minutes in milliseconds
}
```

In local development (Docker Compose, HTTP), `secure` is set to `false` via `NODE_ENV=development` environment variable.

### 9.4 CSRF Protection

**Strategy:** Double Submit Cookie pattern.

1. On successful login, the server generates a random CSRF token (UUID v4) and returns it in the **response body** as `csrfToken`.
2. The frontend stores this in JavaScript memory (not in a cookie or localStorage).
3. Every mutating request (POST/PATCH/DELETE) must include `X-CSRF-Token: <token>` header.
4. The backend middleware validates that the `X-CSRF-Token` header matches the CSRF token associated with the session (stored server-side in memory or encoded into the JWT — see below).

**Implementation:** For Phase 1, the CSRF token is embedded in the JWT payload as a claim (`csrf: string`). The middleware reads the JWT, extracts `csrf`, and compares it to the `X-CSRF-Token` header. This avoids needing a separate server-side store.

```typescript
interface JwtPayload {
  // ... existing fields
  csrf: string;   // UUID v4, used for double-submit CSRF validation
}
```

### 9.5 Session Expiry Flow

**Backend:** The JWT middleware returns HTTP 401 with `code: SESSION_EXPIRED` when the token is expired.

**Frontend:**
1. React Query / axios interceptor catches HTTP 401 with `code: SESSION_EXPIRED`.
2. Clears local application state (React Query cache, in-memory CSRF token).
3. Redirects to the login page.
4. Login page shows a non-blocking toast: "Your session has expired. Please sign in again."

**In-flight interaction protection:** If an interaction is active (status not CLOSED or INCOMPLETE) and the session expires, the interaction remains in its current state in the database. On re-login, the agent can retrieve the interaction. This is the safest behavior — no silent writes on expiry.

---

## 10. Shared TypeScript Types Package (`/packages/types`)

### 10.1 Enums

```typescript
// /packages/types/src/enums.ts

export enum InteractionStatus {
  NEW                = 'NEW',
  IDENTIFYING        = 'IDENTIFYING',
  CONTEXT_CONFIRMED  = 'CONTEXT_CONFIRMED',
  WRAPUP             = 'WRAPUP',
  CLOSED             = 'CLOSED',
  INCOMPLETE         = 'INCOMPLETE',
}

export enum AgentStatus {
  READY_FOR_CALLS = 'READY_FOR_CALLS',
  BREAK           = 'BREAK',
  OFFLINE         = 'OFFLINE',
  TRAINING        = 'TRAINING',
}

export enum SearchFilter {
  MOBILE              = 'MOBILE',
  REGISTRATION_NUMBER = 'REGISTRATION_NUMBER',
  CUSTOMER_NAME       = 'CUSTOMER_NAME',
  EMAIL               = 'EMAIL',
}

export enum SearchOutcomeStatus {
  RESULTS_FOUND = 'RESULTS_FOUND',
  NO_RESULTS    = 'NO_RESULTS',
  PARTIAL       = 'PARTIAL',
  ERROR         = 'ERROR',
}

export enum SearchSourceSystem {
  INSTALL_BASE    = 'INSTALL_BASE',
  CUSTOMER_MASTER = 'CUSTOMER_MASTER',
  NONE            = 'NONE',
}

export enum InteractionChannel {
  VOICE = 'VOICE',
}

export enum InteractionMode {
  MANUAL = 'MANUAL',
}

export enum UserStatus {
  ACTIVE   = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  LOCKED   = 'LOCKED',
}

export enum SnapshotType {
  CUSTOMER = 'customer',
  VEHICLE  = 'vehicle',
  DEALER   = 'dealer',
  COMBINED = 'combined',
}
```

### 10.2 Event Name Constants

```typescript
// /packages/types/src/events.ts

export const InteractionEventName = {
  INTERACTION_CREATED:          'interaction_created',
  SEARCH_STARTED:               'search_started',
  SEARCH_RESULT_RETURNED:       'search_result_returned',
  CUSTOMER_SELECTED:            'customer_selected',
  VEHICLE_SELECTED:             'vehicle_selected',
  DEALER_LOADED:                'dealer_loaded',
  CUSTOMER_RESELECTED:          'customer_reselected',
  DISPOSITION_SAVED:            'disposition_saved',
  INTERACTION_CLOSED:           'interaction_closed',
  INTERACTION_MARKED_INCOMPLETE:'interaction_marked_incomplete',
  AGENT_STATUS_CHANGED:         'agent_status_changed',
} as const;

export type InteractionEventName = typeof InteractionEventName[keyof typeof InteractionEventName];
```

### 10.3 Request DTOs

```typescript
// /packages/types/src/requests.ts

import { AgentStatus, SearchFilter } from './enums';

export interface LoginRequest {
  username: string;
  password: string;
}

export interface UpdateAgentStatusRequest {
  status: AgentStatus;
}

export interface SearchRequest {
  interactionId: string;
  filter: SearchFilter;
  value: string;
}

export interface UpdateInteractionContextRequest {
  customerRef: string;
  vehicleRef: string | null;
  dealerRef: string | null;
  isReselection: boolean;
}

export interface SaveWrapupRequest {
  contactReasonCode: string;
  identificationOutcomeCode: string;
  interactionDispositionCode: string;
  remarks: string | null;
}
```

### 10.4 Response DTOs

```typescript
// /packages/types/src/responses.ts

import {
  InteractionStatus,
  AgentStatus,
  SearchFilter,
  SearchOutcomeStatus,
  SearchSourceSystem,
  InteractionChannel,
  InteractionMode,
} from './enums';

export interface ApiSuccess<T> {
  success: true;
  data: T;
  correlationId: string;
}

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
  correlationId: string;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

// --- Auth ---
export interface LoginResponse {
  user: UserDto;
  csrfToken: string;
}

export interface MeResponse {
  id: string;
  username: string;
  displayName: string;
  role: 'AGENT';
  defaultAgentStatus: AgentStatus;
}

export interface UserDto {
  id: string;
  username: string;
  displayName: string;
  role: 'AGENT';
}

// --- Agent Status ---
export interface AgentStatusResponse {
  userId: string;
  currentStatus: AgentStatus;
  updatedAt: string;
}

// --- Interactions ---
export interface CreateInteractionResponse {
  interactionId: string;
  status: InteractionStatus;
  channel: InteractionChannel;
  mode: InteractionMode;
  startedAt: string;
}

export interface InteractionDetailResponse {
  id: string;
  status: InteractionStatus;
  channel: InteractionChannel;
  mode: InteractionMode;
  startedAt: string;
  endedAt: string | null;
  completionFlag: boolean | null;
  currentCustomerRef: string | null;
  currentVehicleRef: string | null;
  currentDealerRef: string | null;
  correlationId: string;
  wrapup: InteractionWrapupDto | null;
  events: InteractionEventDto[];
}

export interface InteractionWrapupDto {
  id: string;
  contactReasonCode: string;
  identificationOutcomeCode: string;
  interactionDispositionCode: string;
  remarks: string | null;
  savedAt: string;
}

export interface InteractionEventDto {
  id: string;
  eventName: string;
  eventAt: string;
  actorUserId: string;
  eventPayload: Record<string, unknown> | null;
}

export interface UpdateInteractionContextResponse {
  interactionId: string;
  status: InteractionStatus;
  currentCustomerRef: string;
  currentVehicleRef: string | null;
  currentDealerRef: string | null;
  updatedAt: string;
}

export interface SaveWrapupResponse {
  interactionId: string;
  status: InteractionStatus;
  wrapup: InteractionWrapupDto;
}

export interface CloseInteractionResponse {
  interactionId: string;
  status: 'CLOSED';
  endedAt: string;
  completionFlag: true;
}

export interface MarkIncompleteResponse {
  interactionId: string;
  status: 'INCOMPLETE';
  endedAt: string;
  completionFlag: false;
}

// --- Search ---
export interface SearchResponse {
  interactionId: string;
  searchAttemptId: string;
  filter: SearchFilter;
  normalizedValue: string;
  results: SearchResultItem[];
  resultCount: number;
  primarySourceUsed: SearchSourceSystem;
  fallbackSourceUsed: boolean;
  outcomeStatus: SearchOutcomeStatus;
}

export interface SearchResultItem {
  customerRef: string;
  customerName: string;
  primaryMobile: string;
  email: string | null;
  vehicles: SearchResultVehicle[];
  sourceSystem: SearchSourceSystem;
}

export interface SearchResultVehicle {
  vehicleRef: string;
  registrationNumber: string;
  modelName: string;
  variant: string;
  dealerRef: string | null;
}

// --- Context ---
export interface CustomerContextResponse {
  customerRef: string;
  contactName: string;
  primaryMobile: string;
  secondaryMobile: string | null;
  emailId: string | null;
  address: string | null;
  sourceSystem: string;
}

export interface VehicleContextResponse {
  vehicleRef: string;
  modelName: string;
  variant: string;
  registrationNumber: string;
  chassisNumberMasked: string;
  soldOnDate: string | null;
  lastServiceDate: string | null;
  dealerRef: string | null;
  sourceSystem: string;
}

export interface DealerContextResponse {
  dealerRef: string;
  dealerName: string;
  dealerCode: string;
  branchName: string | null;
  asc: string | null;
  city: string | null;
  address: string | null;
  pinCode: string | null;
  dealerType: string | null;
  isActive: boolean;
  sourceSystem: string;
}

// --- Master Data ---
export interface ReferenceValueDto {
  code: string;
  label: string;
  sortOrder: number;
  remarksRequired?: boolean;
}

export interface MasterDataResponse {
  type: string;
  items: ReferenceValueDto[];
}

// --- Health ---
export interface LivenessResponse {
  status: 'ok';
  timestamp: string;
}

export interface ReadinessResponse {
  status: 'ready' | 'not_ready';
  checks: {
    postgres: 'ok' | 'error';
    mongodb: 'ok' | 'error';
  };
}
```

### 10.5 Package `index.ts`

```typescript
// /packages/types/src/index.ts

export * from './enums';
export * from './events';
export * from './requests';
export * from './responses';
```

---

## 11. Frontend Architecture

### 11.1 Directory Structure

```
/apps/web/src/
  app/
    App.tsx                 Root component, router setup, React Query client
    router.tsx              Route definitions
    queryClient.ts          React Query client config
  pages/
    LoginPage.tsx
    WorkspacePage.tsx
  features/
    auth/
      LoginForm.tsx
      useLogin.ts
      useLogout.ts
      useCurrentUser.ts
      authStore.ts           Zustand or Context — holds csrfToken, user identity
    interaction/
      StartInteractionButton.tsx
      useStartInteraction.ts
      InteractionStatusBadge.tsx
      WrapupForm.tsx
      useWrapup.ts
      useCloseInteraction.ts
      useMarkIncomplete.ts
    search/
      SearchPanel.tsx
      SearchFilterSelector.tsx
      SearchValueInput.tsx
      SearchResultList.tsx
      SearchResultRow.tsx
      useSearch.ts
    context/
      ContextCards.tsx
      ContactCard.tsx
      VehicleCard.tsx
      DealerCard.tsx
      useCustomerContext.ts
      useVehicleContext.ts
      useDealerContext.ts
      useUpdateInteractionContext.ts
    agentStatus/
      AgentStatusChip.tsx
      AgentStatusMenu.tsx
      useAgentStatus.ts
  shared/
    api/
      apiClient.ts           Axios instance, interceptors, CSRF header injection
      endpoints.ts           URL constants
    hooks/
      useCorrelationId.ts
      useSessionExpiry.ts
    utils/
      masking.ts             chassisNumberMask()
      normalization.ts
    theme/
      theme.ts               MUI theme config
    components/              Thin wrappers consuming /packages/ui design system
```

### 11.2 State Ownership Rules

| State | Owner | Why |
|-------|-------|-----|
| Authenticated user identity, CSRF token | `authStore` (in-memory, React Context or Zustand) | Must survive navigation, lost on page refresh (requires re-login) |
| Current interaction ID, status | React Query cache keyed by interaction ID | Server state; refetch on mutation success |
| Search results | React Query cache keyed by search params + interaction ID | Server state |
| Context cards data | React Query cache keyed by customerRef / vehicleRef / dealerRef | Server state |
| Master data (dropdowns) | React Query cache with long stale time (10 min) | Rarely changes |
| Agent status | React Query cache for current user | Server state |
| Form state (wrapup, login) | React Hook Form local state | Transient UI state |

### 11.3 CSRF Header Injection

```typescript
// /apps/web/src/shared/api/apiClient.ts
// Axios request interceptor
axiosInstance.interceptors.request.use((config) => {
  const csrfToken = authStore.getState().csrfToken;
  if (csrfToken && ['post','patch','put','delete'].includes(config.method ?? '')) {
    config.headers['X-CSRF-Token'] = csrfToken;
  }
  return config;
});
```

### 11.4 Session Expiry Interceptor

```typescript
// Axios response interceptor
axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && error.response?.data?.error?.code === 'SESSION_EXPIRED') {
      authStore.getState().clearSession();
      queryClient.clear();
      router.navigate('/login', { state: { sessionExpired: true } });
    }
    return Promise.reject(error);
  }
);
```

---

## 12. Risks and Rollback Considerations

### Risk 1: State machine bypass via direct DB write
**Likelihood:** Low (controlled environment). **Impact:** High (audit corruption).
**Mitigation:** State transitions are enforced in service layer only. No repository method accepts a raw status string without going through the transition validator. DB-level CHECK constraints provide a second guard.

### Risk 2: Adapter returning inconsistent schemas
**Likelihood:** Medium (external systems). **Impact:** Medium (context card failures).
**Mitigation:** Adapter interface contracts define exact return shapes. Mock adapters must match these shapes exactly. Schema guard (Zod) applied at the adapter boundary before mapping to internal DTOs. Adapter schema drift triggers a logged `AdapterUnavailableError`, not a 500.

### Risk 3: Audit event write failing silently
**Likelihood:** Low. **Impact:** High (compliance gap).
**Mitigation:** Audit writes use the same database connection as the interaction mutation where possible (same transaction). If the audit write fails, the transaction rolls back. The main workflow operation is NOT marked successful if the audit write fails. This is documented as an explicit design choice — audit safety takes priority over resilience to audit failures.

### Risk 4: CSRF token lost on page refresh
**Likelihood:** Certain (by design). **Impact:** Low (forces re-login, which is correct).
**Mitigation:** Frontend loses the in-memory CSRF token on refresh. The session cookie persists. The `GET /auth/me` call on app load will succeed (cookie present) but the app has no CSRF token. Frontend must detect this state on app mount and redirect to login. This is correct behavior — not a bug.

**Implementation note:** On `App.tsx` mount, call `/auth/me`. If the response is 200 but the application state has no CSRF token stored, clear the session and redirect to login. The user experience is a silent redirect to login, not an error.

### Risk 5: Agent ownership check scalability
**Likelihood:** Low (Phase 1 is single-agent-per-interaction). **Impact:** Medium.
**Mitigation:** `started_by_user_id` on the `interactions` table indexed. All interaction endpoints validate `started_by_user_id = actor.id` at service layer. This is sufficient for Phase 1.

### Risk 6: Mock adapter data not covering edge cases
**Likelihood:** Medium (new developers/agents adding features). **Impact:** Medium (untested scenarios reach QA late).
**Mitigation:** The seed data specification in Section 8.5 is the contract for mock implementations. QA engineer must verify each row in the coverage matrix has a corresponding test case.

### Rollback Approach
- All schema changes are versioned SQL migrations (numbered, forward-only in Phase 1).
- Docker Compose volumes can be reset to re-run migrations from scratch in development.
- No migration rollback scripts in Phase 1 — destructive rollback requires a new forward migration.
- Application code rollback: container image rollback via Docker tag. The previous image is expected to be compatible with the migration it shipped with.

---

## 13. Recommended Implementing Agent Sequence

1. **Backend Engineer Agent** — implement in this order:
   a. Monorepo scaffold (npm workspaces, tsconfig, ESLint/Prettier).
   b. `/packages/types` — all enums, events, DTOs from Section 10.
   c. Database migration file `001_initial_schema.sql` from Section 6.
   d. `auth` module — login, logout, me, JWT generation, CSRF middleware.
   e. `master-data` module — reference_values reads.
   f. `interaction` module — create, state machine, state transition validator.
   g. `audit` module — event write service.
   h. Mock adapter implementations for Install Base, Customer Master, iDMS.
   i. `search` module — normalization, filter validation, adapter orchestration, search attempt writes.
   j. `context` module — customer/vehicle/dealer fetch, chassis masking, snapshot writes.
   k. `agent-status` module (simple, last).
   l. `health` module — live and ready endpoints.

2. **Frontend Engineer Agent** — begin after auth and interaction endpoints are available:
   a. Vite + React 18 + MUI v6 + TypeScript scaffold with PWA plugin.
   b. `/packages/ui` integration — import from design system.
   c. `apiClient.ts` with interceptors.
   d. Auth feature — login page, session state, CSRF handling.
   e. Workspace page shell — header with agent status, interaction panel.
   f. Search feature — filter selector, value input, results list.
   g. Context cards — contact, vehicle, dealer.
   h. Wrapup form — three dropdowns with conditional remarks.
   i. Close and incomplete flows.

3. **QA Engineer Agent** — test contract coverage against Section 8.5 seed data coverage matrix, Section 7 state machine transition table, and all HTTP error codes in Section 5.

---

## 14. Open Questions

The following items are not resolved by the Phase 1 documents and must not be invented. They should be surfaced to the product owner before the relevant feature is implemented.

| # | Question | Impacts |
|---|----------|---------|
| 1 | What is the exact minimum character threshold for Customer Name search? The document states 3 characters but names commonly searched are surnames. Confirm 3 is intentional. | Search module validation |
| 2 | Can an agent have more than one open (non-CLOSED, non-INCOMPLETE) interaction simultaneously? The current design assumes one active interaction per agent. | Interaction create guard |
| 3 | Is the CSRF token expected to survive a token refresh in Phase 2? The current design embeds CSRF in the JWT, which means a token refresh produces a new CSRF token. The frontend must be notified of the new CSRF token. | Phase 2 auth design |
| 4 | What is the data retention period for context_snapshots and interaction_events? Must be defined before production launch (NFR section 6). | Data retention, purge jobs |
| 5 | Is `Incomplete Interaction` the only disposition code that routes to `/interactions/:id/incomplete`, or can an agent also use `/interactions/:id/close` with that disposition? Current design routes exclusively through `/incomplete`. Confirm. | State machine close guard |

---

*End of Phase 1 Technical Implementation Blueprint.*
