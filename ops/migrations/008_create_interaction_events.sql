-- =============================================================================
-- Migration 008: Create interaction_events table
--
-- Append-only event log for key workflow events.
-- Every critical interaction lifecycle event must produce a row here.
-- Source: data-model-outline.md § interaction_events
--         phase1-technical-blueprint.md § 10.2 (canonical event name list)
-- =============================================================================

CREATE TABLE IF NOT EXISTS interaction_events (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Nullable: agent_status_changed events are not tied to a specific interaction
  interaction_id       UUID        REFERENCES interactions(id) ON DELETE CASCADE,
  event_name           VARCHAR(100) NOT NULL,
  event_at             TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  actor_user_id        UUID        NOT NULL REFERENCES users(id),
  event_payload_json   JSONB,
  correlation_id       UUID,

  -- Enforce all Phase 1 event names (source: phase1-technical-blueprint.md §10.2)
  CONSTRAINT interaction_events_event_name_check
    CHECK (event_name IN (
      'interaction_created',
      'search_started',
      'search_result_returned',
      'customer_selected',
      'vehicle_selected',
      'dealer_loaded',
      'customer_reselected',
      'disposition_saved',
      'interaction_closed',
      'interaction_marked_incomplete',
      'agent_status_changed'
    ))
);

-- Primary access pattern: events for a given interaction, ordered by time
CREATE INDEX IF NOT EXISTS idx_interaction_events_interaction_id_event_at
  ON interaction_events (interaction_id, event_at ASC)
  WHERE interaction_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_interaction_events_actor_user_id
  ON interaction_events (actor_user_id);

CREATE INDEX IF NOT EXISTS idx_interaction_events_event_name
  ON interaction_events (event_name);

CREATE INDEX IF NOT EXISTS idx_interaction_events_correlation_id
  ON interaction_events (correlation_id)
  WHERE correlation_id IS NOT NULL;

COMMENT ON TABLE interaction_events IS 'Append-only audit event log for all significant interaction lifecycle transitions.';
COMMENT ON COLUMN interaction_events.interaction_id IS 'NULL for agent-level events (e.g. agent_status_changed) not tied to a specific interaction.';
COMMENT ON COLUMN interaction_events.event_name IS 'Controlled event name — must match one of the approved Phase 1 event names.';
COMMENT ON COLUMN interaction_events.event_payload_json IS 'Structured JSON payload capturing relevant context at the time of the event. Must not contain raw secrets or full PII.';
COMMENT ON COLUMN interaction_events.correlation_id IS 'Correlation ID propagated from the originating HTTP request for distributed tracing.';
