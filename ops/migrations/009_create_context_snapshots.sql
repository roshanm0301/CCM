-- =============================================================================
-- Migration 009: Create context_snapshots table
--
-- Optional point-in-time snapshots of selected external context (customer,
-- vehicle, dealer) to support interaction traceability.
-- These are NOT the source of truth — external systems are authoritative.
-- Source: data-model-outline.md § context_snapshots
-- =============================================================================

CREATE TABLE IF NOT EXISTS context_snapshots (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  interaction_id   UUID        NOT NULL REFERENCES interactions(id) ON DELETE CASCADE,
  -- snapshot_type: customer | vehicle | dealer | combined
  snapshot_type    VARCHAR(50) NOT NULL,
  source_system    VARCHAR(200),
  source_reference VARCHAR(200),
  -- snapshot_json stores the point-in-time external context payload.
  -- Must be governed: no unnecessary PII retention beyond the interaction period.
  snapshot_json    JSONB       NOT NULL,
  captured_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT context_snapshots_type_check
    CHECK (snapshot_type IN ('customer', 'vehicle', 'dealer', 'combined'))
);

CREATE INDEX IF NOT EXISTS idx_context_snapshots_interaction_id
  ON context_snapshots (interaction_id);

CREATE INDEX IF NOT EXISTS idx_context_snapshots_snapshot_type
  ON context_snapshots (snapshot_type);

COMMENT ON TABLE context_snapshots IS 'Point-in-time snapshots of external context for interaction traceability. Not a source of truth.';
COMMENT ON COLUMN context_snapshots.snapshot_type IS 'customer | vehicle | dealer | combined';
COMMENT ON COLUMN context_snapshots.source_system IS 'The external system from which this snapshot was captured.';
COMMENT ON COLUMN context_snapshots.source_reference IS 'The ID or reference from the source system for the snapshotted entity.';
COMMENT ON COLUMN context_snapshots.snapshot_json IS 'Captured payload. Must be governed: apply retention policy and purge per policy before production launch.';
