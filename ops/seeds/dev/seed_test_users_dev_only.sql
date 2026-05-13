-- =============================================================
-- DEV SEED ONLY — DO NOT RUN IN STAGING OR PRODUCTION
-- Seeds a default test agent account (agent1 / Agent@123)
-- Mount this directory via Docker Compose ONLY in local dev.
--
-- File naming: intentionally NOT prefixed with a migration sequence
-- number (001_, 002_, etc.) to prevent this file from being confused
-- with or run as a production schema migration.
-- =============================================================

-- =============================================================================
-- Seed: test users
--
-- Creates two test users for local development and integration testing:
--   1. agent1  — has the 'agent' role (tests normal agent workflows)
--   2. noaccess — has no role assigned (tests RBAC denial scenarios)
--
-- Passwords are bcrypt hashes (cost factor 10).
--   agent1   password: Agent@123
--   noaccess password: NoAccess@123
--
-- IMPORTANT:
--   - These users are for local/dev/CI environments ONLY.
--   - Do not run this seed against production or staging.
--   - The password hashes here are NOT secrets — they are test fixtures.
--     Production credentials must be managed via secret manager.
--
-- Hash generation reference (Node.js):
--   bcrypt.hashSync('Agent@123',    10)
--   bcrypt.hashSync('NoAccess@123', 10)
-- =============================================================================

-- Insert agent1 (agent role)
INSERT INTO users (
  id,
  username,
  display_name,
  password_hash,
  status,
  is_active
)
VALUES (
  'a1000000-0000-0000-0000-000000000001',
  'agent1',
  'Test Agent One',
  -- bcryptjs hash of 'Agent@123' at cost 10 (generated via bcryptjs.hash('Agent@123', 10))
  '$2a$10$qwyJ0mTVIAGZ1lUBhS45bOn2eYazsbwdXUfX.mA7AnxH1iGdG.NKa',
  'offline',
  TRUE
)
ON CONFLICT (username) DO UPDATE SET
  display_name  = EXCLUDED.display_name,
  password_hash = EXCLUDED.password_hash,
  is_active     = EXCLUDED.is_active,
  updated_at    = NOW();

-- Assign TeleCMI credentials to agent1.
-- Extension 5002 corresponds to the "Uday Automobiles" agent slot in the
-- TeleCMI account (appid 33335989). The account has a fixed 2-agent limit so
-- these extensions are permanent fixtures — provisioning via the TeleCMI REST
-- API is not possible when the limit is reached.
-- agent_id format: "{extension}_{appId}" as required by piopiy WebRTC SDK.
UPDATE users SET
  telecmi_agent_id     = '5002_33335989',
  telecmi_extension    = 5002,
  telecmi_sip_password = 'Excellon@123'
WHERE username = 'agent1';

-- Insert noaccess (no role — used to test RBAC denial)
INSERT INTO users (
  id,
  username,
  display_name,
  password_hash,
  status,
  is_active
)
VALUES (
  'a2000000-0000-0000-0000-000000000002',
  'noaccess',
  'Test No Access User',
  -- bcrypt hash of 'NoAccess@123' at cost 10
  '$2b$10$8Kg6O5xM7xO2u.VEFJlzp.H5QvGW0/YJTXRXWGmFsYl0cbJ6GqLpC',
  'offline',
  TRUE
)
ON CONFLICT (username) DO UPDATE SET
  display_name  = EXCLUDED.display_name,
  password_hash = EXCLUDED.password_hash,
  is_active     = EXCLUDED.is_active,
  updated_at    = NOW();

-- Assign 'agent' role to agent1
INSERT INTO user_role_assignments (user_id, role_id)
SELECT
  u.id AS user_id,
  r.id AS role_id
FROM users u
CROSS JOIN roles r
WHERE u.username = 'agent1'
  AND r.name = 'agent'
ON CONFLICT DO NOTHING;

-- noaccess user intentionally has NO role assignments
-- This allows testing of the 403 Forbidden response path.
