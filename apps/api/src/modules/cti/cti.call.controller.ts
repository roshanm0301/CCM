// =============================================================================
// CCM API — CTI Call Controller
//
// Controllers for inbound call interaction creation, caller lookup,
// and SDK config retrieval.
// =============================================================================

import type { Request, Response, NextFunction } from 'express';
import { createInteractionFromCallService, callerLookupService, getSdkConfigService, getCallerContextService } from './cti.call.service';
import { reprovisionTeleCmiAgent } from './cti.agent.service';
import type { CreateInteractionFromCallInput } from './cti.types';

// POST /cti/interactions
export async function createInteractionFromCallController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.user!.userId;
    const correlationId = req.correlationId ?? '';
    const input = req.body as CreateInteractionFromCallInput;

    const result = await createInteractionFromCallService(userId, input, correlationId);

    res.status(201).json({
      success: true,
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

// GET /cti/caller-lookup?number=<phone>
export async function callerLookupController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const number = req.query['number'] as string | undefined;
    if (!number) {
      res.status(422).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'number query parameter is required' },
      });
      return;
    }

    const result = await callerLookupService(number);

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

// POST /cti/admin/users/:userId/reprovision
export async function reprovisionTeleCmiAgentController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { userId } = req.params;
    await reprovisionTeleCmiAgent(userId as string);
    res.status(200).json({ success: true, message: 'TeleCMI agent re-provisioned' });
  } catch (err) {
    next(err);
  }
}

// GET /cti/caller-context?number=<phone>
export async function getCallerContextController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const number = req.query['number'] as string | undefined;
    if (!number) {
      res.status(422).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'number query parameter is required' },
      });
      return;
    }

    const results = await getCallerContextService(number);

    res.status(200).json({
      success: true,
      data: results,
    });
  } catch (err) {
    next(err);
  }
}

// GET /cti/sdk-config
export async function getSdkConfigController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.user!.userId;
    const result = await getSdkConfigService(userId);

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (err) {
    next(err);
  }
}
