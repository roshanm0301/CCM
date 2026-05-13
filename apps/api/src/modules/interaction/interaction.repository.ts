// =============================================================================
// CCM API — Interaction Repository
//
// All PostgreSQL queries for the interaction lifecycle.
// Source: migrations 005, 006; phase1-technical-blueprint.md §6
// =============================================================================

import { PoolClient } from 'pg';
import { getPool } from '../../shared/database/postgres';

// ---------------------------------------------------------------------------
// Row types (match exact DB column names)
// ---------------------------------------------------------------------------

export interface InteractionRow {
  id: string;
  channel: string;
  mode: string;
  status: string;
  started_at: Date;
  ended_at: Date | null;
  started_by_user_id: string;
  completion_flag: boolean | null;
  current_customer_ref: string | null;
  current_vehicle_ref: string | null;
  current_dealer_ref: string | null;
  correlation_id: string;
  created_at: Date;
  updated_at: Date;
  cti_cmiuuid: string | null;
  cti_from_number: string | null;
  customer_phone_number: string | null;
}

export interface CreateInteractionOptions {
  channel?: string;
  mode?: string;
  ctiCmiuuid?: string;
  ctiFromNumber?: string;
}

export interface WrapupRow {
  id: string;
  interaction_id: string;
  contact_reason_code: string;
  identification_outcome_code: string;
  interaction_disposition_code: string;
  remarks: string | null;
  saved_by_user_id: string;
  saved_at: Date;
}

