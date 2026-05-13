-- Migration 030: Add session_mode to users table
-- Phase 1.5: Stores whether the agent chose Manual or CTI mode at login.
-- NULL = not yet selected (dialog shown on next login).
-- Reset to NULL on logout so dialog appears again on next login.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS session_mode VARCHAR(10)
  DEFAULT NULL
  CHECK (session_mode IS NULL OR session_mode IN ('manual', 'cti'));

COMMENT ON COLUMN users.session_mode IS
  'Agent session mode selected at login: manual | cti | NULL (unselected). '
  'Reset to NULL on logout. Set by PATCH /api/v1/auth/session-mode.';
