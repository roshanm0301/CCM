-- Migration 031: Extend agent_statuses CHECK constraints for CTI statuses
-- Phase 1.5: Adds on_call and wrap_up to both CHECK constraints.
--
-- ROLLBACK PATH (if this migration must be reversed):
--   ALTER TABLE agent_statuses DROP CONSTRAINT agent_statuses_status_code_check;
--   ALTER TABLE agent_statuses ADD CONSTRAINT agent_statuses_status_code_check
--     CHECK (status_code IN ('ready_for_calls', 'break', 'offline', 'training'));
--   ALTER TABLE agent_statuses DROP CONSTRAINT agent_statuses_previous_status_code_check;
--   ALTER TABLE agent_statuses ADD CONSTRAINT agent_statuses_previous_status_code_check
--     CHECK (previous_status_code IS NULL OR
--            previous_status_code IN ('ready_for_calls', 'break', 'offline', 'training'));
--   DROP INDEX IF EXISTS idx_context_snapshots_interaction_type;
--
-- NOTE: No data is modified. Rollback is safe as long as no on_call/wrap_up
-- rows exist in agent_statuses at the time of rollback.

ALTER TABLE agent_statuses
  DROP CONSTRAINT IF EXISTS agent_statuses_status_code_check;

ALTER TABLE agent_statuses
  ADD CONSTRAINT agent_statuses_status_code_check
  CHECK (status_code IN (
    'ready_for_calls', 'break', 'offline', 'training',
    'on_call', 'wrap_up'
  ));

ALTER TABLE agent_statuses
  DROP CONSTRAINT IF EXISTS agent_statuses_previous_status_code_check;

ALTER TABLE agent_statuses
  ADD CONSTRAINT agent_statuses_previous_status_code_check
  CHECK (previous_status_code IS NULL OR
         previous_status_code IN (
           'ready_for_calls', 'break', 'offline', 'training',
           'on_call', 'wrap_up'
         ));

COMMENT ON COLUMN agent_statuses.status_code IS
  'Current agent status. on_call and wrap_up are CTI-managed — not agent-selectable.';

-- Note: Using CREATE INDEX (not CONCURRENTLY) to remain compatible with
-- migration runners that wrap statements in a transaction block.
-- Table has no production data at this phase so CONCURRENTLY provides no benefit.
CREATE INDEX IF NOT EXISTS idx_context_snapshots_interaction_type
  ON context_snapshots (interaction_id, snapshot_type);
