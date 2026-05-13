// =============================================================================
// CCM API — Test Database Helpers
//
// Utilities for integration tests that interact with the real test PostgreSQL
// database. All operations are scoped to test data only.
// Requires: TEST_DATABASE_URL env var to be set.
// =============================================================================

import { Pool } from 'pg';

// ---------------------------------------------------------------------------
// Pool singleton for test DB
// ---------------------------------------------------------------------------

let testPool: Pool | null = null;

export function getTestPool(): Pool {
  if (!testPool) {
    const connectionString = process.env['TEST_DATABASE_URL'];
    if (!connectionString) {
      throw new Error(
        'TEST_DATABASE_URL environment variable is not set. ' +
          'Copy apps/api/.env.test.example to apps/api/.env.test and fill in values.',
      );
    }
    testPool = new Pool({
      connectionString,
      max: 5,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 5_000,
    });
  }
  return testPool;
}

export async function closeTestPool(): Promise<void> {
  if (testPool) {
    await testPool.end();
    testPool = null;
  }
}

// ---------------------------------------------------------------------------
// Cleanup helpers — always scope deletes to test data to avoid accidents
// ---------------------------------------------------------------------------

/**
 * Delete all interactions and their related audit events for a given userId.
 * Also cleans up wrapups and search attempts.
 */
export async function cleanupInteractions(userId: string): Promise<void> {
  const pool = getTestPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Get interaction IDs to clean up
    const { rows: interactions } = await client.query<{ id: string }>(
      `SELECT id FROM interactions WHERE started_by_user_id = $1`,
      [userId],
    );
    const ids = interactions.map((r) => r.id);

    if (ids.length > 0) {
      const placeholders = ids.map((_, i) => `$${i + 1}`).join(', ');

      // Delete audit events for these interactions
      await client.query(
        `DELETE FROM interaction_events WHERE interaction_id IN (${placeholders})`,
        ids,
      );

      // Delete wrapups
      await client.query(
        `DELETE FROM interaction_wrapups WHERE interaction_id IN (${placeholders})`,
        ids,
      );

      // Delete search attempts
      await client.query(
        `DELETE FROM search_attempts WHERE interaction_id IN (${placeholders})`,
        ids,
      );

      // Delete interactions
      await client.query(
        `DELETE FROM interactions WHERE id IN (${placeholders})`,
        ids,
      );
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Reset agent status for a given userId (removes the row entirely so tests
 * always start from a clean state).
 */
export async function cleanupAgentStatus(userId: string): Promise<void> {
  await getTestPool().query(`DELETE FROM agent_statuses WHERE user_id = $1`, [userId]);
}

/**
 * Remove all audit events that are not tied to an interaction (e.g., agent_status_changed)
 * for a given userId.
 */
export async function cleanupUserAuditEvents(userId: string): Promise<void> {
  await getTestPool().query(
    `DELETE FROM interaction_events WHERE actor_user_id = $1 AND interaction_id IS NULL`,
    [userId],
  );
}

/**
 * Seed a test user. If the user already exists (by username), updates the hash
 * and sets is_active = true. Returns the user id.
 *
 * @param username - username to create
 * @param passwordHash - bcrypt hash of the desired password
 * @param displayName - display name for the user
 * @param isActive - whether the user should be active (default true)
 */
export async function seedTestUser(
  username: string,
  passwordHash: string,
  displayName: string = 'Test User',
  isActive: boolean = true,
): Promise<string> {
  const { rows } = await getTestPool().query<{ id: string }>(
    `
    INSERT INTO users (username, display_name, password_hash, status, is_active)
    VALUES ($1, $2, $3, 'offline', $4)
    ON CONFLICT (username) DO UPDATE SET
      display_name  = EXCLUDED.display_name,
      password_hash = EXCLUDED.password_hash,
      is_active     = EXCLUDED.is_active,
      updated_at    = NOW()
    RETURNING id
    `,
    [username, displayName, passwordHash, isActive],
  );
  return rows[0]!.id;
}

/**
 * Assign the 'agent' role to a user. Safe to call if assignment already exists.
 */
export async function assignAgentRole(userId: string): Promise<void> {
  await getTestPool().query(
    `
    INSERT INTO user_role_assignments (user_id, role_id)
    SELECT $1, r.id
    FROM roles r
    WHERE r.name = 'agent'
    ON CONFLICT DO NOTHING
    `,
    [userId],
  );
}

/**
 * Remove a test user by username (cascades via FK — removes role assignments).
 * Only removes users with IDs that do NOT match seeded fixture IDs to prevent
 * accidentally removing permanently seeded test accounts.
 */
export async function removeTestUser(username: string): Promise<void> {
  const pool = getTestPool();

  // Remove role assignments first (FK constraint)
  await pool.query(
    `DELETE FROM user_role_assignments WHERE user_id = (SELECT id FROM users WHERE username = $1)`,
    [username],
  );

  await pool.query(`DELETE FROM users WHERE username = $1`, [username]);
}

/**
 * Seed an interaction in a given status directly in DB for state-based tests.
 * Returns the interaction id.
 */
export async function seedInteraction(
  userId: string,
  status: 'IDENTIFYING' | 'CONTEXT_CONFIRMED' | 'WRAPUP' | 'CLOSED' | 'INCOMPLETE',
  correlationId = 'test-corr-seed',
): Promise<string> {
  const pool = getTestPool();
  const { rows } = await pool.query<{ id: string }>(
    `
    INSERT INTO interactions (channel, mode, status, started_by_user_id, correlation_id)
    VALUES ('manual', 'manual', $1, $2, $3)
    RETURNING id
    `,
    [status, userId, correlationId],
  );
  return rows[0]!.id;
}

/**
 * Seed a wrapup record for an existing interaction.
 */
export async function seedWrapup(
  interactionId: string,
  userId: string,
  dispositionCode = 'information_provided',
  remarks: string | null = null,
): Promise<void> {
  await getTestPool().query(
    `
    INSERT INTO interaction_wrapups
      (interaction_id, contact_reason_code, identification_outcome_code,
       interaction_disposition_code, remarks, saved_by_user_id, saved_at)
    VALUES ($1, 'query', 'customer_vehicle_identified', $2, $3, $4, NOW())
    ON CONFLICT (interaction_id) DO UPDATE SET
      interaction_disposition_code = EXCLUDED.interaction_disposition_code,
      remarks = EXCLUDED.remarks,
      saved_at = NOW()
    `,
    [interactionId, dispositionCode, remarks, userId],
  );
}

/**
 * Count interaction_events for a given interactionId and optional event name.
 */
export async function countAuditEvents(
  interactionId: string | null,
  eventName?: string,
): Promise<number> {
  const pool = getTestPool();

  if (interactionId === null && eventName) {
    const { rows } = await pool.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM interaction_events WHERE interaction_id IS NULL AND event_name = $1`,
      [eventName],
    );
    return parseInt(rows[0]!.count, 10);
  }

  if (eventName) {
    const { rows } = await pool.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM interaction_events WHERE interaction_id = $1 AND event_name = $2`,
      [interactionId, eventName],
    );
    return parseInt(rows[0]!.count, 10);
  }

  const { rows } = await pool.query<{ count: string }>(
    `SELECT COUNT(*) as count FROM interaction_events WHERE interaction_id = $1`,
    [interactionId],
  );
  return parseInt(rows[0]!.count, 10);
}
