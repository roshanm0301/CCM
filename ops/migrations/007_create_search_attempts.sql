-- =============================================================================
-- Migration 007: Create search_attempts table
--
-- Auditable record of every search performed by an agent during an interaction.
-- Source: data-model-outline.md § search_attempts
-- =============================================================================

CREATE TABLE IF NOT EXISTS search_attempts (
  id                   UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  interaction_id       UUID         NOT NULL REFERENCES interactions(id) ON DELETE CASCADE,
  -- search_filter_code references reference_values (search_filter)
  search_filter_code   VARCHAR(100) NOT NULL,
  raw_value            TEXT         NOT NULL,
  normalized_value     TEXT         NOT NULL,
  attempted_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  attempted_by_user_id UUID         NOT NULL REFERENCES users(id),
  result_count         INTEGER      NOT NULL DEFAULT 0,
  primary_source_used  VARCHAR(200),
  fallback_source_used VARCHAR(200),
  -- outcome_status: results_found | no_results | error | ambiguous
  outcome_status       VARCHAR(50)  NOT NULL DEFAULT 'no_results',

  CONSTRAINT search_attempts_result_count_check CHECK (result_count >= 0),
  CONSTRAINT search_attempts_outcome_status_check
    CHECK (outcome_status IN ('results_found', 'no_results', 'error', 'ambiguous'))
);

CREATE INDEX IF NOT EXISTS idx_search_attempts_interaction_id
  ON search_attempts (interaction_id);

CREATE INDEX IF NOT EXISTS idx_search_attempts_attempted_by_user_id
  ON search_attempts (attempted_by_user_id);

CREATE INDEX IF NOT EXISTS idx_search_attempts_attempted_at
  ON search_attempts (attempted_at DESC);

COMMENT ON TABLE search_attempts IS 'Audit log of every search performed by an agent. Authoritative record of search activity.';
COMMENT ON COLUMN search_attempts.search_filter_code IS 'References reference_values.code WHERE reference_type = ''search_filter''.';
COMMENT ON COLUMN search_attempts.raw_value IS 'The raw value as entered by the agent (before normalization).';
COMMENT ON COLUMN search_attempts.normalized_value IS 'The normalized/sanitized value used in the actual search query.';
COMMENT ON COLUMN search_attempts.outcome_status IS 'results_found | no_results | error | ambiguous';
