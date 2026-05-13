-- =============================================================================
-- Migration 102: Create case_followups table
--
-- Immutable follow-up entries added by agents against registered cases.
-- Once saved, a follow-up row is never updated or deleted — it is read-only.
--
-- Source: CCM_Phase6_Resolution_Activities.md — Feature 7 (Follow Up Add),
--         Feature 8 (Follow Up History), Process 8 & 9
-- =============================================================================

CREATE TABLE IF NOT EXISTS case_followups (
  id                   UUID         PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Soft reference to MongoDB cases collection (ISR-001 format)
  case_id              VARCHAR(20)  NOT NULL,

  -- Customer's remarks as captured by the agent (mandatory, max 500 chars)
  customer_remarks     TEXT         NOT NULL,

  -- Agent's own internal remarks (mandatory per spec, max 500 chars)
  agent_remarks        TEXT         NOT NULL,

  -- Display name of the agent at time of creation (denormalised for read-only display)
  agent_name           VARCHAR(200) NOT NULL,

  -- User who created this follow-up entry
  created_by_user_id   UUID         NOT NULL REFERENCES users(id),

  -- Optional link to a CTI call recording associated with this follow-up
  -- Null when no recording is available (Phase 6 stores it when available)
  call_recording_link  TEXT,

  -- Immutable audit timestamp — never updated after insert
  created_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Primary access pattern: all follow-ups for a case, latest-first
CREATE INDEX IF NOT EXISTS idx_case_followups_case_id
  ON case_followups (case_id);

CREATE INDEX IF NOT EXISTS idx_case_followups_case_id_created_at
  ON case_followups (case_id, created_at DESC);

-- Actor lookup for audit queries
CREATE INDEX IF NOT EXISTS idx_case_followups_created_by
  ON case_followups (created_by_user_id);

COMMENT ON TABLE case_followups IS
  'Immutable follow-up log. One row per follow-up added by an agent. Rows are never updated or deleted after insert.';
COMMENT ON COLUMN case_followups.customer_remarks IS
  'Agent''s record of what the customer communicated. Mandatory, trimmed before validation.';
COMMENT ON COLUMN case_followups.agent_remarks IS
  'Agent''s internal note. Mandatory, trimmed before validation.';
COMMENT ON COLUMN case_followups.agent_name IS
  'Denormalised display name captured at insert time for stable read-only display.';
COMMENT ON COLUMN case_followups.call_recording_link IS
  'URL to a CTI call recording, when available. Null otherwise.';
