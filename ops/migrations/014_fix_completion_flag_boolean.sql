-- =============================================================================
-- Migration 014: Change completion_flag from VARCHAR(50) to BOOLEAN
--
-- The repository stores TRUE/FALSE (SQL booleans) and the TypeScript type is
-- boolean | null, but the column was defined as VARCHAR(50). PostgreSQL
-- accepts the implicit cast, however the `pg` driver returns the value as the
-- string 'true'/'false' rather than a native JS boolean, which breaks strict
-- comparisons in application code.
--
-- Source: data-model-outline.md § interactions; interaction.repository.ts
-- =============================================================================

ALTER TABLE interactions
  ALTER COLUMN completion_flag TYPE BOOLEAN
  USING CASE completion_flag
    WHEN 'true'  THEN TRUE
    WHEN 'false' THEN FALSE
    ELSE NULL
  END;

COMMENT ON COLUMN interactions.completion_flag IS
  'TRUE when the interaction was closed normally; FALSE when marked incomplete; NULL while the interaction is still open.';
