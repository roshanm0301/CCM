# Data Model Outline

## Purpose
This document outlines the technical data model boundaries for CCM. It is intentionally an outline, not a finalized schema, so solution and backend agents can design implementation-ready models without inventing business functionality outside the supplied phase documents.

## Agents that use this document
| Agent | How it is used |
|---|---|
| Solution Architect Agent | Defines data ownership and persistence boundaries |
| Backend Engineer Agent | Designs tables, documents, repositories, and migration plans |
| QA Engineer Agent | Validates persistence behavior and audit completeness |
| DevOps Engineer Agent | Plans backups, restore strategy, and environment provisioning |

## Data modeling rules
1. Use PostgreSQL for authoritative workflow transactions.
2. Use MongoDB only where document flexibility, payload retention, or variable read models are justified.
3. Do not mirror the same authoritative write in both databases.
4. External master data remains externally owned unless explicitly synchronized into approved local reference tables.
5. Every persisted workflow mutation must be auditable.

## Recommended ownership map
| Domain | Preferred store | Ownership rule |
|---|---|---|
| User/session/access references | PostgreSQL | transactional/security aligned |
| Interaction lifecycle | PostgreSQL | authoritative |
| Search attempts and normalized search metadata | PostgreSQL | authoritative audit of user action |
| Interaction events | PostgreSQL | authoritative audit trail |
| External context snapshots | PostgreSQL or MongoDB depending on shape and retention need | snapshot only, not source truth |
| Raw integration payloads | MongoDB when retention is approved | diagnostic/reference only |
| Configurable reference lookups used by app | PostgreSQL cache/reference tables if local copy is needed | source ownership declared |

## PostgreSQL entity outline

### 1. users
Purpose:
- local user reference if authentication is app-managed or needs local role mapping.

Key fields:
- `id`
- `external_user_ref` if applicable
- `username`
- `display_name`
- `status`
- `created_at`
- `updated_at`

### 2. roles
Purpose:
- system role definitions.

### 3. permissions
Purpose:
- permission catalog if RBAC is implemented internally.

### 4. user_role_assignments
Purpose:
- many-to-many user-role mapping.

### 5. interactions
Purpose:
- top-level interaction record.

Representative fields:
- `id`
- `channel`
- `mode`
- `status`
- `started_at`
- `ended_at`
- `started_by_user_id`
- `completion_flag`
- `current_customer_ref`
- `current_vehicle_ref`
- `current_dealer_ref`
- `correlation_id`
- `created_at`
- `updated_at`

### 6. interaction_wrapups
Purpose:
- structured closure metadata separated from the base interaction for clarity and change history.

Representative fields:
- `id`
- `interaction_id`
- `contact_reason_code`
- `identification_outcome_code`
- `interaction_disposition_code`
- `remarks`
- `saved_by_user_id`
- `saved_at`

### 7. search_attempts
Purpose:
- auditable record of search activity.

Representative fields:
- `id`
- `interaction_id`
- `search_filter_code`
- `raw_value`
- `normalized_value`
- `attempted_at`
- `attempted_by_user_id`
- `result_count`
- `primary_source_used`
- `fallback_source_used`
- `outcome_status`

### 8. interaction_events
Purpose:
- append-only event log for key workflow events.

Representative fields:
- `id`
- `interaction_id`
- `event_name`
- `event_at`
- `actor_user_id`
- `event_payload_json`
- `correlation_id`

### 9. context_snapshots
Purpose:
- optional point-in-time operational snapshot of selected external context to support traceability.

Representative fields:
- `id`
- `interaction_id`
- `snapshot_type` (`customer`, `vehicle`, `dealer`, `combined`)
- `source_system`
- `source_reference`
- `snapshot_json`
- `captured_at`

### 10. reference_values
Purpose:
- controlled values used by the application when a local copy is needed.

Representative fields:
- `id`
- `reference_type`
- `code`
- `label`
- `sort_order`
- `is_active`
- `effective_from`
- `effective_to`

## MongoDB collection outline

### 1. integration_payloads
Use only if raw payload retention is approved.

Suggested contents:
- request envelope
- response envelope
- adapter metadata
- redaction status
- retention expiry

### 2. context_read_models
Use only if composed context responses are complex, variable, or require cache-like reuse.

### 3. technical_diagnostics
Optional diagnostic collection for adapter failures, only if logs/metrics are insufficient and retention is governed.

## Relationships
```text
users --< user_role_assignments >-- roles
interactions --< interaction_wrapups
interactions --< search_attempts
interactions --< interaction_events
interactions --< context_snapshots
```

## Indexing guidance
### PostgreSQL
Create indexes for:
- interaction status,
- started_at / ended_at,
- started_by_user_id,
- interaction_id foreign keys,
- event_name + event_at,
- search normalization fields when queryable.

### MongoDB
Index only approved query patterns. Do not store large raw payloads without:
- retention limit,
- access control,
- redaction plan.

## Migration strategy
- Use versioned SQL migrations for PostgreSQL.
- Use explicit collection bootstrap/index scripts for MongoDB.
- Treat schema evolution as code-reviewed change.

## Data retention guidance
Before production launch, define:
- interaction retention period,
- event retention period,
- raw payload retention period,
- purge/archive workflow,
- legal/compliance hold handling.

## Phase evolution rule
When future phases introduce cases, tasks, SLA, escalations, or dealer/HO workflows:
- add new aggregates/modules,
- do not overload `interactions` with unrelated lifecycle data,
- preserve interaction as a distinct operational record.
