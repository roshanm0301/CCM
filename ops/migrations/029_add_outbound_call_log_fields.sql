-- =============================================================================
-- Migration 029 — Extend cti_call_logs for outbound call tracking
--
-- Rationale: Outbound click2call API returns a `request_id` synchronously but
-- the `cmiuuid` (TeleCMI's canonical call identifier) is only available via
-- CDR webhook after the call is established. This migration adds:
--
--   1. request_id column — stores the click2call response ID used to link the
--      initial cti_call_logs row to the CDR webhook upsert that arrives later.
--
--   2. 'cancelled' status — outbound calls that are terminated before being
--      answered receive a live `hangup` event with no billsec. The status
--      transitions to 'cancelled' to distinguish from 'missed' (outbound
--      calls that rang but were not answered by the destination).
--
--   3. Partial index on request_id — enables fast lookup when the CDR webhook
--      arrives and needs to find the initial row by request_id before cmiuuid
--      has been populated.
--
--   4. Index on direction — enables dashboard queries filtering by
--      direction='outbound'.
--
-- Locking note: All DDL here (ALTER TABLE ADD COLUMN IF NOT EXISTS, CREATE INDEX
-- CONCURRENTLY) is low-impact:
--   - ADD COLUMN with DEFAULT NULL is metadata-only in PostgreSQL 11+ (no
--     table rewrite). It takes a brief ACCESS EXCLUSIVE lock only to update
--     pg_attribute, not to scan all rows.
--   - CREATE INDEX CONCURRENTLY does not lock reads or writes at all; it
--     runs concurrently with normal table activity.
--   - The ALTER TABLE ... CHECK constraint drop+add takes ACCESS EXCLUSIVE
--     only for the duration of the constraint validation (fast for small tables).
-- =============================================================================

-- ── 1. Add request_id column ────────────────────────────────────────────────
ALTER TABLE cti_call_logs
  ADD COLUMN IF NOT EXISTS request_id VARCHAR(100);

-- ── 2. Extend status CHECK to include 'cancelled' ───────────────────────────
ALTER TABLE cti_call_logs DROP CONSTRAINT IF EXISTS cti_call_logs_status_check;
ALTER TABLE cti_call_logs ADD CONSTRAINT cti_call_logs_status_check
  CHECK (status IN ('waiting', 'answered', 'missed', 'cancelled'));

-- ── 3. Partial index on request_id (non-null rows only) ────────────────────
-- CONCURRENTLY avoids any lock on live tables; safe to run during business hours.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cti_call_logs_request_id
  ON cti_call_logs (request_id)
  WHERE request_id IS NOT NULL;

-- Pre-flight duplicate check (informational — run before applying in production):
-- SELECT request_id, COUNT(*) FROM cti_call_logs WHERE request_id IS NOT NULL
-- GROUP BY request_id HAVING COUNT(*) > 1;

-- ── 4. Index on direction column ────────────────────────────────────────────
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cti_call_logs_direction
  ON cti_call_logs (direction);
