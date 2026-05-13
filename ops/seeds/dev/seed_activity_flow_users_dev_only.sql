-- =============================================================
-- DEV SEED ONLY — DO NOT RUN IN STAGING OR PRODUCTION
-- Seeds Activity Flow users: 2 CCM users + 8 dealer-role users
-- for DLR-001 (Sharma Bajaj, Pune) and 8 for DLR-002 (Gujarat
-- Bajaj, Ahmedabad).
--
-- All passwords: Test@123
-- Source: CCM_Phase5_ActivityFlowConfiguration.md
-- =============================================================

-- =============================================================================
-- Helper: ensure role IDs are available from migration 020
-- All INSERTs use ON CONFLICT DO UPDATE to be safely re-runnable.
-- =============================================================================

-- -----------------------------------------------------------------------
-- 1. CCM Users (no dealer association)
-- -----------------------------------------------------------------------

-- ccm_agent1 — CCM Agent (also gets legacy 'agent' role for current auth)
INSERT INTO users (id, username, display_name, password_hash, status, is_active)
VALUES (
  'b1000000-0000-0000-0000-000000000001',
  'ccm_agent1',
  'CCM Agent One',
  '$2a$10$rHygiM/oGqEN2ul3jPubY.Nb2R8swpg0C46TqsilTAhj8B8SCa9iW',
  'offline',
  TRUE
)
ON CONFLICT (username) DO UPDATE SET
  display_name  = EXCLUDED.display_name,
  password_hash = EXCLUDED.password_hash,
  is_active     = EXCLUDED.is_active,
  updated_at    = NOW();

-- ccm_lead1 — CCM Team Lead
INSERT INTO users (id, username, display_name, password_hash, status, is_active)
VALUES (
  'b1000000-0000-0000-0000-000000000002',
  'ccm_lead1',
  'CCM Team Lead One',
  '$2a$10$rHygiM/oGqEN2ul3jPubY.Nb2R8swpg0C46TqsilTAhj8B8SCa9iW',
  'offline',
  TRUE
)
ON CONFLICT (username) DO UPDATE SET
  display_name  = EXCLUDED.display_name,
  password_hash = EXCLUDED.password_hash,
  is_active     = EXCLUDED.is_active,
  updated_at    = NOW();

-- -----------------------------------------------------------------------
-- 2. DLR-001 Users (Sharma Bajaj Motors, Pune)
-- -----------------------------------------------------------------------

INSERT INTO users (id, username, display_name, password_hash, status, external_user_ref, is_active) VALUES
  ('c1000000-0000-0000-0000-000000000001', 'dlr1_sa1', 'DLR1 Service Advisor',    '$2a$10$rHygiM/oGqEN2ul3jPubY.Nb2R8swpg0C46TqsilTAhj8B8SCa9iW', 'offline', 'DLR-001', TRUE),
  ('c1000000-0000-0000-0000-000000000002', 'dlr1_wc1', 'DLR1 Workshop Controller','$2a$10$rHygiM/oGqEN2ul3jPubY.Nb2R8swpg0C46TqsilTAhj8B8SCa9iW', 'offline', 'DLR-001', TRUE),
  ('c1000000-0000-0000-0000-000000000003', 'dlr1_pe1', 'DLR1 Parts Executive',    '$2a$10$rHygiM/oGqEN2ul3jPubY.Nb2R8swpg0C46TqsilTAhj8B8SCa9iW', 'offline', 'DLR-001', TRUE),
  ('c1000000-0000-0000-0000-000000000004', 'dlr1_ce1', 'DLR1 CRM Executive',      '$2a$10$rHygiM/oGqEN2ul3jPubY.Nb2R8swpg0C46TqsilTAhj8B8SCa9iW', 'offline', 'DLR-001', TRUE),
  ('c1000000-0000-0000-0000-000000000005', 'dlr1_we1', 'DLR1 Warranty Executive', '$2a$10$rHygiM/oGqEN2ul3jPubY.Nb2R8swpg0C46TqsilTAhj8B8SCa9iW', 'offline', 'DLR-001', TRUE),
  ('c1000000-0000-0000-0000-000000000006', 'dlr1_sm1', 'DLR1 Service Manager',    '$2a$10$rHygiM/oGqEN2ul3jPubY.Nb2R8swpg0C46TqsilTAhj8B8SCa9iW', 'offline', 'DLR-001', TRUE),
  ('c1000000-0000-0000-0000-000000000007', 'dlr1_ba1', 'DLR1 Bodyshop Advisor',   '$2a$10$rHygiM/oGqEN2ul3jPubY.Nb2R8swpg0C46TqsilTAhj8B8SCa9iW', 'offline', 'DLR-001', TRUE),
  ('c1000000-0000-0000-0000-000000000008', 'dlr1_et1', 'DLR1 EV Technician',      '$2a$10$rHygiM/oGqEN2ul3jPubY.Nb2R8swpg0C46TqsilTAhj8B8SCa9iW', 'offline', 'DLR-001', TRUE)
