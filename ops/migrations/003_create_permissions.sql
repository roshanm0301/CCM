-- =============================================================================
-- Migration 003: Create permissions table
--
-- Granular permission catalog for RBAC enforcement.
-- Source: data-model-outline.md § permissions, security-principles.md
-- =============================================================================

CREATE TABLE IF NOT EXISTS permissions (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(200) NOT NULL,
  description TEXT,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  CONSTRAINT permissions_name_unique UNIQUE (name)
);

-- Seed Phase 1 permissions
INSERT INTO permissions (name, description) VALUES
  ('interaction:start',    'Start a new manual inbound interaction'),
  ('interaction:view',     'View an existing interaction record'),
  ('interaction:close',    'Close or mark an interaction as incomplete'),
  ('interaction:wrapup',   'Save wrap-up data for an interaction'),
  ('search:execute',       'Execute customer/vehicle search'),
  ('context:view',         'View customer, vehicle, and dealer context'),
  ('master-data:view',     'Read controlled reference values')
ON CONFLICT (name) DO NOTHING;

-- Assign permissions to the agent role
-- (uses a subquery so migration is idempotent even if role/permission IDs change)
CREATE TABLE IF NOT EXISTS role_permissions (
  role_id       UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'agent'
ON CONFLICT DO NOTHING;

COMMENT ON TABLE permissions IS 'Granular permission catalog for CCM RBAC.';
COMMENT ON TABLE role_permissions IS 'Maps roles to their granted permissions.';
