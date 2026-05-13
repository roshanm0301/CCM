-- =============================================================================
-- Migration 013: Create agent_statuses table
--
-- Tracks the current availability status of each agent.
-- One active row per user. On status change, the existing row is updated
-- and a new row is inserted in interaction_events with event_name =
-- 'agent_status_changed'.
-- Source: CCM_Phase1_Agent_Interaction_Documentation.md § C11 / D11
-- =============================================================================

CREATE TABLE IF NOT EXISTS agent_statuses (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID        NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  status_code          VARCHAR(50) NOT NULL DEFAULT 'offline',
  previous_status_code VARCHAR(50),
  changed_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  changed_by_user_id   UUID        NOT NULL REFERENCES users(id),
  correlation_id       UUID,

  CONSTRAINT agent_statuses_status_code_check
    CHECK (status_code IN ('ready_for_calls', 'break', 'offline', 'training')),
  CONSTRAINT agent_statuses_previous_status_code_check
    CHECK (previous_status_code IS NULL OR
           previous_status_code IN ('ready_for_calls', 'break', 'offline', 'training'))
);

CREATE INDEX IF NOT EXISTS idx_agent_statuses_status_code
  ON agent_statuses (status_code);

COMMENT ON TABLE agent_statuses IS 'Current availability status for each agent. One row per user, updated in-place on every status change.';
COMMENT ON COLUMN agent_statuses.status_code IS 'Current status: ready_for_calls | break | offline | training';
COMMENT ON COLUMN agent_statuses.previous_status_code IS 'Previous status before the most recent change. Used for audit display.';
COMMENT ON COLUMN agent_statuses.changed_at IS 'Timestamp of the most recent status change.';
COMMENT ON COLUMN agent_statuses.changed_by_user_id IS 'User who made the change (same as user_id in Phase 1 — agents change their own status).';
COMMENT ON COLUMN agent_statuses.correlation_id IS 'Correlation ID from the originating HTTP request.';

-- ---------------------------------------------------------------------------
-- Seed: set all existing users to 'offline' on first run
-- ---------------------------------------------------------------------------
INSERT INTO agent_statuses (user_id, status_code, changed_by_user_id)
SELECT id, 'offline', id
FROM users
ON CONFLICT (user_id) DO NOTHING;
