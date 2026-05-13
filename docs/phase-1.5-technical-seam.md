# CCM Phase 1.5 — Technical Seam Document

**Version:** 1.0
**Date:** 2026-04-04
**Authority:** Solution Architect Agent
**Audience:** Backend Engineer Agent, Frontend Engineer Agent, QA Engineer Agent
**Supersedes:** Phase 1.5 plan Wave 1 (product-owner gate rejected — corrected here)

---

## Purpose

This document defines the precise technical seam for Phase 1.5 additions to CCM. It corrects three categories of errors found in the initial Wave 1 plan:

1. Wrong TeleCMI event names (`call_active`, `call_ended` do not exist — corrected to `started`, `hangup`).
2. Missing `on_call` and `wrap_up` statuses in the phase document (added in ccm-scope.md and specified below).
3. Ambiguous auto-reset trigger (must fire on wrapup interaction **close**, not save).

All changes described here are additive. No existing Phase 1 or Phase 6 behavior is altered.

---

## Section 1 — Corrected TeleCMI Event Mapping

### Source of truth

The authoritative type for TeleCMI live events is `TeleCmiWebhookLiveEvent` in:

```
apps/api/src/modules/cti/cti.types.ts
```

The relevant interface is:

```typescript
export interface TeleCmiWebhookLiveEvent {
  type: 'event';
  direction: 'inbound' | 'outbound';
  status: 'waiting' | 'started' | 'hangup';
  cmiuuid?: string;
  conversation_uuid?: string;
  from?: string;
  to?: string;
  app_id?: number;
  time?: number;
  custom?: string;
}
```

The discriminating field is `payload.type === 'event'` combined with `payload.status`. The three valid live event statuses are:

| `payload.status` | Meaning | Current handling in `cti.webhook.service.ts` |
|---|---|---|
| `'waiting'` | Call is ringing — not yet answered | Inserts a `cti_call_logs` row via `insertWaitingEvent()` |
| `'started'` | Call has been answered — conversation is live | **Not yet handled** — no branch for `started` exists |
| `'hangup'` | Call has ended (inbound live hangup, distinct from CDR) | Partially handled — outbound hangup updates `cti_call_logs.status = 'cancelled'`; inbound `started` hangup is **not yet handled** |

### Phase 1.5 required event-to-status mappings

These mappings must be implemented as new branches in `handleWebhookEvent()` in `cti.webhook.service.ts`. The gate condition `session_mode === 'cti'` is evaluated against the `users` table (not from the webhook payload — see Section 2).

| TeleCMI event | Condition | CCM agent status transition |
|---|---|---|
| `type='event'`, `status='started'`, `direction='inbound'` | Agent's `session_mode = 'cti'` | `ready_for_calls` → `on_call` |
| `type='event'`, `status='hangup'`, `direction='inbound'` | Agent's `session_mode = 'cti'` | `on_call` → `wrap_up` |

The `waiting` event (`type='event'`, `status='waiting'`) already has a handler and must **not** be changed. It should additionally trigger the proactive caller pre-fetch (held in Redis or in-process cache — scoped separately).

### Agent identification from a TeleCMI live event

TeleCMI live events do not carry a CCM `user_id`. The agent must be resolved from the TeleCMI event payload using the `from` field (extension/SIP ID) matched against `users.telecmi_agent_id`. The lookup pattern already exists in `agent-status.service.ts` for the TeleCMI status sync:

```sql
SELECT id, session_mode
FROM users
WHERE telecmi_agent_id = $1
  AND is_active = TRUE
LIMIT 1
```

The `telecmi_agent_id` column was added by migration `022_add_telecmi_fields_to_users.sql`.

### What NOT to use

- Do not use `call_active` — this event name does not exist in `TeleCmiWebhookLiveEvent.status`.
- Do not use `call_ended` — this event name does not exist in `TeleCmiWebhookLiveEvent.status`.
- The `cdr` type (`payload.type === 'cdr'`) is a post-call summary record, not a live event. CDR arrival does not trigger status transitions.

