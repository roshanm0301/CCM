-- =============================================================================
-- Migration 020: Activity Flow Roles
--
-- Adds CCM and Dealer-specific roles required for Activity Flow Configuration.
-- Source: CCM_Phase5_ActivityFlowConfiguration.md
-- =============================================================================

INSERT INTO roles (name, description) VALUES
  ('ccm_agent',                'CCM call centre agent — can configure and manage activity flows'),
  ('ccm_team_lead',            'CCM team lead — supervises CCM agents'),
  ('dealer_service_advisor',   'Dealer role — Service Advisor at dealership'),
  ('dealer_workshop_controller','Dealer role — Workshop Controller at dealership'),
  ('dealer_parts_executive',   'Dealer role — Parts Executive at dealership'),
  ('dealer_crm_executive',     'Dealer role — CRM Executive at dealership'),
  ('dealer_warranty_executive','Dealer role — Warranty Executive at dealership'),
  ('dealer_service_manager',   'Dealer role — Service Manager at dealership'),
  ('dealer_bodyshop_advisor',  'Dealer role — Bodyshop Advisor at dealership'),
  ('dealer_ev_technician',     'Dealer role — EV Technician at dealership')
ON CONFLICT (name) DO NOTHING;

COMMENT ON TABLE roles IS 'System role definitions for CCM RBAC — extended with Activity Flow and Dealer roles in migration 020.';
