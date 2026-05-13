// =============================================================================
// CCM API — Global Express Error Handler
//
// Must be the last middleware registered in app.ts.
// Produces a standardised error envelope (ApiErrorResponse from @ccm/types).
// Stack traces are never sent to clients in production.
// =============================================================================

import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../errors/AppError';
import { logger } from '../logging/logger';
import { config } from '../../config';

interface ErrorEnvelope {
  success: false;
  error: {
    code: string;
    message: string;
    correlationId?: string;
    details?: unknown;
  };
}

const isProduction = config.nodeEnv === 'production';

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  // next is required by Express to recognise this as a 4-arg error handler
  _next: NextFunction,
): void {
  const correlationId = (req.headers['x-correlation-id'] as string | undefined) ?? undefined;

  // --- ZodError (input validation failure) ---
  if (err instanceof ZodError) {
    const body: ErrorEnvelope = {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        correlationId,
        details: isProduction
          ? undefined
          : err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      },
    };
    logger.warn('Validation error', {
      module: 'errorHandler',
      correlationId,
      path: req.path,
      issues: err.issues.length,
    });
    res.status(422).json(body);
    return;
  }

  // --- AppError (intentional application error) ---
  if (err instanceof AppError) {
    const body: ErrorEnvelope = {
      success: false,
      error: {
        code: err.code,
        message: err.message,
        correlationId,
        details: (err.code === 'INTERACTION_ALREADY_ACTIVE' || !isProduction)
          ? err.details
          : undefined,
      },
    };

    if (err.statusCode >= 500) {
      logger.error('Application error', {
        module: 'errorHandler',
        correlationId,
        code: err.code,
        message: err.message,
        stack: isProduction ? undefined : err.stack,
      });
    } else {
      logger.warn('Client error', {
        module: 'errorHandler',
        correlationId,
        code: err.code,
        message: err.message,
      });
    }

    res.status(err.statusCode).json(body);
    return;
  }

  // --- Unhandled / unexpected error ---
  logger.error('Unhandled error', {
    module: 'errorHandler',
    correlationId,
    message: err instanceof Error ? err.message : String(err),
    stack: isProduction ? undefined : err instanceof Error ? err.stack : undefined,
  });

  const body: ErrorEnvelope = {
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
      correlationId,
    },
  };

  res.status(500).json(body);
}