ON CONFLICT (username) DO UPDATE SET
  display_name     = EXCLUDED.display_name,
  password_hash    = EXCLUDED.password_hash,
  external_user_ref = EXCLUDED.external_user_ref,
  is_active        = EXCLUDED.is_active,
  updated_at       = NOW();

-- -----------------------------------------------------------------------
-- 3. DLR-002 Users (Gujarat Bajaj Pvt Ltd, Ahmedabad)
-- -----------------------------------------------------------------------

INSERT INTO users (id, username, display_name, password_hash, status, external_user_ref, is_active) VALUES
  ('c2000000-0000-0000-0000-000000000001', 'dlr2_sa1', 'DLR2 Service Advisor',    '$2a$10$rHygiM/oGqEN2ul3jPubY.Nb2R8swpg0C46TqsilTAhj8B8SCa9iW', 'offline', 'DLR-002', TRUE),
  ('c2000000-0000-0000-0000-000000000002', 'dlr2_wc1', 'DLR2 Workshop Controller','$2a$10$rHygiM/oGqEN2ul3jPubY.Nb2R8swpg0C46TqsilTAhj8B8SCa9iW', 'offline', 'DLR-002', TRUE),
  ('c2000000-0000-0000-0000-000000000003', 'dlr2_pe1', 'DLR2 Parts Executive',    '$2a$10$rHygiM/oGqEN2ul3jPubY.Nb2R8swpg0C46TqsilTAhj8B8SCa9iW', 'offline', 'DLR-002', TRUE),
  ('c2000000-0000-0000-0000-000000000004', 'dlr2_ce1', 'DLR2 CRM Executive',      '$2a$10$rHygiM/oGqEN2ul3jPubY.Nb2R8swpg0C46TqsilTAhj8B8SCa9iW', 'offline', 'DLR-002', TRUE),
  ('c2000000-0000-0000-0000-000000000005', 'dlr2_we1', 'DLR2 Warranty Executive', '$2a$10$rHygiM/oGqEN2ul3jPubY.Nb2R8swpg0C46TqsilTAhj8B8SCa9iW', 'offline', 'DLR-002', TRUE),
  ('c2000000-0000-0000-0000-000000000006', 'dlr2_sm1', 'DLR2 Service Manager',    '$2a$10$rHygiM/oGqEN2ul3jPubY.Nb2R8swpg0C46TqsilTAhj8B8SCa9iW', 'offline', 'DLR-002', TRUE),
  ('c2000000-0000-0000-0000-000000000007', 'dlr2_ba1', 'DLR2 Bodyshop Advisor',   '$2a$10$rHygiM/oGqEN2ul3jPubY.Nb2R8swpg0C46TqsilTAhj8B8SCa9iW', 'offline', 'DLR-002', TRUE),
  ('c2000000-0000-0000-0000-000000000008', 'dlr2_et1', 'DLR2 EV Technician',      '$2a$10$rHygiM/oGqEN2ul3jPubY.Nb2R8swpg0C46TqsilTAhj8B8SCa9iW', 'offline', 'DLR-002', TRUE)
ON CONFLICT (username) DO UPDATE SET
  display_name     = EXCLUDED.display_name,
  password_hash    = EXCLUDED.password_hash,
  external_user_ref = EXCLUDED.external_user_ref,
  is_active        = EXCLUDED.is_active,
  updated_at       = NOW();

-- =============================================================================
-- Role Assignments
-- =============================================================================

-- Assign TeleCMI credentials to ccm_agent1.
-- Extension 5003 corresponds to the "Mahesh AutoMobiles" agent slot in the
-- TeleCMI account (appid 33335989). Fixed — account limit is 2 agents.
UPDATE users SET
  telecmi_agent_id     = '5003_33335989',
  telecmi_extension    = 5003,
  telecmi_sip_password = 'Excellon@123'
WHERE username = 'ccm_agent1';

