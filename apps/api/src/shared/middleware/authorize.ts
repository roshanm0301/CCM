// =============================================================================
// CCM API — RBAC Authorization Middleware (stub)
//
// Checks that req.user (set by authenticate middleware) holds one of the
// required roles. Must always follow the authenticate middleware in the chain.
// Backend Engineer will expand with permission-level checks if required.
// =============================================================================

import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../errors/AppError';
import { logger } from '../logging/logger';

/**
 * Middleware factory — returns a middleware that checks whether the
 * authenticated user holds at least one of the specified roles.
 *
 * Usage:
 *   router.get('/resource', authenticate, authorize('agent', 'supervisor'), handler);
 */
export function authorize(...requiredRoles: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      // authenticate middleware should have run first
      return next(AppError.unauthorized('No authenticated user on request'));
    }

    const hasRole = requiredRoles.some((role) => req.user!.roles.includes(role));

    if (!hasRole) {
      logger.warn('Authorization denied', {
        module: 'authorize',
        userId: req.user.userId,
        requiredRoles,
        userRoles: req.user.roles,
        path: req.path,
        correlationId: req.correlationId,
      });
      return next(AppError.forbidden('Insufficient role for this resource'));
    }

    next();
  };
}
