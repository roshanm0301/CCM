// =============================================================================
// CCM API — CTI Routing Controller
//
// Handles TeleCMI agent routing requests.
// =============================================================================

import type { Request, Response, NextFunction } from 'express';
import { buildRoutingResponse } from './cti.routing.service';
import type { TeleCmiRoutingRequest } from './cti.types';
import { logger } from '../../shared/logging/logger';

export async function ctiRoutingController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const payload = req.body as TeleCmiRoutingRequest;

    logger.info('TeleCMI routing request received', {
      module: 'cti.routing.controller',
      appid: payload.appid,
      body: payload,
    });

    const response = await buildRoutingResponse(payload);

    logger.info('TeleCMI routing response sent', {
      module: 'cti.routing.controller',
      agentCount: response.result.length,
      agents: response.result,
    });

    res.status(200).json(response);
  } catch (err) {
    // Always return 200 to TeleCMI even on error (TeleCMI expects 200)
    // but log the error
    logger.error('TeleCMI routing error — falling back to empty agent list', {
      module: 'cti.routing.controller',
      err,
    });
    // Return empty routing response so TeleCMI doesn't get a non-200 error
    res.status(200).json({
      code: 200,
      loop: 1,
      timeout: 20,
      followme: false,
      hangup: true,
      result: [],
    });
    void next; // suppress unused-param warning; do not propagate error
  }
}