---

## Section 2 — Session Mode DB Design

### Which table

Session mode belongs on the `users` table (defined in `ops/migrations/001_create_users.sql`). The `users` table is the canonical store for agent identity and configuration. The `auth.repository.ts` module already reads from `users` for login, logout, and `/me` resolution.

The `agent_statuses` table stores the current real-time availability state, not profile configuration. `session_mode` is a profile preference, not a live status, so it does not belong there.

### Column definition

```sql
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS session_mode VARCHAR(10)
  DEFAULT NULL
  CHECK (session_mode IS NULL OR session_mode IN ('manual', 'cti'));
```

This is migration `030_add_session_mode_to_users.sql` (next sequential number).

### Migration approach

- Additive only — `ADD COLUMN IF NOT EXISTS`. No existing rows are touched.
- Nullable by design: existing rows legitimately have no `session_mode` (they have not logged in under Phase 1.5). `NULL` means "not yet selected".
- No backfill required. The mode selection dialog fires on next login and sets the value.
- The `CHECK` constraint is inline — no new reference table needed.

### Reset-on-logout behaviour

The current `logoutController` in `apps/api/src/modules/auth/auth.controller.ts` only clears cookies. It does not call any service to mutate user state.

Phase 1.5 requires that `session_mode` is set to `NULL` on every logout. The modification must be in `auth.service.ts` (not the controller) to keep DB mutations in the service layer.

**Change required in `auth.service.ts`:** Add a `logoutService(userId, correlationId)` function that:

1. Sets `users.session_mode = NULL` WHERE `id = userId`.
2. Writes an `agent_status_changed` audit event with `{ trigger: 'logout', sessionModeCleared: true }`.

**Change required in `auth.controller.ts`:** Call `logoutService(req.user.userId, req.correlationId)` in `logoutController` before clearing cookies.

**Change required in `auth.repository.ts`:** Add a `clearSessionMode(userId)` function:

```typescript
export async function clearSessionMode(userId: string): Promise<void> {
  await getPool().query(
    `UPDATE users SET session_mode = NULL, updated_at = NOW() WHERE id = $1`,
    [userId],
  );
}
```

### Mode selection on login

After successful authentication (post-JWT issue), before the agent reaches the workspace, the frontend presents a modal dialog:

- "How would you like to work today?"
- Options: "Manual" | "CTI"

On selection, the frontend calls a new endpoint:

```
PATCH /api/v1/auth/session-mode
Body: { "sessionMode": "manual" | "cti" }
```

This endpoint:
- Requires `authenticate` middleware (valid session cookie).
- Requires CSRF protection.
- Writes `session_mode` to the `users` table via a new `setSessionMode(userId, mode)` repository function.
- Returns `{ sessionMode: "manual" | "cti" }`.

The `GET /api/v1/auth/me` response must include `sessionMode` so the frontend can determine if the dialog should be shown on page refresh.

---

## Section 3 — Agent Status Enum Extension

### Changes to `packages/types/src/enums.ts`

Add two new values to `AgentStatus`. Both values are **system-managed** — the validator in `agent-status.validator.ts` must reject them from agent-initiated PATCH requests. See validator change below.

```typescript
export enum AgentStatus {
  READY_FOR_CALLS = 'ready_for_calls',
  BREAK           = 'break',
  OFFLINE         = 'offline',
  TRAINING        = 'training',
  // Phase 1.5 — system-managed CTI statuses. Not agent-selectable.
  ON_CALL         = 'on_call',
  WRAP_UP         = 'wrap_up',
}
```

### Changes to `agent_statuses` table CHECK constraint

Two `ALTER TABLE` statements are needed — one for `status_code`, one for `previous_status_code`. This is migration `031_extend_agent_statuses_for_cti.sql`:

