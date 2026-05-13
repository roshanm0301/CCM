// =============================================================================
// CCM API — Agent Status Repository
// =============================================================================

import { getPool } from '../../shared/database/postgres';

export interface AgentStatusRow {
  user_id: string;
  status_code: string;
  previous_status_code: string | null;
  changed_at: Date;
  changed_by_user_id: string;
  correlation_id: string | null;
}

export async function getAgentStatusByUserId(userId: string): Promise<AgentStatusRow | null> {
  const sql = `
    SELECT user_id, status_code, previous_status_code, changed_at, changed_by_user_id, correlation_id
    FROM agent_statuses
    WHERE user_id = $1
  `;
  const result = await getPool().query<AgentStatusRow>(sql, [userId]);
  return result.rows[0] ?? null;
}

export async function updateAgentStatus(
  userId: string,
  newStatus: string,
  correlationId: string,
): Promise<AgentStatusRow> {
  const sql = `
    INSERT INTO agent_statuses (user_id, status_code, previous_status_code, changed_at, changed_by_user_id, correlation_id)
    VALUES ($1, $2, NULL, NOW(), $1, $3)
    ON CONFLICT (user_id) DO UPDATE SET
      previous_status_code = agent_statuses.status_code,
      status_code          = EXCLUDED.status_code,
      changed_at           = NOW(),
      changed_by_user_id   = EXCLUDED.changed_by_user_id,
      correlation_id       = EXCLUDED.correlation_id
    RETURNING user_id, status_code, previous_status_code, changed_at, changed_by_user_id, correlation_id
  `;
  const result = await getPool().query<AgentStatusRow>(sql, [userId, newStatus, correlationId]);
  return result.rows[0]!;
}
