// =============================================================================
// CCM API — CTI Webhook Controller
//
// Accepts TeleCMI webhook events, acknowledges immediately, processes async.
// =============================================================================

import type { Request, Response, NextFunction } from 'express';
import { handleWebhookEvent } from './cti.webhook.service';
import type { TeleCmiWebhookPayload } from './cti.types';
import { logger } from '../../shared/logging/logger';

export async function ctiWebhookController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const payload = req.body as TeleCmiWebhookPayload;

    logger.info('TeleCMI webhook received', {
      module: 'cti.webhook.controller',
      type: payload.type,
      status: payload.status,
      direction: payload.direction,
      cmiuuid: payload.cmiuuid ?? payload.conversation_uuid,
      from: payload.from,
      to: payload.to,
    });

    // Always return 200 immediately to TeleCMI, process async
    res.status(200).json({ received: true });
    await handleWebhookEvent(payload, req.correlationId).catch((err) => {
      logger.error('Error processing TeleCMI webhook event', { err, payload });
    });
  } catch (err) {
    next(err);
  }
}
