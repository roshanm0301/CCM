// =============================================================================
// CCM API — Follow-Up Repository
//
// Append-only PostgreSQL access for the case_followups table.
// Immutability is enforced by the absence of UPDATE and DELETE operations.
// =============================================================================

import { randomUUID } from 'crypto';
import { getPool } from '../../shared/database/postgres';
import type { AddFollowUpInput } from './follow-up.validator';

// ---------------------------------------------------------------------------
// Row shape
// ---------------------------------------------------------------------------

export interface FollowUpRow {
  id: string;
  case_id: string;
  customer_remarks: string;
  agent_remarks: string;
  agent_name: string;
  created_by_user_id: string;
  call_recording_link: string | null;
  created_at: Date;
}

// ---------------------------------------------------------------------------
// Repository functions
// ---------------------------------------------------------------------------

/** Insert a new follow-up record and return the persisted row. */
export async function addFollowUp(
  input: AddFollowUpInput,
  userId: string,
  agentDisplayName: string,
): Promise<FollowUpRow> {
  const id = randomUUID();

  const sql = `
    INSERT INTO case_followups
      (id, case_id, customer_remarks, agent_remarks, agent_name, created_by_user_id, call_recording_link)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING
      id,
      case_id,
      customer_remarks,
      agent_remarks,
      agent_name,
      created_by_user_id,
      call_recording_link,
      created_at
  `;

  const values = [
    id,
    input.caseId,
    input.customerRemarks,
    input.agentRemarks,
    agentDisplayName,
    userId,
    input.callRecordingLink ?? null,
  ];

  const result = await getPool().query<FollowUpRow>(sql, values);
  return result.rows[0];
}

/** Retrieve all follow-up entries for a case, latest first. */
export async function getFollowUpHistory(caseId: string): Promise<FollowUpRow[]> {
  const sql = `
    SELECT
      id,
      case_id,
      customer_remarks,
      agent_remarks,
      agent_name,
      created_by_user_id,
      call_recording_link,
      created_at
    FROM case_followups
    WHERE case_id = $1
    ORDER BY created_at DESC
  `;

  const result = await getPool().query<FollowUpRow>(sql, [caseId]);
  return result.rows;
}
