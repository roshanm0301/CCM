-- =============================================================================
-- Migration 101: Create case_activity_state table
--
-- Tracks the current activity step for each registered case.
-- Exactly one row per case_id (PRIMARY KEY). Upserted on every activity save.
--
-- Optimistic locking: the `version` column prevents concurrent saves from
-- corrupting the step state. The save service reads the current version and
-- updates with WHERE version = $current_version. If 0 rows are updated,
-- a 409 Conflict is returned to the caller.
--
-- Initialisation: when no row exists for a case_id, the service creates one
-- at the start step (isStartStep = true in activity_template_step) using
-- INSERT ... ON CONFLICT DO NOTHING to safely handle race conditions.
--
-- Source: CCM_Phase6_Resolution_Activities.md — Process 3 (Initial Load),
--         Process 4 (Save Resolution Activity)
-- =============================================================================

CREATE TABLE IF NOT EXISTS case_activity_state (
  -- ISR-format case reference — one row per case
  case_id              VARCHAR(20)  PRIMARY KEY,

  -- MongoDB ObjectId of the activity_template driving this case
  template_id          VARCHAR(100) NOT NULL,

  -- Step number the case is currently at (references activity_template_step.step_no)
  current_step_no      INTEGER      NOT NULL,

  -- Mirrors the MongoDB case document's caseStatus field.
  -- Kept in sync so dealer catalog queries can filter without a MongoDB lookup.
  case_status          VARCHAR(50)  NOT NULL DEFAULT 'Open',

  -- Activity lifecycle status: Fresh → In Progress → Resolved
  activity_status      VARCHAR(50)  NOT NULL DEFAULT 'Fresh',

  -- Optimistic lock counter. Incremented on every successful upsert.
  version              INTEGER      NOT NULL DEFAULT 1,

  -- User who last updated this state row
  last_updated_by      UUID         NOT NULL REFERENCES users(id),

  -- Timestamp of last state transition
  updated_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  CONSTRAINT case_activity_state_case_status_check
    CHECK (case_status IN ('Open', 'Pending Verification', 'Closed – Verified', 'Closed – Not Verified')),

  CONSTRAINT case_activity_state_activity_status_check
    CHECK (activity_status IN ('Fresh', 'In Progress', 'Resolved'))
);

-- Support dealer catalog queries that filter by status
CREATE INDEX IF NOT EXISTS idx_case_activity_state_case_status
  ON case_activity_state (case_status);

CREATE INDEX IF NOT EXISTS idx_case_activity_state_activity_status
  ON case_activity_state (activity_status);

COMMENT ON TABLE case_activity_state IS
  'Single-row-per-case state machine. Tracks the current step and case/activity status for each registered case. Updated via optimistic lock on every resolution activity save.';
COMMENT ON COLUMN case_activity_state.version IS
  'Optimistic lock counter. Save service reads this value and updates with WHERE version = $read_version. 0 rows updated = 409 Conflict.';
COMMENT ON COLUMN case_activity_state.case_status IS
  'Mirrors the MongoDB case document caseStatus. Kept in sync so PostgreSQL-side catalog queries can filter by status without a cross-DB lookup.';