```sql
-- Migration 031 — Extend agent_statuses CHECK constraints for CTI statuses
--
-- Adds 'on_call' and 'wrap_up' to both status_code and previous_status_code
-- CHECK constraints. These values are set by CTI webhook processing only.
-- No existing rows are modified.

ALTER TABLE agent_statuses
  DROP CONSTRAINT IF EXISTS agent_statuses_status_code_check;

ALTER TABLE agent_statuses
  ADD CONSTRAINT agent_statuses_status_code_check
  CHECK (status_code IN (
    'ready_for_calls', 'break', 'offline', 'training',
    'on_call', 'wrap_up'
  ));

ALTER TABLE agent_statuses
  DROP CONSTRAINT IF EXISTS agent_statuses_previous_status_code_check;

ALTER TABLE agent_statuses
  ADD CONSTRAINT agent_statuses_previous_status_code_check
  CHECK (previous_status_code IS NULL OR
         previous_status_code IN (
           'ready_for_calls', 'break', 'offline', 'training',
           'on_call', 'wrap_up'
         ));

COMMENT ON COLUMN agent_statuses.status_code IS
  'Current status: ready_for_calls | break | offline | training | on_call | wrap_up. '
  'on_call and wrap_up are system-managed (CTI mode only) and not agent-selectable.';
```

### Existing services that consume `AgentStatus` and need updating

The following files use `AgentStatus` and each needs a targeted review:

| File | What changes |
|---|---|
| `apps/api/src/modules/agent-status/agent-status.validator.ts` | The `updateAgentStatusSchema` uses `z.nativeEnum(AgentStatus)`. After the enum addition, `on_call` and `wrap_up` would become valid inputs from agents. The validator must explicitly exclude them: use `z.enum(['ready_for_calls', 'break', 'offline', 'training'])` instead of `z.nativeEnum(AgentStatus)`. |
| `apps/api/src/modules/agent-status/agent-status.service.ts` | The TeleCMI status sync block maps CCM statuses to TeleCMI statuses (`online`/`offline`/`break`). `on_call` and `wrap_up` do not map to any TeleCMI status (TeleCMI drives these states into CCM, not the reverse). The sync block must explicitly skip them to prevent a reverse-sync loop. |
| `apps/web/src/features/agent-status/agentStatusStore.ts` | The frontend status picker must not offer `on_call` or `wrap_up` as selectable options. Add a `SYSTEM_MANAGED_STATUSES` exclusion list. |
| `apps/api/src/modules/auth/auth.repository.ts` | `upsertAgentStatusOffline` hardcodes `'offline'` — no change needed, but confirm the CHECK constraint accepts `'offline'` (it does). |
| `apps/api/src/modules/auth/auth.service.ts` | `loginService` hardcodes `agentStatus: 'offline'` in the return — correct, no change needed. |
| `packages/types/src/dtos.ts` | Review if any DTO hardcodes the valid status list as a string literal union. If so, add `'on_call' | 'wrap_up'` to the union. |

---

## Section 4 — Auto-status Transition Rules

All rules are gated on `session_mode`. In manual mode, none of these transitions fire. The agent controls their own status.

### Rule 1: Call answered → `on_call`

```
Trigger:  TeleCMI webhook payload { type: 'event', status: 'started', direction: 'inbound' }
Gate:     users WHERE telecmi_agent_id = payload.from AND session_mode = 'cti'
Precondition: agent's current status_code = 'ready_for_calls' (log a warning and skip if not)
Action:   updateAgentStatus(userId, 'on_call', correlationId)
Audit:    event_name = 'agent_status_changed', payload = { previousStatus: 'ready_for_calls', newStatus: 'on_call', trigger: 'cti_started_event', cmiuuid }
```

### Rule 2: Call ended → `wrap_up`

```
Trigger:  TeleCMI webhook payload { type: 'event', status: 'hangup', direction: 'inbound' }
Gate:     users WHERE telecmi_agent_id = payload.from AND session_mode = 'cti'
Precondition: agent's current status_code = 'on_call' (log warning and skip if not)
Action:   updateAgentStatus(userId, 'wrap_up', correlationId)
Audit:    event_name = 'agent_status_changed', payload = { previousStatus: 'on_call', newStatus: 'wrap_up', trigger: 'cti_hangup_event', cmiuuid }
```

