-- =============================================================
-- DEV SEED ONLY — DO NOT RUN IN STAGING OR PRODUCTION
-- Seeds a simplified dealer test account: dealer1 / Dealer@123
--
-- This seed creates a single dealer user with the
-- dealer_service_advisor role, intended for quick Phase 6
-- browser verification without needing to remember the
-- role-specific usernames from seed_activity_flow_users_dev_only.sql.
--
-- Password: Dealer@123
-- Hash generated via: bcryptjs.hashSync('Dealer@123', 10)
--
-- Dealer association: DLR-001 (Sharma Bajaj Motors, Pune)
-- — same dealership as dlr1_* users from Phase 5 seed.
--
-- Source: CCM_Phase6_Resolution_Activities.md — browser verification
-- =============================================================

INSERT INTO users (
  id,
  username,
  display_name,
  password_hash,
  status,
  external_user_ref,
  is_active
)
VALUES (
  'd1000000-0000-0000-0000-000000000001',
  'dealer1',
  'Test Dealer One',
  -- bcryptjs hash of 'Dealer@123' at cost 10
  '$2a$10$fYWvUhlBFr17C5FkZIckdOyOWMmXW4sOG6JtCdlk62MB1q/9um0ka',
  'offline',
  'DLR-001',
  TRUE
)
ON CONFLICT (username) DO UPDATE SET
  display_name      = EXCLUDED.display_name,
  password_hash     = EXCLUDED.password_hash,
  external_user_ref = EXCLUDED.external_user_ref,
  is_active         = EXCLUDED.is_active,
  updated_at        = NOW();

-- Assign dealer_service_advisor role
INSERT INTO user_role_assignments (user_id, role_id)
SELECT
  u.id   AS user_id,
  r.id   AS role_id
FROM users u
CROSS JOIN roles r
WHERE u.username = 'dealer1'
  AND r.name     = 'dealer_service_advisor'
ON CONFLICT DO NOTHING;