-- ccm_agent1 → 'agent' (existing legacy role) + 'ccm_agent' (new)
INSERT INTO user_role_assignments (user_id, role_id)
SELECT 'b1000000-0000-0000-0000-000000000001', id FROM roles WHERE name = 'agent'
ON CONFLICT DO NOTHING;

INSERT INTO user_role_assignments (user_id, role_id)
SELECT 'b1000000-0000-0000-0000-000000000001', id FROM roles WHERE name = 'ccm_agent'
ON CONFLICT DO NOTHING;

-- ccm_lead1 → 'ccm_team_lead'
INSERT INTO user_role_assignments (user_id, role_id)
SELECT 'b1000000-0000-0000-0000-000000000002', id FROM roles WHERE name = 'ccm_team_lead'
ON CONFLICT DO NOTHING;

-- DLR-001 users
INSERT INTO user_role_assignments (user_id, role_id)
SELECT 'c1000000-0000-0000-0000-000000000001', id FROM roles WHERE name = 'dealer_service_advisor'   ON CONFLICT DO NOTHING;
INSERT INTO user_role_assignments (user_id, role_id)
SELECT 'c1000000-0000-0000-0000-000000000002', id FROM roles WHERE name = 'dealer_workshop_controller' ON CONFLICT DO NOTHING;
INSERT INTO user_role_assignments (user_id, role_id)
SELECT 'c1000000-0000-0000-0000-000000000003', id FROM roles WHERE name = 'dealer_parts_executive'  ON CONFLICT DO NOTHING;
INSERT INTO user_role_assignments (user_id, role_id)
SELECT 'c1000000-0000-0000-0000-000000000004', id FROM roles WHERE name = 'dealer_crm_executive'    ON CONFLICT DO NOTHING;
INSERT INTO user_role_assignments (user_id, role_id)
SELECT 'c1000000-0000-0000-0000-000000000005', id FROM roles WHERE name = 'dealer_warranty_executive' ON CONFLICT DO NOTHING;
INSERT INTO user_role_assignments (user_id, role_id)
SELECT 'c1000000-0000-0000-0000-000000000006', id FROM roles WHERE name = 'dealer_service_manager'  ON CONFLICT DO NOTHING;
INSERT INTO user_role_assignments (user_id, role_id)
SELECT 'c1000000-0000-0000-0000-000000000007', id FROM roles WHERE name = 'dealer_bodyshop_advisor' ON CONFLICT DO NOTHING;
INSERT INTO user_role_assignments (user_id, role_id)
SELECT 'c1000000-0000-0000-0000-000000000008', id FROM roles WHERE name = 'dealer_ev_technician'    ON CONFLICT DO NOTHING;

-- DLR-002 users
INSERT INTO user_role_assignments (user_id, role_id)
SELECT 'c2000000-0000-0000-0000-000000000001', id FROM roles WHERE name = 'dealer_service_advisor'   ON CONFLICT DO NOTHING;
INSERT INTO user_role_assignments (user_id, role_id)
SELECT 'c2000000-0000-0000-0000-000000000002', id FROM roles WHERE name = 'dealer_workshop_controller' ON CONFLICT DO NOTHING;
INSERT INTO user_role_assignments (user_id, role_id)
SELECT 'c2000000-0000-0000-0000-000000000003', id FROM roles WHERE name = 'dealer_parts_executive'  ON CONFLICT DO NOTHING;
INSERT INTO user_role_assignments (user_id, role_id)
SELECT 'c2000000-0000-0000-0000-000000000004', id FROM roles WHERE name = 'dealer_crm_executive'    ON CONFLICT DO NOTHING;
INSERT INTO user_role_assignments (user_id, role_id)
SELECT 'c2000000-0000-0000-0000-000000000005', id FROM roles WHERE name = 'dealer_warranty_executive' ON CONFLICT DO NOTHING;
INSERT INTO user_role_assignments (user_id, role_id)
SELECT 'c2000000-0000-0000-0000-000000000006', id FROM roles WHERE name = 'dealer_service_manager'  ON CONFLICT DO NOTHING;
INSERT INTO user_role_assignments (user_id, role_id)
SELECT 'c2000000-0000-0000-0000-000000000007', id FROM roles WHERE name = 'dealer_bodyshop_advisor' ON CONFLICT DO NOTHING;
INSERT INTO user_role_assignments (user_id, role_id)
SELECT 'c2000000-0000-0000-0000-000000000008', id FROM roles WHERE name = 'dealer_ev_technician'    ON CONFLICT DO NOTHING;