### Rule 3: Wrap-up interaction CLOSED → `ready_for_calls`

This rule fires in the **interaction close flow** — specifically when the agent submits the wrap-up interaction and the interaction transitions to `CLOSED` status. It must NOT fire on wrap-up save (which only moves the interaction to `WRAPUP` status).

```
Trigger:  Interaction status transition → 'CLOSED'
          (i.e. the existing close/submit interaction endpoint in interaction.service.ts)
Gate:     users WHERE id = interaction.started_by_user_id AND session_mode = 'cti'
          AND agent_statuses WHERE user_id = interaction.started_by_user_id AND status_code = 'wrap_up'
Precondition: agent must be in 'wrap_up' status AND session_mode must be 'cti'
Action:   updateAgentStatus(userId, 'ready_for_calls', correlationId)
Audit:    event_name = 'agent_status_changed', payload = { previousStatus: 'wrap_up', newStatus: 'ready_for_calls', trigger: 'wrapup_interaction_closed', interactionId }
```

**Critical distinction — CLOSE vs. SAVE:**

The interaction lifecycle in Phase 1 has two distinct operations:
- **Save (disposition_saved event):** Agent fills in wrap-up fields and saves. Interaction transitions to `WRAPUP` status. This does NOT trigger auto-reset.
- **Close (interaction_closed event):** Agent confirms and submits. Interaction transitions to `CLOSED` status. This IS the trigger.

The auto-reset hook belongs in the code path that writes `interaction_closed` event and sets `status = 'CLOSED'`, not the path that writes `disposition_saved`.

### Rule 4: Manual mode — no auto-transitions

```
Gate:     users.session_mode = 'manual' OR users.session_mode IS NULL
Action:   None. All CTI webhook events are still processed for cti_call_logs persistence,
          but no agent_status transitions are fired.
```

### TeleCMI status sync guard

The existing `setTeleCmiAgentStatus()` call in `agent-status.service.ts` must not be triggered when the new status is `on_call` or `wrap_up`. These statuses are already reflected in TeleCMI (TeleCMI drove them into CCM), so a reverse sync is both wrong and circular. Add an explicit guard:

```typescript
// Do not sync on_call or wrap_up back to TeleCMI — TeleCMI is the source for these
if (newStatus === 'on_call' || newStatus === 'wrap_up') {
  return updated; // skip TeleCMI sync entirely
}
```

---

## Section 5 — Interactions List Endpoint Design

### Endpoint

```
GET /api/v1/interactions
Access: agent role only (authenticate middleware + role check)
CSRF:   read-only endpoint — no CSRF token required
```

### Query parameters

| Param | Type | Default | Notes |
|---|---|---|---|
| `status` | `'INCOMPLETE' \| 'COMPLETE'` | both | Filter to one status. `COMPLETE` maps to `CLOSED` in the DB. |
| `page` | integer | 1 | 1-based page number |
| `pageSize` | integer | 25 | Max 100 |

### SQL query structure

```sql
SELECT
  i.id,
  i.channel,
  i.mode,
  i.status,
  i.started_at,
  i.ended_at,
  i.started_by_user_id,
  u.display_name     AS agent_name,
  -- Customer name comes from the context snapshot stored at the time of identification.
  -- The snapshot_json field on context_snapshots (snapshot_type='customer') holds
  -- the external customer payload. The name field is nested inside snapshot_json.
  cs.snapshot_json->>'name'  AS customer_name,
  cs.source_reference        AS customer_ref,
  i.current_vehicle_ref,
  i.correlation_id
FROM interactions i
JOIN users u ON u.id = i.started_by_user_id
LEFT JOIN context_snapshots cs
  ON cs.interaction_id = i.id
  AND cs.snapshot_type = 'customer'
WHERE i.status IN ('CLOSED', 'INCOMPLETE')
ORDER BY i.started_at DESC
LIMIT $1 OFFSET $2
```

