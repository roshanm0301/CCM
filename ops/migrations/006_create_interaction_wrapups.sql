-- =============================================================================
-- Migration 006: Create interaction_wrapups table
--
-- Structured closure metadata for an interaction.
-- Separated from the base interaction for clarity and change history.
-- Source: data-model-outline.md § interaction_wrapups
-- =============================================================================

CREATE TABLE IF NOT EXISTS interaction_wrapups (
  id                           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  interaction_id               UUID        NOT NULL UNIQUE REFERENCES interactions(id) ON DELETE CASCADE,
  contact_reason_code          VARCHAR(100) NOT NULL,
  identification_outcome_code  VARCHAR(100) NOT NULL,
  interaction_disposition_code VARCHAR(100) NOT NULL,
  remarks                      TEXT,
  saved_by_user_id             UUID        NOT NULL REFERENCES users(id),
  saved_at                     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_interaction_wrapups_interaction_id
  ON interaction_wrapups (interaction_id);

COMMENT ON TABLE interaction_wrapups IS 'Structured wrap-up data captured when an agent closes or finalises an interaction.';
COMMENT ON COLUMN interaction_wrapups.contact_reason_code IS 'References reference_values.code WHERE reference_type = ''contact_reason''.';
COMMENT ON COLUMN interaction_wrapups.identification_outcome_code IS 'References reference_values.code WHERE reference_type = ''identification_outcome''.';
COMMENT ON COLUMN interaction_wrapups.interaction_disposition_code IS 'References reference_values.code WHERE reference_type = ''interaction_disposition''.';
