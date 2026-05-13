// =============================================================================
// CCM API — CTI Outbound Call Controller
//
// POST /api/v1/cti/calls
//
// Initiates an outbound click2call for the authenticated agent.
// Request body: { destination: string }
// Response 201: { success: true, data: { requestId, destination } }
// =============================================================================

import type { Request, Response, NextFunction } from 'express';
import { initiateOutboundCallService } from './cti.outbound.service';
import { logger } from '../../shared/logging/logger';

export async function initiateOutboundCallController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } });
      return;
    }

    const { destination } = req.body as { destination?: unknown };
    if (!destination || typeof destination !== 'string' || destination.trim().length === 0) {
      res.status(422).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'destination is required and must be a non-empty string',
        },
      });
      return;
    }

    const result = await initiateOutboundCallService(
      userId,
      { destination: destination.trim() },
      req.correlationId ?? '',
    );

    res.status(201).json({ success: true, data: result });
  } catch (err: unknown) {
    const appErr = err as { statusCode?: number; code?: string; message?: string };
    if (appErr.statusCode && appErr.code) {
      logger.warn('Outbound call controller error', {
        module: 'cti.outbound.controller',
        code: appErr.code,
        message: appErr.message,
        correlationId: req.correlationId,
      });
      res.status(appErr.statusCode).json({
        success: false,
        error: { code: appErr.code, message: appErr.message ?? 'Error initiating outbound call' },
      });
      return;
    }
    next(err);
  }
}
