-- =============================================================================
-- Migration 001: Create users table
--
-- Stores CCM-managed user records for authentication and audit attribution.
-- Source: data-model-outline.md § users
-- =============================================================================

CREATE TABLE IF NOT EXISTS users (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username          VARCHAR(100) NOT NULL,
  display_name      VARCHAR(200) NOT NULL,
  password_hash     TEXT         NOT NULL,
  -- Status is a controlled value; see reference_values (agent_status)
  status            VARCHAR(50)  NOT NULL DEFAULT 'offline',
  external_user_ref VARCHAR(200),
  is_active         BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  CONSTRAINT users_username_unique UNIQUE (username)
);

-- Index for authentication lookups by username
CREATE INDEX IF NOT EXISTS idx_users_username ON users (username);

-- Index for filtering by status (e.g. ready agents)
CREATE INDEX IF NOT EXISTS idx_users_status ON users (status);

COMMENT ON TABLE users IS 'CCM-managed user accounts for agent authentication and audit trail attribution.';
COMMENT ON COLUMN users.external_user_ref IS 'Optional reference to an upstream identity system (e.g. LDAP, IdP user ID).';
COMMENT ON COLUMN users.status IS 'References reference_values.code WHERE reference_type = ''agent_status''.';
