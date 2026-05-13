-- =============================================================================
-- Migration 100: Create resolution_activities table
--
-- Append-only log of all resolution activity outcomes saved by dealer roles
-- against a registered case. This table IS the audit trail for Phase 6
-- resolution workflow — one row per saved outcome.
--
-- Source: CCM_Phase6_Resolution_Activities.md — Feature 3/4, Process 4
-- =============================================================================

CREATE TABLE IF NOT EXISTS resolution_activities (
  id                   UUID         PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Soft reference to MongoDB cases collection (ISR-001 format).
  -- No FK enforced across DB boundary — validated at the service layer.
  case_id              VARCHAR(20)  NOT NULL,

  -- MongoDB ObjectId of the resolved activity_template document
  template_id          VARCHAR(100) NOT NULL,

  -- Step number within the template at which this activity was performed
  step_no              INTEGER      NOT NULL,

  -- MongoDB ObjectId of the activity_master entry for this step
  activity_id          VARCHAR(100) NOT NULL,

  -- Name of the outcome as configured in activity_outcome for this step
  outcome_name         VARCHAR(200) NOT NULL,

  -- Type of outcome (drives workflow transition after save)
  outcome_type         VARCHAR(20)  NOT NULL,

  -- Role that actually performed this activity (from the authenticated user's roles)
  performed_role       VARCHAR(100) NOT NULL,

  -- User who saved this activity
  performed_by_user_id UUID         NOT NULL REFERENCES users(id),

  -- Agent/dealer remarks entered at save time (mandatory, max 500 chars)
  remarks              TEXT         NOT NULL,

  -- Comma-separated list of MongoDB attachment IDs (empty string when none)
  -- Full attachment metadata is stored in case_attachment_refs
  attachment_ids       TEXT         NOT NULL DEFAULT '',

  -- Immutable audit timestamp
  created_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  CONSTRAINT resolution_activities_outcome_type_check
    CHECK (outcome_type IN ('MoveForward', 'Loop', 'Close'))
);

-- Primary access pattern: all activities for a case, ordered by time
CREATE INDEX IF NOT EXISTS idx_resolution_activities_case_id
  ON resolution_activities (case_id);

-- Composite index for history queries (case ordered latest-first)
CREATE INDEX IF NOT EXISTS idx_resolution_activities_case_id_created_at
  ON resolution_activities (case_id, created_at DESC);

-- Actor lookup for audit queries
CREATE INDEX IF NOT EXISTS idx_resolution_activities_performed_by
  ON resolution_activities (performed_by_user_id);

COMMENT ON TABLE resolution_activities IS
  'Append-only resolution activity log. One row per saved outcome. Serves as the audit trail for Phase 6 resolution workflow.';
COMMENT ON COLUMN resolution_activities.case_id IS
  'ISR-format case reference (soft link to MongoDB cases collection).';
COMMENT ON COLUMN resolution_activities.outcome_type IS
  'MoveForward = advance to next step; Loop = stay on same step; Close = close the case.';
COMMENT ON COLUMN resolution_activities.attachment_ids IS
  'Comma-separated MongoDB ObjectIds of uploaded attachments. Empty string when no attachments.';
