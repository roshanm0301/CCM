// =============================================================================
// CCM API — Health Routes
//
// GET /health/live   — liveness probe (is the process alive?)
// GET /health/ready  — readiness probe (are all dependencies reachable?)
//
// These endpoints must:
// - respond in <= 200ms under normal conditions (non-functional-requirements.md)
// - never require authentication (they must work before auth is established)
// - return 200 for healthy, 503 for unhealthy
// =============================================================================

import { Router } from 'express';
import type { Request, Response } from 'express';
import { checkPostgresHealth } from '../../shared/database/postgres';
import { checkMongoHealth } from '../../shared/database/mongo';
import { logger } from '../../shared/logging/logger';

export const healthRouter = Router();

// ---------------------------------------------------------------------------
// GET /health/live
// Simple liveness check — if this endpoint responds, the process is alive.
// ---------------------------------------------------------------------------
healthRouter.get('/live', (_req: Request, res: Response): void => {
  res.status(200).json({
    success: true,
    data: {
      status: 'ok',
      timestamp: new Date().toISOString(),
    },
  });
});

// ---------------------------------------------------------------------------
// GET /health/ready
// Readiness check — verifies DB connectivity before accepting traffic.
// Returns 503 if any required dependency is unhealthy.
// ---------------------------------------------------------------------------
healthRouter.get('/ready', async (_req: Request, res: Response): Promise<void> => {
  const startedAt = Date.now();

  const [postgresStatus, mongoStatus] = await Promise.all([
    checkPostgresHealth(),
    checkMongoHealth(),
  ]);

  const allHealthy = postgresStatus === 'ok' && mongoStatus === 'ok';
  const httpStatus = allHealthy ? 200 : 503;
  const overallStatus = allHealthy ? 'ok' : 'degraded';

  const durationMs = Date.now() - startedAt;

  if (!allHealthy) {
    logger.warn('Readiness check failed', {
      module: 'health',
      postgres: postgresStatus,
      mongo: mongoStatus,
      durationMs,
    });
  }

  res.status(httpStatus).json({
    success: allHealthy,
    data: {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      durationMs,
      checks: {
        postgres: postgresStatus,
        mongo: mongoStatus,
      },
    },
  });
});
