// =============================================================================
// CCM API — Agent Status Service
//
// Source: phase1-technical-blueprint.md §5.4–5.5
//         CCM_Phase1_Agent_Interaction_Documentation.md §C11, §D11
// =============================================================================

import { AgentStatus } from '@ccm/types';
import { AppError } from '../../shared/errors/AppError';
import { logger } from '../../shared/logging/logger';
import { writeAuditEvent } from '../audit/audit.repository';
import { getAgentStatusByUserId, updateAgentStatus } from './agent-status.repository';
import { getPool } from '../../shared/database/postgres';
import { setTeleCmiAgentStatus } from '../cti/cti.client';

export interface AgentStatusResult {
  userId: string;
  currentStatus: string;
  updatedAt: string;
}

export async function getAgentStatusService(userId: string): Promise<AgentStatusResult> {
  const row = await getAgentStatusByUserId(userId);
  if (!row) {
    throw AppError.notFound('Agent status record', userId);
  }
  return {
    userId: row.user_id,
    currentStatus: row.status_code,
    updatedAt: row.changed_at.toISOString(),
  };
}

export async function updateAgentStatusService(
  userId: string,
  newStatus: string,
  correlationId: string,
): Promise<AgentStatusResult> {
  const current = await getAgentStatusByUserId(userId);
  const previousStatus = current?.status_code ?? null;

  const updated = await updateAgentStatus(userId, newStatus, correlationId);

  // Write agent_status_changed audit event — best-effort
  try {
    await writeAuditEvent({
      interactionId: null,
      eventName: 'agent_status_changed',
      actorUserId: userId,
      eventPayload: {
        previousStatus,
        newStatus,
      },
      correlationId,
    });
  } catch (auditErr) {
    logger.error('Failed to write agent_status_changed event', {
      module: 'agent-status.service',
      correlationId,
      userId,
      message: auditErr instanceof Error ? auditErr.message : String(auditErr),
    });
  }

  logger.info('Agent status updated', {
    module: 'agent-status.service',
    correlationId,
    userId,
    previousStatus,
    newStatus,
  });

  // Phase 1.5: Do not sync on_call/wrap_up back to TeleCMI — TeleCMI is the source
  if (newStatus === AgentStatus.ON_CALL || newStatus === AgentStatus.WRAP_UP) {
    return {
      userId: updated.user_id,
      currentStatus: updated.status_code,
      updatedAt: updated.changed_at.toISOString(),
    };
  }

  // Fire-and-forget TeleCMI status sync
  try {
    const userResult = await getPool().query<{ telecmi_agent_id: string | null }>(
      'SELECT telecmi_agent_id FROM users WHERE id = $1 LIMIT 1',
      [userId],
    );
    const telecmiAgentId = userResult.rows[0]?.telecmi_agent_id ?? null;

    if (telecmiAgentId) {
      let telecmiStatus: 'online' | 'offline' | 'break' | null = null;
      if (newStatus === 'ready_for_calls') {
        telecmiStatus = 'online';
      } else if (newStatus === 'offline') {
        telecmiStatus = 'offline';
      } else if (newStatus === 'break') {
        telecmiStatus = 'break';
      }

      if (telecmiStatus) {
        setTeleCmiAgentStatus(telecmiAgentId, telecmiStatus).catch((err) => {
          logger.error('TeleCMI status sync failed', {
            module: 'agent-status.service',
            correlationId,
            userId,
            telecmiAgentId,
            telecmiStatus,
            message: err instanceof Error ? err.message : String(err),
          });
        });
      }
    }
  } catch (syncErr) {
    logger.error('Failed to read telecmi_agent_id for status sync', {
      module: 'agent-status.service',
      correlationId,
      userId,
      message: syncErr instanceof Error ? syncErr.message : String(syncErr),
    });
  }

  return {
    userId: updated.user_id,
    currentStatus: updated.status_code,
    updatedAt: updated.changed_at.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// System-managed status write (Phase 1.5 CTI)
// ---------------------------------------------------------------------------

/**
 * Set an agent's status on behalf of the system (e.g., from a TeleCMI webhook).
 *
 * Differs from updateAgentStatusService in two ways:
 * 1. Skips the TeleCMI back-sync — TeleCMI is the event source for on_call/wrap_up.
 * 2. Accepts any AgentStatus value, including system-managed ones (on_call, wrap_up).
 *
 * Never expose this function through an HTTP route — it is for internal use only.
 */
export async function setSystemStatus(
  agentId: string,
  status: AgentStatus,
  correlationId: string,
): Promise<void> {
  const current = await getAgentStatusByUserId(agentId);
  const previousStatus = current?.status_code ?? null;

  await updateAgentStatus(agentId, status, correlationId);

  // Best-effort audit event
  try {
    await writeAuditEvent({
      interactionId: null,
      eventName: 'agent_status_changed',
      actorUserId: agentId,
      eventPayload: {
        previousStatus,
        newStatus: status,
        trigger: 'system_cti',
      },
      correlationId,
    });
  } catch (auditErr) {
    logger.error('Failed to write agent_status_changed event (setSystemStatus)', {
      module: 'agent-status.service',
      correlationId,
      agentId,
      message: auditErr instanceof Error ? auditErr.message : String(auditErr),
    });
  }

  logger.info('System-managed agent status set', {
    module: 'agent-status.service',
    correlationId,
    agentId,
    previousStatus,
    newStatus: status,
  });
}
