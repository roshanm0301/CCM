-- =============================================================================
-- Migration 005: Create interactions table
--
-- Top-level interaction record. Each record represents one customer contact
-- event managed by a CCM agent.
-- Source: data-model-outline.md § interactions
-- =============================================================================

CREATE TABLE IF NOT EXISTS interactions (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  channel              VARCHAR(50) NOT NULL,
  mode                 VARCHAR(50) NOT NULL DEFAULT 'manual',
  -- status: NEW | IDENTIFYING | CONTEXT_CONFIRMED | WRAPUP | CLOSED | INCOMPLETE
  status               VARCHAR(50) NOT NULL DEFAULT 'NEW',
  started_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at             TIMESTAMPTZ,
  started_by_user_id   UUID        NOT NULL REFERENCES users(id),
  completion_flag      VARCHAR(50),
  -- External references — snapshot references, not source truth
  current_customer_ref VARCHAR(200),
  current_vehicle_ref  VARCHAR(200),
  current_dealer_ref   VARCHAR(200),
  correlation_id       UUID        NOT NULL DEFAULT gen_random_uuid(),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT interactions_status_check
    CHECK (status IN ('NEW', 'IDENTIFYING', 'CONTEXT_CONFIRMED', 'WRAPUP', 'CLOSED', 'INCOMPLETE')),
  -- Enforce at most one open interaction per agent (no concurrent interactions)
  CONSTRAINT interactions_one_open_per_agent
    EXCLUDE USING btree (started_by_user_id WITH =)
    WHERE (status NOT IN ('CLOSED', 'INCOMPLETE')),
  CONSTRAINT interactions_channel_check
    CHECK (channel IN ('manual')),
  CONSTRAINT interactions_mode_check
    CHECK (mode IN ('manual'))
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_interactions_status
  ON interactions (status);

CREATE INDEX IF NOT EXISTS idx_interactions_started_by_user_id
  ON interactions (started_by_user_id);

CREATE INDEX IF NOT EXISTS idx_interactions_started_at
  ON interactions (started_at DESC);

CREATE INDEX IF NOT EXISTS idx_interactions_correlation_id
  ON interactions (correlation_id);

-- Composite index for agent workspace queries (agent's active interactions)
CREATE INDEX IF NOT EXISTS idx_interactions_user_status
  ON interactions (started_by_user_id, status);

COMMENT ON TABLE interactions IS 'Top-level CCM interaction record. Authoritative source for interaction lifecycle.';
COMMENT ON COLUMN interactions.channel IS 'manual';
COMMENT ON COLUMN interactions.mode IS 'manual';
COMMENT ON COLUMN interactions.status IS 'NEW | IDENTIFYING | CONTEXT_CONFIRMED | WRAPUP | CLOSED | INCOMPLETE';
COMMENT ON COLUMN interactions.completion_flag IS 'Optional flag for incomplete interaction reason.';
COMMENT ON COLUMN interactions.current_customer_ref IS 'External customer reference — snapshot reference only, not source of truth.';
COMMENT ON COLUMN interactions.current_vehicle_ref IS 'External vehicle reference — snapshot reference only, not source of truth.';
COMMENT ON COLUMN interactions.current_dealer_ref IS 'External dealer reference — snapshot reference only, not source of truth.';
COMMENT ON COLUMN interactions.correlation_id IS 'Propagated through logs, events, and integration calls for distributed tracing.';
