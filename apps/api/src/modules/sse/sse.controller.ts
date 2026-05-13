// =============================================================================
// CCM — SSE Controller
//
// GET /api/v1/sse/events — open a persistent SSE connection for an agent.
// =============================================================================

import type { Request, Response } from 'express';
import { AppError } from '../../shared/errors/AppError';
import { registerSseClient, removeSseClient } from './sse.service';

export function sseEventsController(req: Request, res: Response): void {
  if (!req.user) {
    throw AppError.unauthorized('Authentication required');
  }

  const userId = req.user.userId;

  // SSE response headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // disable nginx buffering

  res.flushHeaders();

  // Initial connection confirmation
  res.write(`data: ${JSON.stringify({ type: 'CONNECTED', userId })}\n\n`);

  registerSseClient(userId, res);

  req.on('close', () => {
    removeSseClient(userId, res);
  });
}
