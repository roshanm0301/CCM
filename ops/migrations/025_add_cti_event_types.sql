ALTER TABLE interaction_events DROP CONSTRAINT IF EXISTS interaction_events_event_name_check;
ALTER TABLE interaction_events ADD CONSTRAINT interaction_events_event_name_check
  CHECK (event_name IN (
    'interaction_created','search_started','search_result_returned',
    'customer_selected','vehicle_selected','dealer_loaded','customer_reselected',
    'disposition_saved','interaction_closed','interaction_marked_incomplete',
    'agent_status_changed','case_created',
    -- Legacy Smartflo event names (retained for historical rows — provider removed)
    'cti_call_received','cti_call_hangup','cti_ani_search_triggered',
    -- TeleCMI event names
    'cti_call_answered','cti_call_declined','cti_call_ended','cti_call_cdr_received'
  ));
