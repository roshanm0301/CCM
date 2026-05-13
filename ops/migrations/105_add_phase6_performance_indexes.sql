-- =============================================================================
-- Migration 105: Phase 6 performance indexes
--
-- Adds non-unique indexes for the four Phase 6 PostgreSQL tables:
--   resolution_activities  (migration 100)
--   case_activity_state    (migration 101)
--   case_followups         (migration 102)
--   case_attachment_refs   (migration 103)
--
-- Migrations 100-103 already created the primary access-pattern indexes
-- (case_id, case_id+created_at, case_status, activity_status). This
-- migration adds the remaining gaps identified during Wave 4 hardening:
--
--   1. case_activity_state — actor audit lookup (last_updated_by)
--      Missing from migration 101; inconsistent with the pattern used in
--      resolution_activities (performed_by_user_id) and
--      case_followups (created_by_user_id).
--
--   2. case_activity_state — compound (case_status, activity_status)
--      Supports catalog and dashboard queries that filter on both
--      dimensions simultaneously (e.g. Open + In Progress).
--      Currently requires two single-column index scans + merge.
--
--   3. case_activity_state — updated_at DESC
--      Supports "recently updated cases" ordering without a full table
--      scan. Also used by any future agent-side case list that sorts by
--      last activity.
--
--   4. case_attachment_refs — actor audit lookup (uploaded_by_user_id)
--      Missing from migration 103; inconsistent with resolution_activities
--      (performed_by_user_id) and case_followups (created_by_user_id).
--
--   5. resolution_activities — template_id
--      Supports template management queries: "all cases currently running
--      on template X" — needed when a template is edited or deprecated.
--
-- All indexes use IF NOT EXISTS so this migration is idempotent.
--
-- MongoDB note (out of scope for SQL migrations):
--   The dealer catalog repository (cases-dealer.repository.ts) queries the
--   MongoDB cases collection filtered by dealerRef + optional caseStatus /
--   caseNature / department / productType and sorted by registeredAt DESC.
--   The following compound indexes should be created on the cases collection
--   via the Mongoose connection setup or a one-time Atlas/mongosh script:
--     { dealerRef: 1, registeredAt: -1 }
--     { dealerRef: 1, caseStatus: 1, registeredAt: -1 }
--   These cannot be expressed in a PostgreSQL migration and are tracked as
--   a separate ops task.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. case_activity_state — actor audit lookup
-- ---------------------------------------------------------------------------
-- Mirrors the actor lookup indexes on resolution_activities and case_followups.
-- Supports queries like "all state rows last updated by user X".
CREATE INDEX IF NOT EXISTS idx_case_activity_state_last_updated_by
  ON case_activity_state (last_updated_by);

-- ---------------------------------------------------------------------------
-- 2. case_activity_state — compound status filter
-- ---------------------------------------------------------------------------
-- Supports catalog/dashboard queries that filter by both case_status AND
-- activity_status simultaneously. Without this, PostgreSQL must perform two
-- separate index scans (one per single-column index) and merge the results.
-- The leading column is case_status because it has fewer distinct values and
-- is the primary display filter; activity_status narrows the result further.
CREATE INDEX IF NOT EXISTS idx_case_activity_state_status_compound
  ON case_activity_state (case_status, activity_status);

-- ---------------------------------------------------------------------------
-- 3. case_activity_state — temporal ordering
-- ---------------------------------------------------------------------------
-- Supports "recently updated cases" queries and any future agent-side case
-- list sorted by last activity timestamp. DESC order matches the most common
-- access pattern (latest-first).
CREATE INDEX IF NOT EXISTS idx_case_activity_state_updated_at
  ON case_activity_state (updated_at DESC);

-- ---------------------------------------------------------------------------
-- 4. case_attachment_refs — actor audit lookup
-- ---------------------------------------------------------------------------
-- Supports queries like "all attachments uploaded by user X" for audit and
-- compliance reporting. Mirrors the actor lookup pattern used on
-- resolution_activities (performed_by_user_id) and
-- case_followups (created_by_user_id).
CREATE INDEX IF NOT EXISTS idx_case_attachment_refs_uploaded_by
  ON case_attachment_refs (uploaded_by_user_id);

-- ---------------------------------------------------------------------------
-- 5. resolution_activities — template lookup
-- ---------------------------------------------------------------------------
-- Supports template management queries: when an activity_template is being
-- edited or deprecated, the service needs to find all resolution_activity
-- rows that were recorded under that template. Without this index the query
-- would require a full table scan as the table grows with case activity.
CREATE INDEX IF NOT EXISTS idx_resolution_activities_template_id
  ON resolution_activities (template_id);
