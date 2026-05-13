-- =============================================================================
-- Migration 027 — Add updated_at column to cti_call_logs
--
-- Rationale: cti_call_logs rows are upserted (ON CONFLICT DO UPDATE) when CDR
-- events arrive from TeleCMI after the initial 'waiting' record. Without an
-- updated_at column there is no way to determine when the row was last enriched
-- (e.g. when duration_sec was populated), which makes CDR debugging difficult.
-- =============================================================================

ALTER TABLE cti_call_logs
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Backfill existing rows: set updated_at = created_at as best approximation.
-- NOTE: Unconditional UPDATE (no WHERE) is intentional — the column was just added with
-- DEFAULT NOW() so every row will have updated_at = migration-time, not their actual
-- last-update time. Resetting all rows to created_at is the safest approximation.
-- This is safe even in autocommit mode (no NOW() equality comparison).
--
-- RE-RUN SAFETY: If this migration is accidentally re-run after real updated_at values
-- have accumulated, this UPDATE will overwrite them with created_at. Migration frameworks
-- (Flyway, Liquibase, or the Docker initdb init-once mechanism) prevent re-runs by design.
-- If running manually, verify migration state before re-applying.
UPDATE cti_call_logs SET updated_at = created_at;

-- Trigger to keep updated_at current on future upserts.
CREATE OR REPLACE FUNCTION cti_call_logs_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cti_call_logs_updated_at ON cti_call_logs;
CREATE TRIGGER trg_cti_call_logs_updated_at
  BEFORE UPDATE ON cti_call_logs
  FOR EACH ROW EXECUTE FUNCTION cti_call_logs_set_updated_at();
