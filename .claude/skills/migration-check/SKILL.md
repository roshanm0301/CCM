---
name: migration-check
description: Review new or modified SQL migration files for safety issues before they are applied. Checks for destructive DDL, wrong column types, missing constraints, missing foreign keys, sequence correctness, and rollback readiness. Routes issues to backend-engineer before the gate review catches them.
allowed-tools: Glob, Grep, Read, Agent
---

You are executing the `/migration-check` skill for the CCM project.

## What this skill does

Reviews every new or modified migration file in `ops/migrations/` against the safety rules from `data-model-outline.md` and the Devil's Advocate gate checklist. Catches migration issues before code ships — fixing a migration at authoring time costs 1x; fixing it in a gate review costs 10x; fixing it in production costs 100x.

---

## Step 1 — Identify migrations to review

Find all migration files:
```
Glob: pattern="ops/migrations/*.sql"
```

Determine which are NEW or MODIFIED in this wave (ask the user if git is unavailable).

If no specific migration is identified, review ALL migrations in sequence — checking order correctness and cumulative integrity.

---

## Step 2 — Sequence check

Verify that:
- Migration filenames follow the `NNN_description.sql` numbering convention
- No sequence numbers are duplicated
- No sequence gaps exist (e.g., 010 then 012 with no 011)
- Rollback files (`NNN_rollback_*.sql`) exist for any migration containing destructive DDL

List the sequence and flag any issues.

---

## Step 3 — Destructive DDL check

For each migration file, scan for:

```
Grep: pattern="DROP TABLE|DROP COLUMN|TRUNCATE|ALTER TABLE.*DROP|ALTER COLUMN.*TYPE|DELETE FROM"
```

For every destructive statement found:
- Is there a corresponding rollback migration file?
- Is the operation reversible (can data be recovered)?
- Is there a comment explaining why this destructive operation is safe?

**Rule:** Any destructive DDL without a rollback path is a CRITICAL issue.

---

## Step 4 — Column type correctness

```
Grep: pattern="BOOLEAN|VARCHAR|TEXT|INTEGER|BIGINT|UUID|TIMESTAMP|JSONB" (in each migration file)
```

Verify against `data-model-outline.md`:

| Field pattern | Required type | Common mistake |
|---|---|---|
| `completion_flag` | `BOOLEAN` | Was `VARCHAR` (fixed in migration 014) |
| `id` columns | `UUID DEFAULT gen_random_uuid()` | `SERIAL` or `INTEGER` |
| `*_at` timestamp fields | `TIMESTAMPTZ NOT NULL` | `TIMESTAMP` without TZ |
| `status` fields | `VARCHAR(50) NOT NULL` | `TEXT` (too permissive) |
| `event_payload_json` | `JSONB` | `TEXT` |
| `interaction_id` in events | `UUID REFERENCES interactions(id)` but **NULLABLE** | NOT NULL (breaks agent_status_changed events) |

Flag any column type that differs from the expected type.

---

## Step 5 — Constraint and foreign key check

For each table created or altered, verify:

**Primary key:** Every table must have a primary key defined.

**Foreign keys:** Check these required relationships from `data-model-outline.md`:
```
users --< user_role_assignments >-- roles
interactions --< interaction_wrapups
interactions --< search_attempts
interactions --< interaction_events   (interaction_id NULLABLE for status change events)
interactions --< context_snapshots
```

For each missing FK that the data model specifies, flag as HIGH severity.

**NOT NULL:** Mandatory fields from the data model must have `NOT NULL` in the migration.

**CHECK constraints:** If a column has a known valid set (e.g., `status`, `channel`, `mode`), check whether a CHECK constraint or enum is used.

---

## Step 6 — Index check

Verify that performance indexes exist (or are added) for:
- `interactions.status`
- `interactions.started_at`, `interactions.ended_at`
- `interactions.started_by_user_id`
- `interaction_events.event_name + event_at`
- `interaction_events.interaction_id`
- `search_attempts.interaction_id`

If a new table is added without any index beyond the PK, flag it for review.

---

## Step 7 — Seed data safety check

Verify that seed data files (`ops/seeds/`) are NOT mounted into the production migration path. The `docker-compose.yml` should have seed mounts commented out for production use.

```
Read: ops/migrations/ — confirm no seed data mixed with schema migrations
Read: docker-compose.yml — confirm seed volume is commented out
```

---

## Step 8 — Produce migration report

Output:

```
MIGRATION SAFETY REPORT
========================

Migration(s) reviewed: [list]
Sequence: [VALID / GAPS FOUND / DUPLICATES FOUND]

CRITICAL ISSUES (block deployment):
- [migration file:line] [issue] [fix required]

HIGH ISSUES (must resolve before production):
- [migration file:line] [issue] [fix required]

MEDIUM ISSUES (tracked backlog):
- [issue]

PASSED CHECKS:
- Sequence: ✅/❌
- No destructive DDL without rollback: ✅/❌
- Column types correct: ✅/❌
- Foreign keys present: ✅/❌
- Nullable interaction_id for event table: ✅/❌
- Indexes present: ✅/❌
- Seed data isolated: ✅/❌

VERDICT: SAFE TO APPLY / ISSUES MUST BE RESOLVED FIRST
```

---

## Step 9 — Route issues to backend-engineer

If any CRITICAL or HIGH issues exist, invoke the `backend-engineer` agent with:
1. The migration report from Step 8
2. The specific migration file(s) with issues
3. A request to fix all CRITICAL issues in the migration before it is applied or committed
4. Instruction to create a rollback migration file if any destructive DDL was added

If the migration is safe, present the clean report and state: "Migration [name] passes all safety checks. Safe to apply."

---

## Hard rules

- Do not modify migration files yourself. Report issues and route to backend-engineer.
- Run this skill whenever a new `.sql` file is added to `ops/migrations/`.
- A migration with destructive DDL and no rollback is always CRITICAL — no exceptions.
- The `interaction_id` nullable rule for `interaction_events` is non-negotiable — `agent_status_changed` events have no interaction ID.
