-- =============================================================================
-- Migration 010: Create reference_values table
--
-- Local cache of controlled values used by the CCM application.
-- These are the master reference values for dropdowns, validations, etc.
-- Source: data-model-outline.md § reference_values
-- =============================================================================

CREATE TABLE IF NOT EXISTS reference_values (
  id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  -- reference_type groups values: search_filter | contact_reason |
  --   identification_outcome | interaction_disposition | agent_status
  reference_type VARCHAR(100) NOT NULL,
  code           VARCHAR(100) NOT NULL,
  label          VARCHAR(300) NOT NULL,
  sort_order     INTEGER      NOT NULL DEFAULT 0,
  is_active      BOOLEAN      NOT NULL DEFAULT TRUE,
  effective_from TIMESTAMPTZ,
  effective_to   TIMESTAMPTZ,
  -- Flexible metadata for UI-driven behaviour (e.g. {"remarksRequired": true} for specific dispositions)
  metadata       JSONB,
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  CONSTRAINT reference_values_type_code_unique UNIQUE (reference_type, code)
);

-- Index for the common lookup pattern: all active values of a given type
CREATE INDEX IF NOT EXISTS idx_reference_values_type_active
  ON reference_values (reference_type, is_active, sort_order);

COMMENT ON TABLE reference_values IS 'Controlled reference value cache for CCM dropdowns and validations.';
COMMENT ON COLUMN reference_values.reference_type IS 'Logical grouping key: search_filter | contact_reason | identification_outcome | interaction_disposition | agent_status';
COMMENT ON COLUMN reference_values.code IS 'Machine-readable code stored in interaction records.';
COMMENT ON COLUMN reference_values.label IS 'Human-readable display label for the UI.';
COMMENT ON COLUMN reference_values.effective_from IS 'Inclusive start date from which this value is valid. NULL = always valid from creation.';
COMMENT ON COLUMN reference_values.effective_to IS 'Exclusive end date after which this value is inactive. NULL = no expiry.';
COMMENT ON COLUMN reference_values.metadata IS 'Optional JSON metadata for UI-driven behaviour, e.g. {"remarksRequired": true}.';
