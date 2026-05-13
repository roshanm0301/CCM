-- =============================================================================
-- Migration 012: Performance indexes
--
-- Adds non-unique indexes that improve query performance on high-traffic
-- read paths identified during Phase 1 review:
--
--   1. interactions.agent_user_id + status  — used by findOpenInteractionForAgent
--      and any agent-scoped interaction listing query
--   2. interaction_events.interaction_id    — used by audit event reads per interaction
--   3. interaction_events.event_name        — used by audit queries filtered by event type
--   4. agent_statuses.user_id              — used by getAgentStatus (hot path on every request)
--   5. search_attempts.interaction_id       — used when loading search history per interaction
--
-- All indexes use IF NOT EXISTS so this migration is safe to re-run.
-- =============================================================================

-- interactions: agent lookup + active-interaction guard
CREATE INDEX IF NOT EXISTS idx_interactions_agent_status
  ON interactions (started_by_user_id, status);

-- interaction_events: audit reads by interaction
CREATE INDEX IF NOT EXISTS idx_interaction_events_interaction_id
  ON interaction_events (interaction_id);

-- interaction_events: audit reads by event type (e.g. agent_status_changed)
CREATE INDEX IF NOT EXISTS idx_interaction_events_event_name
  ON interaction_events (event_name);

-- agent_statuses: status lookup by user (called on every authenticated request)
CREATE INDEX IF NOT EXISTS idx_agent_statuses_user_id
  ON agent_statuses (user_id);

-- search_attempts: search history per interaction
CREATE INDEX IF NOT EXISTS idx_search_attempts_interaction_id
  ON search_attempts (interaction_id);
