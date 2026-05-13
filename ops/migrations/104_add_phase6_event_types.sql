-- =============================================================================
-- Migration 104: Add Phase 6 event names to interaction_events CHECK constraint
--
-- Extends the interaction_events event_name CHECK constraint with Phase 6
-- audit event names. These events use interaction_id = NULL (same pattern
-- as agent_status_changed in Phase 1) and carry context in event_payload_json.
--
-- New event names added:
--   dealer_login             — dealer user authenticated successfully
--   resolution_activity_saved — dealer saved an outcome on a resolution activity
--   case_closed              — case transitioned to Closed – Verified status
--   followup_added           — agent added a follow-up entry to a case
--
-- Note: resolution_activity_saved, case_closed, and followup_added are
-- supplementary audit events. The primary audit trail for Phase 6 is the
-- resolution_activities and case_followups tables themselves (see migrations
-- 100 and 102). These interaction_events entries provide a unified cross-phase
-- timeline in the existing audit log.
--
-- Source: CCM_Phase6_Resolution_Activities.md — architecture-principles.md
-- Principle 6 (all key workflow transitions must be reconstructible from
-- the event log).
-- =============================================================================

ALTER TABLE interaction_events
  DROP CONSTRAINT IF EXISTS interaction_events_event_name_check;

ALTER TABLE interaction_events
  ADD CONSTRAINT interaction_events_event_name_check
  CHECK (event_name IN (
    -- Phase 1 events
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
    -- CTI events (added by migration 025)
    'cti_call_received',
    'cti_call_hangup',
    'cti_ani_search_triggered',
    -- Phase 4 event
    'case_created',
    -- Phase 6 events
    'dealer_login',
    'resolution_activity_saved',
    'case_closed',
    'followup_added'
  ));
