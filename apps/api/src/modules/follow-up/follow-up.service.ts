// =============================================================================
// CCM API — Follow-Up Service
//
// Business logic layer for follow-up entries.
// Business rules:
//   1. Only agent persona (role 'agent' or 'ccm_agent') may add follow-ups.
//   2. Follow-ups cannot be added to a Closed case.
// =============================================================================

import { AppError } from '../../shared/errors/AppError';
import { CaseModel } from '../../shared/models/case.model';
import type { CaseStatus } from '../../shared/models/case.model';
import { getPool } from '../../shared/database/postgres';
import { writeAuditEvent } from '../audit/audit.repository';
import { addFollowUp, getFollowUpHistory } from './follow-up.repository';
import type { AddFollowUpInput } from './follow-up.validator';

// ---------------------------------------------------------------------------
// DTO shape
// ---------------------------------------------------------------------------

export interface FollowUpDto {
  id: string;
  caseId: string;
  customerRemarks: string;
  agentRemarks: string;
  agentName: string;
  callRecordingLink: string | null;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Mapper
// ---------------------------------------------------------------------------

function toDto(row: Awaited<ReturnType<typeof addFollowUp>>): FollowUpDto {
  return {
    id:                 row.id,
    caseId:             row.case_id,
    customerRemarks:    row.customer_remarks,
    agentRemarks:       row.agent_remarks,
    agentName:          row.agent_name,
    callRecordingLink:  row.call_recording_link,
    createdAt:          row.created_at instanceof Date
      ? row.created_at.toISOString()
      : new Date(row.created_at).toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Closed case statuses — follow-ups are blocked for these
// ---------------------------------------------------------------------------

const CLOSED_STATUSES: CaseStatus[] = ['Closed \u2013 Verified', 'Closed \u2013 Not Verified'];

// ---------------------------------------------------------------------------
// Service functions
// ---------------------------------------------------------------------------

/** Add an immutable follow-up entry to a case. */
export async function addFollowUpService(
  input: AddFollowUpInput,
  userId: string,
  actorRoles: string[],
  correlationId: string,
): Promise<FollowUpDto> {
  // 1. Role guard — only agent persona may add follow-ups
  const hasAgentRole = actorRoles.includes('agent') || actorRoles.includes('ccm_agent');
  if (!hasAgentRole) {
    throw AppError.forbidden('Only agents can add follow-ups.');
  }

  // 2. Fetch case from MongoDB and check caseStatus
  const caseDoc = await CaseModel.findOne({ caseId: input.caseId }).lean().exec();
  if (!caseDoc) {
    throw AppError.notFound('Case', input.caseId);
  }
  if (CLOSED_STATUSES.includes(caseDoc.caseStatus)) {
    throw new AppError('INVALID_STATUS_TRANSITION', 'Cannot add a follow-up to a Closed case.', 422);
  }

  // 3. Resolve agent display name from PostgreSQL users table
  const userResult = await getPool().query<{ display_name: string }>(
    'SELECT display_name FROM users WHERE id = $1',
    [userId],
  );
  const agentDisplayName = userResult.rows[0]?.display_name ?? 'Unknown Agent';

  // 4. Persist the follow-up record
  const row = await addFollowUp(input, userId, agentDisplayName);

  // 5. Audit — non-fatal
  try {
    await writeAuditEvent({
      interactionId: null,
      eventName: 'followup_added',
      actorUserId: userId,
      eventPayload: { caseId: input.caseId, followUpId: row.id },
      correlationId,
    });
  } catch {
    // Audit write failure is non-fatal — error already logged in audit.repository
  }

  return toDto(row);
}

/** Retrieve the full follow-up history for a case (latest first). */
export async function getFollowUpHistoryService(caseId: string): Promise<FollowUpDto[]> {
  const rows = await getFollowUpHistory(caseId);
  return rows.map(toDto);
}
