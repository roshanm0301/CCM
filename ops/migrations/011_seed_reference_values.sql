-- =============================================================================
-- Migration 011: Seed Phase 1 reference values
--
-- Seeds ALL controlled values for Phase 1 CCM functionality.
-- Sources: CCM_Phase1_Agent_Interaction_Documentation.md, ccm-scope.md
--
-- Reference types seeded:
--   - search_filter
--   - contact_reason
--   - identification_outcome
--   - interaction_disposition  (includes remarksRequired metadata flag)
--   - agent_status
--
-- Use ON CONFLICT DO UPDATE to make this migration idempotent (safe to re-run).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Search Filter Master
-- ---------------------------------------------------------------------------
INSERT INTO reference_values (reference_type, code, label, sort_order, is_active) VALUES
  ('search_filter', 'mobile',              'Mobile Number',       1, TRUE),
  ('search_filter', 'registration_number', 'Registration Number', 2, TRUE),
  ('search_filter', 'customer_name',       'Customer Name',       3, TRUE),
  ('search_filter', 'email',               'Email Address',       4, TRUE)
ON CONFLICT (reference_type, code)
DO UPDATE SET
  label      = EXCLUDED.label,
  sort_order = EXCLUDED.sort_order,
  is_active  = EXCLUDED.is_active,
  updated_at = NOW();

-- ---------------------------------------------------------------------------
-- Contact Reason Master
-- ---------------------------------------------------------------------------
INSERT INTO reference_values (reference_type, code, label, sort_order, is_active) VALUES
  ('contact_reason', 'complaint',   'Complaint',   1, TRUE),
  ('contact_reason', 'query',       'Query',       2, TRUE),
  ('contact_reason', 'suggestion',  'Suggestion',  3, TRUE),
  ('contact_reason', 'feedback',    'Feedback',    4, TRUE),
  ('contact_reason', 'other',       'Other',       5, TRUE)
ON CONFLICT (reference_type, code)
DO UPDATE SET
  label      = EXCLUDED.label,
  sort_order = EXCLUDED.sort_order,
  is_active  = EXCLUDED.is_active,
  updated_at = NOW();

-- ---------------------------------------------------------------------------
-- Identification Outcome Master
-- ---------------------------------------------------------------------------
INSERT INTO reference_values (reference_type, code, label, sort_order, is_active) VALUES
  ('identification_outcome', 'customer_vehicle_identified',
    'Customer and Vehicle Identified', 1, TRUE),
  ('identification_outcome', 'customer_identified_vehicle_unresolved',
    'Customer Identified — Vehicle Unresolved', 2, TRUE),
  ('identification_outcome', 'vehicle_identified_customer_partially_resolved',
    'Vehicle Identified — Customer Partially Resolved', 3, TRUE),
  ('identification_outcome', 'no_verified_match',
    'No Verified Match', 4, TRUE),
  ('identification_outcome', 'multiple_matches_resolved_by_agent',
    'Multiple Matches — Resolved by Agent', 5, TRUE)
ON CONFLICT (reference_type, code)
DO UPDATE SET
  label      = EXCLUDED.label,
  sort_order = EXCLUDED.sort_order,
  is_active  = EXCLUDED.is_active,
  updated_at = NOW();

-- ---------------------------------------------------------------------------
-- Interaction Disposition Master
-- Metadata: remarksRequired = true means agents MUST enter Remarks for this disposition.
-- Source: CCM_Phase1_Agent_Interaction_Documentation.md § C7 / C9
-- Dispositions requiring mandatory remarks: no_match_found, technical_issue,
--   abusive_caller, others, incomplete_interaction
-- ---------------------------------------------------------------------------
INSERT INTO reference_values (reference_type, code, label, sort_order, is_active, metadata) VALUES
  ('interaction_disposition', 'information_provided',
    'Information Provided',  1, TRUE, NULL),
  ('interaction_disposition', 'information_captured',
    'Information Captured',  2, TRUE, NULL),
  ('interaction_disposition', 'no_match_found',
    'No Match Found',        3, TRUE, '{"remarksRequired": true}'::jsonb),
  ('interaction_disposition', 'wrong_number',
    'Wrong Number',          4, TRUE, NULL),
  ('interaction_disposition', 'silent_call',
    'Silent Call',           5, TRUE, NULL),
  ('interaction_disposition', 'abusive_caller',
    'Abusive Caller',        6, TRUE, '{"remarksRequired": true}'::jsonb),
  ('interaction_disposition', 'technical_issue',
    'Technical Issue',       7, TRUE, '{"remarksRequired": true}'::jsonb),
  ('interaction_disposition', 'transferred_outside_ccm',
    'Transferred Outside CCM', 8, TRUE, NULL),
  ('interaction_disposition', 'incomplete_interaction',
    'Incomplete Interaction', 9, TRUE, '{"remarksRequired": true}'::jsonb),
  ('interaction_disposition', 'others',
    'Others',               10, TRUE, '{"remarksRequired": true}'::jsonb)
ON CONFLICT (reference_type, code)
DO UPDATE SET
  label      = EXCLUDED.label,
  sort_order = EXCLUDED.sort_order,
  is_active  = EXCLUDED.is_active,
  metadata   = EXCLUDED.metadata,
  updated_at = NOW();

-- ---------------------------------------------------------------------------
-- Agent Status Master
-- ---------------------------------------------------------------------------
INSERT INTO reference_values (reference_type, code, label, sort_order, is_active) VALUES
  ('agent_status', 'ready_for_calls', 'Ready for Calls', 1, TRUE),
  ('agent_status', 'break',           'Break',            2, TRUE),
  ('agent_status', 'offline',         'Offline',          3, TRUE),
  ('agent_status', 'training',        'Training',         4, TRUE)
ON CONFLICT (reference_type, code)
DO UPDATE SET
  label      = EXCLUDED.label,
  sort_order = EXCLUDED.sort_order,
  is_active  = EXCLUDED.is_active,
  updated_at = NOW();