**Notes on the customer name join:**
- The `context_snapshots` table (migration 009) stores point-in-time customer data as `snapshot_json JSONB`.
- `snapshot_type = 'customer'` is the correct discriminator value (defined in migration 009 `CHECK` constraint: `'customer' | 'vehicle' | 'dealer' | 'combined'`).
- The actual JSON key holding the customer name (`'name'`) must be verified against the customer adapter output shape. If the field is `'customerName'` in the adapter, the expression is `cs.snapshot_json->>'customerName'`. The QA engineer must validate this against a live snapshot row.
- The `LEFT JOIN` handles interactions that were never context-confirmed (no snapshot exists) — they return `NULL` for `customer_name`.
- There is no dedicated `customers` table in CCM. CCM does not own customer master data. Vahan/iDMS are the sources and CCM only holds snapshots.

### Count query for pagination

```sql
SELECT COUNT(*) FROM interactions WHERE status IN ('CLOSED', 'INCOMPLETE')
```

### Index recommendations

The existing indexes cover most of this query:

| Index | Migration | Covers |
|---|---|---|
| `idx_interactions_status` | 005 | `WHERE status IN (...)` |
| `idx_interactions_started_at` | 005 | `ORDER BY started_at DESC` |
| `idx_context_snapshots_interaction_id` | 009 | `LEFT JOIN ON cs.interaction_id` |
| `idx_context_snapshots_snapshot_type` | 009 | `AND cs.snapshot_type = 'customer'` |

A composite index on `(interaction_id, snapshot_type)` on `context_snapshots` would be more efficient than two separate index scans for the join condition:

```sql
-- Add to migration 031 or as a separate migration 032
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_context_snapshots_interaction_type
  ON context_snapshots (interaction_id, snapshot_type);
```

### Access control

The endpoint is available to users with the `agent` role. Agents see all agents' interactions (no row-level filtering by `started_by_user_id`). This is by design — the page is a shared operational view, not a personal queue.

---

## Section 6 — Risk Register

### R1: `on_call` / `wrap_up` accepted by agent-initiated PATCH

**Risk:** After the `AgentStatus` enum is extended, the Zod validator in `agent-status.validator.ts` currently uses `z.nativeEnum(AgentStatus)`. This would silently start accepting `on_call` and `wrap_up` as valid inputs from agents.

**Consequence:** An agent could manually force themselves into or out of `on_call`/`wrap_up` status, breaking CTI state machine integrity.

**Prevention:** Change the validator to an explicit allowlist: `z.enum(['ready_for_calls', 'break', 'offline', 'training'])`. This is the single most important change from a regression standpoint.

**Test scenario:**
```
PATCH /api/v1/agent-status { status: "on_call" }
Expected: 422 Validation Error
```

---

### R2: TeleCMI reverse sync loop on `on_call` / `wrap_up`

**Risk:** The existing TeleCMI status sync in `agent-status.service.ts` fires on every `updateAgentStatus()` call. If `on_call` or `wrap_up` is written (by the CTI webhook handler), the sync block would attempt to map these back to a TeleCMI status — which does not exist for these values. It would silently skip (`telecmiStatus = null`), but this is fragile behavior that depends on the absence of a mapping entry.

**Prevention:** Add an explicit early-return guard for `on_call` and `wrap_up` at the top of the TeleCMI sync block (documented in Section 4 above). This is defensive and self-documenting.

**Test scenario:**
- Simulate a `started` webhook event → confirm `setTeleCmiAgentStatus` is NOT called.
- Simulate a `hangup` webhook event → confirm `setTeleCmiAgentStatus` is NOT called.

---

### R3: Auto-reset fires on wrapup SAVE instead of CLOSE

