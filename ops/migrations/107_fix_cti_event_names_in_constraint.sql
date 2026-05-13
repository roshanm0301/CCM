-- =============================================================================
-- Migration 107 — Restore TeleCMI event names omitted by migration 104
--
-- Root cause: Migration 104 (add_phase6_event_types) dropped and recreated
-- the interaction_events_event_name_check constraint but accidentally omitted
-- four TeleCMI inbound event names that were originally added by migration 025:
--
--   cti_call_answered          — inserted by cti.call.service.ts when agent answers
--   cti_call_declined          — inserted by cti.webhook.service.ts on decline
--   cti_call_ended             — inserted by cti.webhook.service.ts on hangup/ended
--   cti_call_cdr_received      — inserted by cti.webhook.service.ts on CDR
--
-- It also omitted the Phase 6 outbound events added by migration 028:
--   cti_outbound_call_initiated    — logged when agent initiates click2call
--   cti_outbound_call_cdr_received — logged when CDR arrives for outbound
--
-- Without these values in the constraint, every call answered by an agent
-- causes a 23514 check constraint violation on the INSERT in
-- createInteractionFromCallService, rolling back the transaction and returning
-- HTTP 500. This prevents interaction creation entirely, breaking the entire
-- inbound call workflow.
--
-- This migration rebuilds the constraint with the complete set of allowed
-- event names across all phases.
--
-- Locking note: DROP CONSTRAINT + ADD CONSTRAINT takes ACCESS EXCLUSIVE lock
-- on interaction_events while the constraint is rebuilt. At current dev row
-- volumes this is sub-second.
-- =============================================================================

ALTER TABLE interaction_events
  DROP CONSTRAINT IF EXISTS interaction_events_event_name_check;

ALTER TABLE interaction_events
  ADD CONSTRAINT interaction_events_event_name_check
  CHECK (event_name IN (
    -- Phase 1 core interaction events
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
    -- Legacy Smartflo CTI events (retained for historical rows — provider removed)
    'cti_call_received',
    'cti_call_hangup',
    'cti_ani_search_triggered',
    -- TeleCMI inbound event names (migration 025; omitted from 104 — restored here)
    'cti_call_answered',
    'cti_call_declined',
    'cti_call_ended',
    'cti_call_cdr_received',
    -- Phase 4 event
    'case_created',
    -- Phase 6 events (migration 104)
    'dealer_login',
    'resolution_activity_saved',
    'case_closed',
    'followup_added',
    -- Phase 6 outbound calling events (migration 028; omitted from 104 — restored here)
    'cti_outbound_call_initiated',
    'cti_outbound_call_cdr_received'
  ));
