// =============================================================================
// CCM API — CTI Routing Service
//
// Builds TeleCMI routing response by querying agents with ready_for_calls status.
// =============================================================================

import { getPool } from '../../shared/database/postgres';
import { getCtiConfig } from './cti.config';
import type { TeleCmiRoutingRequest, TeleCmiRoutingResponse } from './cti.types';
import { AppError } from '../../shared/errors/AppError';
import { logger } from '../../shared/logging/logger';

export async function buildRoutingResponse(
  payload: TeleCmiRoutingRequest,
): Promise<TeleCmiRoutingResponse> {
  const config = getCtiConfig();

  // Basic app ID verification
  if (String(payload.appid) !== String(config.appId)) {
    throw new AppError('FORBIDDEN', 'Invalid appid', 403);
  }

  const result = await getPool().query<{
    telecmi_agent_id: string | null;
    telecmi_extension: number | null;
    telecmi_phone_number: string | null;
  }>(
    `SELECT u.telecmi_agent_id, u.telecmi_extension, u.telecmi_phone_number
     FROM agent_statuses AS a
     JOIN users AS u ON u.id = a.user_id
     WHERE a.status_code = 'ready_for_calls'
       AND u.telecmi_extension IS NOT NULL
       AND u.is_active = TRUE`,
  );

  // Routing agent_id must be the TeleCMI internal agent_id (as registered in TeleCMI portal).
  // Filter out any rows missing agent_id (manually mapped rows that only have extension).
  const agents = result.rows
    .filter((row) => row.telecmi_agent_id != null)
    .map((row) => ({
      agent_id: row.telecmi_agent_id!,
      phone: row.telecmi_phone_number ?? '919000000000',
    }));

  logger.info('CTI routing: agents available for routing', {
    module: 'cti.routing.service',
    readyForCallsRows: result.rows.length,
    routingAgentCount: agents.length,
    agents,
  });

  if (agents.length === 0) {
    logger.warn('CTI routing: no agents ready for calls — TeleCMI will get empty result list', {
      module: 'cti.routing.service',
      hint: 'Set agent status to ready_for_calls in the CCM workspace before placing a test call',
    });
  }

  return {
    code: 200,
    loop: 2,
    timeout: 20,
    followme: false,
    hangup: false,
    result: agents,
  };
}
