-- =============================================================================
-- Migration 028 — Extend interaction_events CHECK constraint for outbound
--                 calling event types
--
-- Rationale: Phase 6 outbound calling requires two new audit event names:
--   - 'cti_outbound_call_initiated' — logged when agent initiates a click2call
--   - 'cti_outbound_call_cdr_received' — logged when CDR arrives for outbound
--
-- Fix: Migration 104 accidentally omitted the TeleCMI inbound event names that
-- were added by migration 025 ('cti_call_answered', 'cti_call_declined',
-- 'cti_call_ended', 'cti_call_cdr_received'). These events are inserted by
-- cti.webhook.service.ts and cti.call.service.ts and would cause constraint
-- violations without being in the allowed list. This migration restores them.
--
-- Locking note: DROP CONSTRAINT + ADD CONSTRAINT takes ACCESS EXCLUSIVE lock
-- on interaction_events while the constraint is rebuilt. Current row volumes
-- make this operation sub-second. Apply during a low-traffic window if needed.
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
    -- Phase 6 outbound calling events (new in this migration)
    'cti_outbound_call_initiated',
    'cti_outbound_call_cdr_received'
  ));
