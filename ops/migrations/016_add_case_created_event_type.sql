-- Migration 016: Add case_created to interaction_events event_name CHECK constraint
-- This migration drops the existing constraint and recreates it with case_created added.
-- Required by Phase 4 (Case Creation) — architecture-principles.md Principle 6:
-- all key workflow transitions must be reconstructible from the event log.

ALTER TABLE interaction_events
  DROP CONSTRAINT IF EXISTS interaction_events_event_name_check;

ALTER TABLE interaction_events
  ADD CONSTRAINT interaction_events_event_name_check
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
    'agent_status_changed',
    'case_created'
  ));
