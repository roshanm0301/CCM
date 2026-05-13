-- =============================================================================
-- Migration 002: Create roles table
--
-- System role definitions for RBAC.
-- Source: data-model-outline.md § roles, security-principles.md
-- =============================================================================

CREATE TABLE IF NOT EXISTS roles (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(100) NOT NULL,
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT roles_name_unique UNIQUE (name)
);

-- Seed Phase 1 roles
INSERT INTO roles (name, description) VALUES
  ('agent',      'CCM call centre agent — can start and close interactions'),
  ('supervisor', 'CCM supervisor — read access to agent interactions (future phase)')
ON CONFLICT (name) DO NOTHING;

COMMENT ON TABLE roles IS 'System role definitions for CCM RBAC.';
