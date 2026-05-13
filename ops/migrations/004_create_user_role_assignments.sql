-- =============================================================================
-- Migration 004: Create user_role_assignments table
--
-- Many-to-many mapping between users and roles.
-- Source: data-model-outline.md § user_role_assignments
-- =============================================================================

CREATE TABLE IF NOT EXISTS user_role_assignments (
  user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id    UUID        NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  assigned_by UUID        REFERENCES users(id),

  PRIMARY KEY (user_id, role_id)
);

CREATE INDEX IF NOT EXISTS idx_user_role_assignments_user_id
  ON user_role_assignments (user_id);

CREATE INDEX IF NOT EXISTS idx_user_role_assignments_role_id
  ON user_role_assignments (role_id);

COMMENT ON TABLE user_role_assignments IS 'Many-to-many mapping of users to their assigned system roles.';
COMMENT ON COLUMN user_role_assignments.assigned_by IS 'User ID of the administrator who made the assignment. NULL for seed data.';
