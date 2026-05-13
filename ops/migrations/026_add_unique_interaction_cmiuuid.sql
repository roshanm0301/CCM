-- =============================================================================
-- Migration 026 — Add UNIQUE constraint on interactions.cti_cmiuuid
--
-- Rationale: Without this constraint, a race condition where two agents answer
-- the same TeleCMI call simultaneously (e.g. network retry or TeleCMI SDK
-- glitch) could result in two interaction rows with the same cmiuuid. The
-- UNIQUE constraint prevents duplicate rows and makes the upsert in
-- cti.webhook.service.ts safe.
--
-- The partial index (WHERE cti_cmiuuid IS NOT NULL) means the constraint only
-- applies to rows with a TeleCMI UUID — manual interactions (NULL) are
-- unaffected and multiple NULL values are allowed (SQL standard).
--
-- LOCKING NOTE:
-- `CREATE UNIQUE INDEX` (without CONCURRENTLY) takes an ACCESS EXCLUSIVE lock
-- on the interactions table for the full duration of the index build. This
-- blocks all reads and writes.
--
-- For CCM's standard deployment path (Docker Compose initdb on a fresh volume),
-- the interactions table is EMPTY at the time this migration runs, so the lock
-- is instantaneous and safe. No call traffic exists during first-time setup.
--
-- For a live database with existing data (e.g., blue/green upgrade):
--   1. Apply during a maintenance window, OR
--   2. Run this statement manually outside a transaction using CONCURRENTLY:
--      CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_interactions_cti_cmiuuid_unique
--        ON interactions (cti_cmiuuid) WHERE cti_cmiuuid IS NOT NULL;
--      Note: CREATE INDEX CONCURRENTLY cannot run inside a transaction block.
--
-- Pre-flight check: Verify no duplicate cti_cmiuuid values exist before applying.
-- If duplicates are found the index build will fail. Run this first:
--   SELECT cti_cmiuuid, COUNT(*) FROM interactions
--   WHERE cti_cmiuuid IS NOT NULL
--   GROUP BY cti_cmiuuid HAVING COUNT(*) > 1;
-- =============================================================================

CREATE UNIQUE INDEX IF NOT EXISTS idx_interactions_cti_cmiuuid_unique
  ON interactions (cti_cmiuuid)
  WHERE cti_cmiuuid IS NOT NULL;
