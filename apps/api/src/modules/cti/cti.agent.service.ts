// =============================================================================
// CCM API — CTI Agent Provisioning Service
//
// Manages TeleCMI agent lifecycle in sync with CCM users.
// Called when CCM users with the 'agent' role are created, updated, or deleted.
//
// Design notes:
// - provisionTeleCmiAgent is fire-and-forget safe: CCM user creation MUST succeed
//   even if TeleCMI provisioning fails. Errors are logged but never re-thrown.
// - There is currently no user creation API in CCM — users are seeded via DB.
//   When a user management API is built, call provisionTeleCmiAgent(newUser.id)
//   after a successful INSERT for any user whose roles include 'agent'.
// =============================================================================

import crypto from 'crypto';
import { getPool } from '../../shared/database/postgres';
import { addTeleCmiAgent, updateTeleCmiAgent, removeTeleCmiAgent, setTeleCmiAgentStatus } from './cti.client';
import { logger } from '../../shared/logging/logger';

interface UserRow {
  id: string;
  display_name: string;
  telecmi_phone_number?: string | null;
  telecmi_agent_id?: string | null;
  telecmi_extension?: number | null;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Generate a cryptographically secure 12-character alphanumeric SIP password.
 *
 * Uses crypto.randomInt() (CSPRNG) instead of Math.random() to ensure the
 * password space is not predictable. The alphabet deliberately omits visually
 * ambiguous characters (0/O, 1/I/l) to reduce transcription errors when agents
 * need to troubleshoot SIP credentials manually.
 */
function generateSipPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let result = '';
  for (let i = 0; i < 12; i++) {
    result += chars[crypto.randomInt(chars.length)];
  }
  return result;
}

/** Return the next available TeleCMI extension. Extensions start at 101. */
async function getNextTeleCmiExtension(): Promise<number> {
  const pool = getPool();
  const result = await pool.query<{ max_ext: number | null }>(
    'SELECT MAX(telecmi_extension) AS max_ext FROM users WHERE telecmi_extension IS NOT NULL',
  );
  const maxExt = result.rows[0].max_ext;
  return maxExt != null ? maxExt + 1 : 101;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Provision a new TeleCMI agent for a CCM user.
 *
 * Called when a CCM user with the 'agent' role is created (or when an existing
 * user is granted the agent role for the first time).
 *
 * This function is fire-and-forget safe: errors are logged but never re-thrown,
 * so the caller's primary operation (CCM user creation) always succeeds.
 *
 * HOOK POINT: When the user management API is implemented, call this function
 * after a successful user INSERT for any user with the 'agent' role:
 *   provisionTeleCmiAgent(newUser.id).catch(() => { /* already logged *\/ });
 */
export async function provisionTeleCmiAgent(userId: string): Promise<void> {
  const pool = getPool();

  // Fetch user details
  const userResult = await pool.query<UserRow>(
    'SELECT id, display_name, telecmi_phone_number, telecmi_agent_id FROM users WHERE id = $1',
    [userId],
  );
  if (userResult.rows.length === 0) {
    logger.warn('provisionTeleCmiAgent: user not found', { userId });
    return;
  }
  const user = userResult.rows[0];

  // Skip if already provisioned
  if (user.telecmi_agent_id) {
    logger.info('TeleCMI agent already provisioned, skipping', {
      userId,
      telecmiAgentId: user.telecmi_agent_id,
    });
    return;
  }

  const extension = await getNextTeleCmiExtension();
  const sipPassword = generateSipPassword();
  const phoneNumber = user.telecmi_phone_number ?? '919000000000';

  try {
    const agent = await addTeleCmiAgent({
      extension,
      name: user.display_name,
      phone_number: phoneNumber,
      password: sipPassword,
    });

    await pool.query(
      `UPDATE users SET
         telecmi_agent_id     = $1,
         telecmi_extension    = $2,
         telecmi_sip_password = $3,
         updated_at           = NOW()
       WHERE id = $4`,
      [agent.agent_id, extension, sipPassword, userId],
    );

    logger.info('TeleCMI agent provisioned', { userId, telecmiAgentId: agent.agent_id, extension });
  } catch (err) {
    logger.error(
      'Failed to provision TeleCMI agent — user created in CCM but not in TeleCMI',
      { err, userId, extension },
    );
    // Do NOT re-throw — CCM user creation must succeed even if TeleCMI provisioning fails
  }
}

/**
 * Sync agent display name and phone number changes to TeleCMI.
 *
 * If the user has not yet been provisioned, falls back to provisionTeleCmiAgent.
 * Errors are logged but never re-thrown.
 */
export async function syncTeleCmiAgent(userId: string): Promise<void> {
  const pool = getPool();
  const userResult = await pool.query<UserRow & { telecmi_sip_password?: string | null }>(
    'SELECT id, display_name, telecmi_phone_number, telecmi_agent_id, telecmi_sip_password FROM users WHERE id = $1',
    [userId],
  );
  if (userResult.rows.length === 0) return;
  const user = userResult.rows[0];

  if (!user.telecmi_agent_id) {
    // Not yet provisioned — try to provision now
    await provisionTeleCmiAgent(userId);
    return;
  }

  try {
    await updateTeleCmiAgent({
      id: user.telecmi_agent_id,
      name: user.display_name,
      phone_number: user.telecmi_phone_number ?? '919000000000',
      password: user.telecmi_sip_password ?? generateSipPassword(),
    });
  } catch (err) {
    logger.error('Failed to sync TeleCMI agent update — continuing', { err, userId });
  }
}

/**
 * Deactivate TeleCMI agent when a CCM user is deactivated.
 *
 * Sets the TeleCMI agent status to 'offline'. Errors are logged but not thrown.
 */
export async function deactivateTeleCmiAgent(userId: string): Promise<void> {
  const pool = getPool();
  const userResult = await pool.query<{ telecmi_agent_id: string | null }>(
    'SELECT telecmi_agent_id FROM users WHERE id = $1',
    [userId],
  );
  if (userResult.rows.length === 0) return;
  const { telecmi_agent_id } = userResult.rows[0];
  if (!telecmi_agent_id) return;

  await setTeleCmiAgentStatus(telecmi_agent_id, 'offline').catch((err) => {
    logger.error('Failed to deactivate TeleCMI agent', { err, userId, telecmi_agent_id });
  });
}

/**
 * Re-provision TeleCMI credentials for an existing agent (admin action).
 *
 * Removes the existing TeleCMI agent record, then creates a fresh one with a
 * new extension and SIP password. Throws on error — callers should handle.
 */
export async function reprovisionTeleCmiAgent(userId: string): Promise<void> {
  const pool = getPool();
  const userResult = await pool.query<UserRow & { telecmi_agent_id: string | null }>(
    'SELECT id, display_name, telecmi_phone_number, telecmi_agent_id, telecmi_extension FROM users WHERE id = $1',
    [userId],
  );
  if (userResult.rows.length === 0) throw new Error('User not found');
  const user = userResult.rows[0];

  if (user.telecmi_agent_id) {
    // Remove existing TeleCMI agent first
    await removeTeleCmiAgent(user.telecmi_agent_id);
    await pool.query(
      'UPDATE users SET telecmi_agent_id = NULL, telecmi_extension = NULL, telecmi_sip_password = NULL WHERE id = $1',
      [userId],
    );
  }

  // Re-provision fresh
  await provisionTeleCmiAgent(userId);
}