**Risk:** The auto-reset to `ready_for_calls` is scoped to the `interaction_closed` path. If the hook is placed in the wrong code path (e.g., in the `disposition_saved` / wrapup save handler), agents are returned to `ready_for_calls` before completing the interaction, losing the interaction record.

**Prevention:** The hook must only be in the code path that sets `interactions.status = 'CLOSED'` and writes an `interaction_closed` event. Code review must verify the hook is NOT in the `WRAPUP` status transition path.

**Test scenarios:**
- Agent saves wrapup fields (disposition_saved) → agent status must remain `wrap_up`.
- Agent closes the interaction (interaction_closed) → agent status must transition to `ready_for_calls`.

---

### R4: `session_mode` NULL check absent from webhook handler

**Risk:** If the webhook handler calls `updateAgentStatus` without checking `session_mode = 'cti'`, agents in manual mode would have their status silently hijacked by any inbound call events.

**Prevention:** The lookup query in the webhook handler must include `AND session_mode = 'cti'` in the `WHERE` clause. If no matching user is found (or `session_mode != 'cti'`), the webhook still logs to `cti_call_logs` (for auditability) but performs no status transition.

**Test scenarios:**
- Agent in manual mode receives a `started` event → status must remain unchanged.
- Agent in CTI mode receives a `started` event → status transitions to `on_call`.
- Agent with `session_mode IS NULL` receives a `started` event → status must remain unchanged.

---

### R5: Interaction constraint regression — one open interaction per agent

**Risk:** The `interactions_one_open_per_agent` EXCLUDE constraint (migration 005) prevents two open interactions for the same agent simultaneously. In CTI mode, the system auto-creates an interaction on `waiting` (proactive) or `started`. If the agent already has an open manual interaction from a prior session, the constraint will fire.

**Prevention:** The CTI interaction creation path must check for existing open interactions first and handle the conflict gracefully (log and skip creation, or close the orphan first). This is an operational edge case, not a code defect, but it must be covered in QA scenarios.

**Test scenario:**
- Seed agent with an open `IDENTIFYING` interaction.
- Fire a `started` webhook event for the same agent.
- Expected: system does not create a duplicate interaction; existing interaction is used or a clear error is logged.

---

### R6: `context_snapshots` join returns multiple rows

**Risk:** If a single interaction has more than one `snapshot_type = 'customer'` row (possible if the customer was re-selected), the `LEFT JOIN` in the interactions list query returns duplicate interaction rows.

**Prevention:** Add a `DISTINCT ON (i.id)` or use a subquery with `ORDER BY cs.captured_at DESC LIMIT 1` to get the most recent customer snapshot only:

```sql
LEFT JOIN LATERAL (
  SELECT snapshot_json, source_reference
  FROM context_snapshots
  WHERE interaction_id = i.id
    AND snapshot_type = 'customer'
  ORDER BY captured_at DESC
  LIMIT 1
) cs ON TRUE
```

Use the `LATERAL` join form in the implementation.

---

### R7: Migration sequencing — 031 must follow 030

Migration `030_add_session_mode_to_users.sql` adds `session_mode` to `users`. Migration `031_extend_agent_statuses_for_cti.sql` extends the `agent_statuses` CHECK constraints. These are independent DDL operations and can be applied in either order, but they must both be applied before any Phase 1.5 code is deployed. The `migration-check` skill must be run on both files before deployment.

---

## Appendix: Migration Sequence Summary

| Migration number | File | Purpose |
|---|---|---|
| 030 | `030_add_session_mode_to_users.sql` | Add nullable `session_mode VARCHAR(10)` to `users` |
| 031 | `031_extend_agent_statuses_for_cti.sql` | Extend `agent_statuses` CHECK constraints to include `on_call` and `wrap_up`; add composite index on `context_snapshots` |

Both migrations are additive (no destructive DDL) and can be applied with zero downtime using `ADD COLUMN IF NOT EXISTS` and `DROP CONSTRAINT / ADD CONSTRAINT`.