export interface EventRow {
  id: string;
  interaction_id: string | null;
  event_name: string;
  event_at: Date;
  actor_user_id: string;
  event_payload_json: Record<string, unknown> | null;
  correlation_id: string | null;
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/** Find a single interaction by ID. */
export async function findInteractionById(
  id: string,
  client?: PoolClient,
): Promise<InteractionRow | null> {
  const sql = `
    SELECT id, channel, mode, status, started_at, ended_at, started_by_user_id,
           completion_flag, current_customer_ref, current_vehicle_ref,
           current_dealer_ref, correlation_id, created_at, updated_at,
           cti_cmiuuid, cti_from_number, customer_phone_number
    FROM interactions
    WHERE id = $1
    LIMIT 1
  `;
  const executor = client ?? getPool();
  const result = await executor.query<InteractionRow>(sql, [id]);
  return result.rows[0] ?? null;
}

/** Check if an agent already has an open interaction. */
export async function findOpenInteractionForAgent(
  userId: string,
  client?: PoolClient,
): Promise<InteractionRow | null> {
  const sql = `
    SELECT id, status, cti_cmiuuid, cti_from_number
    FROM interactions
    WHERE started_by_user_id = $1
      AND status NOT IN ('CLOSED', 'INCOMPLETE')
    LIMIT 1
  `;
  const executor = client ?? getPool();
  const result = await executor.query<InteractionRow>(sql, [userId]);
  return result.rows[0] ?? null;
}

/**
 * Create a new interaction with status=NEW, then immediately update to IDENTIFYING.
 * Both writes happen within the caller-supplied transaction client (when provided)
 * or a standalone transaction when called without a client.
 *
 * Accepts an optional PoolClient so the service can include the audit event write
 * inside the same transaction, preventing a gap between the committed interaction
 * row and the audit entry.
 *
 * Returns the newly created interaction row.
 */
export async function createInteraction(
  userId: string,
  correlationId: string,
  client?: PoolClient,
  options?: CreateInteractionOptions,
): Promise<InteractionRow> {
  const channel = options?.channel ?? 'manual';
  const mode = options?.mode ?? 'manual';
  const ctiCmiuuid = options?.ctiCmiuuid ?? null;
  const ctiFromNumber = options?.ctiFromNumber ?? null;

  // Insert with NEW
  const insertSql = `
    INSERT INTO interactions
      (channel, mode, status, started_by_user_id, correlation_id, cti_cmiuuid, cti_from_number, customer_phone_number)
    VALUES ($1, $2, 'NEW', $3, $4, $5, $6, $6)
    RETURNING id, channel, mode, status, started_at, ended_at, started_by_user_id,
              completion_flag, current_customer_ref, current_vehicle_ref,
              current_dealer_ref, correlation_id, created_at, updated_at,
              cti_cmiuuid, cti_from_number, customer_phone_number
  `;

  const insertParams = [channel, mode, userId, correlationId, ctiCmiuuid, ctiFromNumber];

  // Immediately transition to IDENTIFYING
  const updateSql = `
    UPDATE interactions
    SET status = 'IDENTIFYING', updated_at = NOW()
    WHERE id = $1
  `;

  if (client) {
    // Caller owns the transaction — execute within it
    const insertResult = await client.query<InteractionRow>(insertSql, insertParams);
    const interaction = insertResult.rows[0]!;
    await client.query(updateSql, [interaction.id]);
    interaction.status = 'IDENTIFYING';
    return interaction;
  }

  // No caller-supplied client — manage our own transaction
  const pool = getPool();
  const ownClient = await pool.connect();
  try {
    await ownClient.query('BEGIN');
    const insertResult = await ownClient.query<InteractionRow>(insertSql, insertParams);
    const interaction = insertResult.rows[0]!;
    await ownClient.query(updateSql, [interaction.id]);
    interaction.status = 'IDENTIFYING';
    await ownClient.query('COMMIT');
    return interaction;
  } catch (err) {
    await ownClient.query('ROLLBACK');
    throw err;
  } finally {
    ownClient.release();
  }
}

/** Update interaction context refs and set status to CONTEXT_CONFIRMED. */
export async function updateInteractionContext(
  id: string,
  customerRef: string,
  vehicleRef: string | null,
  dealerRef: string | null,
  phoneNumber: string | null,
  client?: PoolClient,
): Promise<InteractionRow> {
  const sql = `
    UPDATE interactions
    SET status = 'CONTEXT_CONFIRMED',
        current_customer_ref = $2,
        current_vehicle_ref = $3,
        current_dealer_ref = $4,
        customer_phone_number = COALESCE($5, customer_phone_number),
        updated_at = NOW()
    WHERE id = $1
    RETURNING id, channel, mode, status, started_at, ended_at, started_by_user_id,
              completion_flag, current_customer_ref, current_vehicle_ref,
              current_dealer_ref, correlation_id, created_at, updated_at,
              cti_cmiuuid, cti_from_number, customer_phone_number
  `;
  const executor = client ?? getPool();
  const result = await executor.query<InteractionRow>(sql, [id, customerRef, vehicleRef, dealerRef, phoneNumber]);
  return result.rows[0]!;
}

/** Transition interaction to WRAPUP status. */
export async function transitionToWrapup(
  id: string,
  client?: PoolClient,
): Promise<void> {
  const sql = `
    UPDATE interactions
    SET status = 'WRAPUP', updated_at = NOW()
    WHERE id = $1
  `;
  const executor = client ?? getPool();
  await executor.query(sql, [id]);
}

/** Close an interaction (WRAPUP → CLOSED). */
export async function closeInteraction(
  id: string,
  client?: PoolClient,
): Promise<InteractionRow> {
  const sql = `
    UPDATE interactions
    SET status = 'CLOSED',
        ended_at = NOW(),
        completion_flag = TRUE,
        updated_at = NOW()
    WHERE id = $1
    RETURNING id, channel, mode, status, started_at, ended_at, started_by_user_id,
              completion_flag, current_customer_ref, current_vehicle_ref,
              current_dealer_ref, correlation_id, created_at, updated_at,
              cti_cmiuuid, cti_from_number, customer_phone_number
  `;
  const executor = client ?? getPool();
  const result = await executor.query<InteractionRow>(sql, [id]);
  return result.rows[0]!;
}

/** Mark an interaction incomplete (WRAPUP → INCOMPLETE). */
export async function markInteractionIncomplete(
  id: string,
  client?: PoolClient,
): Promise<InteractionRow> {
  const sql = `
    UPDATE interactions
    SET status = 'INCOMPLETE',
        ended_at = NOW(),
        completion_flag = FALSE,
        updated_at = NOW()
    WHERE id = $1
    RETURNING id, channel, mode, status, started_at, ended_at, started_by_user_id,
              completion_flag, current_customer_ref, current_vehicle_ref,
              current_dealer_ref, correlation_id, created_at, updated_at,
              cti_cmiuuid, cti_from_number, customer_phone_number
  `;
  const executor = client ?? getPool();
  const result = await executor.query<InteractionRow>(sql, [id]);
  return result.rows[0]!;
}

/** Upsert a wrapup record (UNIQUE on interaction_id). */
export async function upsertWrapup(
  interactionId: string,
  contactReasonCode: string,
  identificationOutcomeCode: string,
  interactionDispositionCode: string,
  remarks: string | null,
  savedByUserId: string,
  client?: PoolClient,
): Promise<WrapupRow> {
  const sql = `
    INSERT INTO interaction_wrapups
      (interaction_id, contact_reason_code, identification_outcome_code,
       interaction_disposition_code, remarks, saved_by_user_id, saved_at)
    VALUES ($1, $2, $3, $4, $5, $6, NOW())
    ON CONFLICT (interaction_id) DO UPDATE SET
      contact_reason_code          = EXCLUDED.contact_reason_code,
      identification_outcome_code  = EXCLUDED.identification_outcome_code,
      interaction_disposition_code = EXCLUDED.interaction_disposition_code,
      remarks                      = EXCLUDED.remarks,
      saved_by_user_id             = EXCLUDED.saved_by_user_id,
      saved_at                     = NOW()
    RETURNING id, interaction_id, contact_reason_code, identification_outcome_code,
              interaction_disposition_code, remarks, saved_by_user_id, saved_at
  `;
  const executor = client ?? getPool();
  const result = await executor.query<WrapupRow>(sql, [
    interactionId,
    contactReasonCode,
    identificationOutcomeCode,
    interactionDispositionCode,
    remarks,
    savedByUserId,
  ]);
  return result.rows[0]!;
}

/** Get the wrapup record for an interaction. */
export async function findWrapupByInteractionId(
  interactionId: string,
  client?: PoolClient,
): Promise<WrapupRow | null> {
  const sql = `
    SELECT id, interaction_id, contact_reason_code, identification_outcome_code,
           interaction_disposition_code, remarks, saved_by_user_id, saved_at
    FROM interaction_wrapups
    WHERE interaction_id = $1
    LIMIT 1
  `;
  const executor = client ?? getPool();
  const result = await executor.query<WrapupRow>(sql, [interactionId]);
  return result.rows[0] ?? null;
}

/** Get all events for an interaction, ordered by time. */
export async function findEventsByInteractionId(interactionId: string): Promise<EventRow[]> {
  const sql = `
    SELECT id, interaction_id, event_name, event_at, actor_user_id,
           event_payload_json, correlation_id
    FROM interaction_events
    WHERE interaction_id = $1
    ORDER BY event_at ASC
  `;
  const result = await getPool().query<EventRow>(sql, [interactionId]);
  return result.rows;
}

// ---------------------------------------------------------------------------
// Interaction list (Phase 1.5)
// ---------------------------------------------------------------------------

export interface InteractionListItem {
  id: string;
  channel: string;
  status: string;
  started_at: Date;
  ended_at: Date | null;
  agent_name: string;
  customer_name: string | null;
  customer_ref: string | null;
  customer_phone_number: string | null;
}

/**
 * List interactions with optional status filter and free-text search,
 * ordered by started_at DESC. Returns paginated rows and total count.
 *
 * search matches (case-insensitive) against agent display_name or customer name
 * from the latest context_snapshot.  Passing null/undefined disables the filter.
 */
export async function listInteractions(params: {
  status?: 'CLOSED' | 'INCOMPLETE';
  search?: string;
  limit: number;
  offset: number;
}): Promise<{ rows: InteractionListItem[]; total: number }> {
  const { status = null, search = null, limit, offset } = params;
  // Wrap search term in %…% for ILIKE; null disables the clause entirely.
  const searchPattern = search ? `%${search}%` : null;

  const rowsSql = `
    SELECT
      i.id, i.channel, i.status, i.started_at, i.ended_at,
      u.display_name AS agent_name,
      cs.snapshot_json->>'name' AS customer_name,
      cs.source_reference AS customer_ref,
      i.customer_phone_number
    FROM interactions i
    JOIN users u ON u.id = i.started_by_user_id
    LEFT JOIN LATERAL (
      SELECT snapshot_json, source_reference
      FROM context_snapshots
      WHERE interaction_id = i.id
        AND snapshot_type = 'customer'
      ORDER BY captured_at DESC
      LIMIT 1
    ) cs ON TRUE
    WHERE ($1::text IS NULL OR i.status = $1)
      AND ($2::text IS NULL
           OR u.display_name ILIKE $2
           OR cs.snapshot_json->>'name' ILIKE $2)
    ORDER BY i.started_at DESC
    LIMIT $3 OFFSET $4
  `;

  const countSql = `
    SELECT COUNT(*) AS total
    FROM interactions i
    JOIN users u ON u.id = i.started_by_user_id
    LEFT JOIN LATERAL (
      SELECT snapshot_json
      FROM context_snapshots
      WHERE interaction_id = i.id
        AND snapshot_type = 'customer'
      ORDER BY captured_at DESC
      LIMIT 1
    ) cs ON TRUE
    WHERE ($1::text IS NULL OR i.status = $1)
      AND ($2::text IS NULL
           OR u.display_name ILIKE $2
           OR cs.snapshot_json->>'name' ILIKE $2)
  `;

  const [rowsResult, countResult] = await Promise.all([
    getPool().query<InteractionListItem>(rowsSql, [status, searchPattern, limit, offset]),
    getPool().query<{ total: string }>(countSql, [status, searchPattern]),
  ]);

  return {
    rows: rowsResult.rows,
    total: parseInt(countResult.rows[0]?.total ?? '0', 10),
  };
}

/** Find an interaction by CTI cmiuuid. */
export async function findInteractionByCmiuuid(
  cmiuuid: string,
): Promise<InteractionRow | null> {
  const sql = `
    SELECT id, channel, mode, status, started_at, ended_at, started_by_user_id,
           completion_flag, current_customer_ref, current_vehicle_ref,
           current_dealer_ref, correlation_id, created_at, updated_at,
           cti_cmiuuid, cti_from_number, customer_phone_number
    FROM interactions
    WHERE cti_cmiuuid = $1
    LIMIT 1
  `;
  const result = await getPool().query<InteractionRow>(sql, [cmiuuid]);
  return result.rows[0] ?? null;
}

/** Look up a reference value to check remarksRequired flag. */
export async function findReferenceValue(
  referenceType: string,
  code: string,
): Promise<{ code: string; metadata: Record<string, unknown> | null } | null> {
  const sql = `
    SELECT code, metadata
    FROM reference_values
    WHERE reference_type = $1
      AND code = $2
      AND is_active = TRUE
    LIMIT 1
  `;
  const result = await getPool().query<{ code: string; metadata: Record<string, unknown> | null }>(
    sql,
    [referenceType, code],
  );
  return result.rows[0] ?? null;
}

/** Permanently delete an interaction and all its child rows (cascade). */
export async function deleteInteractionById(
  id: string,
  client?: PoolClient,
): Promise<boolean> {
  const sql = `DELETE FROM interactions WHERE id = $1`;
  const executor = client ?? getPool();
  const result = await executor.query(sql, [id]);
  return (result.rowCount ?? 0) > 0;
}
