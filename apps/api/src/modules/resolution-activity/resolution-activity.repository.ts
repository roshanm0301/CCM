// =============================================================================
// CCM API — Resolution Activity Repository
//
// PostgreSQL persistence for the resolution-activity state machine.
// Tables: resolution_activities (append-only audit log)
//         case_activity_state   (single-row optimistic-lock state per case)
// Source: CCM_Phase6_Resolution_Activities.md § Wave 2 Track D (migrations 100 & 101)
// =============================================================================

import { v4 as uuidv4 } from 'uuid';
import type { PoolClient } from 'pg';
import { getPool } from '../../shared/database/postgres';

// ---------------------------------------------------------------------------
// Row shapes
// ---------------------------------------------------------------------------

export interface ResolutionActivityRow {
  id: string;
  case_id: string;
  template_id: string;
  step_no: number;
  activity_id: string;
  outcome_name: string;
  outcome_type: string;
  performed_role: string;
  performed_by_user_id: string;
  remarks: string;
  attachment_ids: string;
  created_at: Date;
}

export interface CaseActivityStateRow {
  case_id: string;
  template_id: string;
  current_step_no: number;
  case_status: string;
  activity_status: string;
  version: number;
  last_updated_by: string;
  updated_at: Date;
}

/**
 * Typed result from upsertActivityState.
 * - 'inserted': first-time INSERT succeeded
 * - 'updated':  optimistic-lock UPDATE succeeded
 * - 'conflict': another request won the race (INSERT DO NOTHING or UPDATE version mismatch)
 */
export type UpsertResult = {
  status: 'inserted' | 'updated' | 'conflict';
  row: CaseActivityStateRow;
};

// ---------------------------------------------------------------------------
// Writes (require a transactional PoolClient)
// ---------------------------------------------------------------------------

/**
 * Append a new resolution activity row to the audit log.
 * Must be called within a PG transaction.
 */
export async function insertResolutionActivity(
  params: {
    caseId: string;
    templateId: string;
    stepNo: number;
    activityId: string;
    outcomeName: string;
    outcomeType: string;
    performedRole: string;
    performedByUserId: string;
    remarks: string;
    attachmentIds: string;
  },
  client: PoolClient,
): Promise<ResolutionActivityRow> {
  const id = uuidv4();
  const sql = `
    INSERT INTO resolution_activities
      (id, case_id, template_id, step_no, activity_id, outcome_name, outcome_type,
       performed_role, performed_by_user_id, remarks, attachment_ids)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    RETURNING
      id, case_id, template_id, step_no, activity_id, outcome_name, outcome_type,
      performed_role, performed_by_user_id, remarks, attachment_ids, created_at
  `;
  const values = [
    id,
    params.caseId,
    params.templateId,
    params.stepNo,
    params.activityId,
    params.outcomeName,
    params.outcomeType,
    params.performedRole,
    params.performedByUserId,
    params.remarks,
    params.attachmentIds,
  ];
  const result = await client.query<ResolutionActivityRow>(sql, values);
  return result.rows[0];
}

/**
 * Upsert the case activity state row with optimistic locking.
 *
 * - currentVersion === 0  → first-time INSERT (no row yet in DB).
 *   Uses INSERT … ON CONFLICT DO NOTHING to guard against races.
 *   Returns null if 0 rows were inserted (lost race).
 *
 * - currentVersion > 0    → UPDATE WHERE version = currentVersion.
 *   Returns null if 0 rows were updated (version mismatch — lost race or stale read).
 *
 * On success, SELECTs and returns the updated row.
 * Must be called within a PG transaction.
 */
export async function upsertActivityState(
  params: {
    caseId: string;
    templateId: string;
    newStepNo: number;
    caseStatus: string;
    activityStatus: string;
    currentVersion: number;
    userId: string;
  },
  client: PoolClient,
): Promise<UpsertResult | null> {
  const SELECT_ROW_SQL = `
    SELECT case_id, template_id, current_step_no, case_status, activity_status,
           version, last_updated_by, updated_at
      FROM case_activity_state
     WHERE case_id = $1
  `;

  if (params.currentVersion === 0) {
    // First save — attempt INSERT; ignore conflict from a concurrent INSERT.
    const sql = `
      INSERT INTO case_activity_state
        (case_id, template_id, current_step_no, case_status, activity_status,
         version, last_updated_by, updated_at)
      VALUES ($1, $2, $3, $4, $5, 1, $6, NOW())
      ON CONFLICT (case_id) DO NOTHING
    `;
    const result = await client.query(sql, [
      params.caseId,
      params.templateId,
      params.newStepNo,
      params.caseStatus,
      params.activityStatus,
      params.userId,
    ]);
    if (result.rowCount === 0) {
      // Another request already inserted — fetch existing row for typed conflict result.
      const existing = await client.query<CaseActivityStateRow>(SELECT_ROW_SQL, [params.caseId]);
      if (!existing.rows[0]) return null;
      return { status: 'conflict', row: existing.rows[0] };
    }
  } else {
    // Subsequent save — UPDATE only if version still matches.
    const sql = `
      UPDATE case_activity_state
         SET template_id      = $1,
             current_step_no  = $2,
             case_status      = $3,
             activity_status  = $4,
             version          = version + 1,
             last_updated_by  = $5,
             updated_at       = NOW()
       WHERE case_id = $6
         AND version = $7
    `;
    const result = await client.query(sql, [
      params.templateId,
      params.newStepNo,
      params.caseStatus,
      params.activityStatus,
      params.userId,
      params.caseId,
      params.currentVersion,
    ]);
    if (result.rowCount === 0) {
      // Version mismatch — fetch existing row for typed conflict result.
      const existing = await client.query<CaseActivityStateRow>(SELECT_ROW_SQL, [params.caseId]);
      if (!existing.rows[0]) return null;
      return { status: 'conflict', row: existing.rows[0] };
    }
  }

  // SELECT the freshly written row and return it with the appropriate status.
  const selectResult = await client.query<CaseActivityStateRow>(SELECT_ROW_SQL, [params.caseId]);
  if (!selectResult.rows[0]) return null;
  const status = params.currentVersion === 0 ? 'inserted' : 'updated';
  return { status, row: selectResult.rows[0] };
}

// ---------------------------------------------------------------------------
// Reads (use pool directly — no transaction needed)
// ---------------------------------------------------------------------------

/**
 * Return the current activity state for a case.
 * Returns null if no state row exists yet (case has never had an activity saved).
 */
export async function getActivityState(caseId: string): Promise<CaseActivityStateRow | null> {
  const result = await getPool().query<CaseActivityStateRow>(
    `SELECT case_id, template_id, current_step_no, case_status, activity_status,
            version, last_updated_by, updated_at
       FROM case_activity_state
      WHERE case_id = $1`,
    [caseId],
  );
  return result.rows[0] ?? null;
}

/**
 * Return the full resolution activity history for a case, oldest-first.
 */
export async function getResolutionHistory(caseId: string): Promise<ResolutionActivityRow[]> {
  const result = await getPool().query<ResolutionActivityRow>(
    `SELECT id, case_id, template_id, step_no, activity_id, outcome_name, outcome_type,
            performed_role, performed_by_user_id, remarks, attachment_ids, created_at
       FROM resolution_activities
      WHERE case_id = $1
      ORDER BY created_at ASC`,
    [caseId],
  );
  return result.rows;
}
