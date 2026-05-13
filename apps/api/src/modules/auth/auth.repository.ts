// =============================================================================
// CCM API — Auth Repository
//
// Database queries for user authentication and role resolution.
// Source: migrations 001, 002, 003, 004, 013
// =============================================================================

import { getPool } from '../../shared/database/postgres';

export interface UserRow {
  id: string;
  username: string;
  display_name: string;
  password_hash: string;
  is_active: boolean;
  /** Phase 1.5: session mode selected at login. NULL = not yet selected. */
  session_mode: 'manual' | 'cti' | null;
}

export interface UserWithRoles extends UserRow {
  roles: string[];
}

export interface AgentStatusRow {
  user_id: string;
  status_code: string;
  changed_at: Date;
}

/**
 * Look up a user by username. Returns null if not found.
 * Does NOT include password hash in the return when not needed — caller must decide.
 */
export async function findUserByUsername(username: string): Promise<UserRow | null> {
  const sql = `
    SELECT id, username, display_name, password_hash, is_active,
           session_mode AS "session_mode"
    FROM users
    WHERE username = $1
    LIMIT 1
  `;
  const result = await getPool().query<UserRow>(sql, [username]);
  return result.rows[0] ?? null;
}

/**
 * Get all role names assigned to a user.
 */
export async function findUserRoles(userId: string): Promise<string[]> {
  const sql = `
    SELECT r.name
    FROM user_role_assignments ura
    JOIN roles r ON r.id = ura.role_id
    WHERE ura.user_id = $1
  `;
  const result = await getPool().query<{ name: string }>(sql, [userId]);
  return result.rows.map((row) => row.name);
}

/**
 * Set agent status to 'offline' on login.
 * Per CCM_Phase1_Agent_Interaction_Documentation.md §B1 step 5:
 * "The system loads the default Agent status as Offline."
 * This always resets to offline on every successful login.
 */
export async function upsertAgentStatusOffline(userId: string): Promise<AgentStatusRow> {
  const sql = `
    INSERT INTO agent_statuses (user_id, status_code, previous_status_code, changed_by_user_id, changed_at)
    VALUES ($1, 'offline', NULL, $1, NOW())
    ON CONFLICT (user_id) DO UPDATE
      SET previous_status_code = agent_statuses.status_code,
          status_code          = 'offline',
          changed_by_user_id   = EXCLUDED.changed_by_user_id,
          changed_at           = NOW()
    RETURNING user_id, status_code, changed_at
  `;
  const result = await getPool().query<AgentStatusRow>(sql, [userId]);
  return result.rows[0]!;
}

/**
 * Get the current agent status row for a user.
 */
export async function getAgentStatus(userId: string): Promise<AgentStatusRow | null> {
  const sql = `
    SELECT user_id, status_code, changed_at
    FROM agent_statuses
    WHERE user_id = $1
  `;
  const result = await getPool().query<AgentStatusRow>(sql, [userId]);
  return result.rows[0] ?? null;
}

/**
 * Get user display_name by ID (used by /me to get display name from DB
 * since it is not stored in the JWT payload).
 */
export async function findUserDisplayName(userId: string): Promise<string | null> {
  const sql = `SELECT display_name FROM users WHERE id = $1 LIMIT 1`;
  const result = await getPool().query<{ display_name: string }>(sql, [userId]);
  return result.rows[0]?.display_name ?? null;
}

/**
 * Get a user row by ID. Returns null if not found.
 * Includes session_mode for CTI session-mode checks.
 */
export async function findUserById(userId: string): Promise<UserRow | null> {
  const sql = `
    SELECT id, username, display_name, password_hash, is_active,
           session_mode AS "session_mode"
    FROM users
    WHERE id = $1
    LIMIT 1
  `;
  const result = await getPool().query<UserRow>(sql, [userId]);
  return result.rows[0] ?? null;
}

/**
 * Phase 1.5: Persist the agent's chosen session mode (manual | cti).
 * Called by PATCH /api/v1/auth/session-mode.
 */
export async function setSessionMode(userId: string, mode: 'manual' | 'cti'): Promise<void> {
  await getPool().query(
    `UPDATE users SET session_mode = $1, updated_at = NOW() WHERE id = $2`,
    [mode, userId],
  );
}

/**
 * Phase 1.5: Clear the session mode back to NULL on logout.
 * Forces the mode-selection dialog to reappear on next login.
 */
export async function clearSessionMode(userId: string): Promise<void> {
  await getPool().query(
    `UPDATE users SET session_mode = NULL, updated_at = NOW() WHERE id = $1`,
    [userId],
  );
}
