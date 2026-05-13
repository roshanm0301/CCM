// =============================================================================
// CCM API — Path-Parameter Validators
//
// Provides reusable Express middleware factories for validating named route
// parameters before they reach the service or database layer.  Malformed
// parameters produce structured 400 AppError responses rather than unhandled
// 500s surfaced from the database.
//
// Three validators are exported:
//
//   validateUuidParam(paramName)
//     Enforces UUID v4 format.  Use on internal resource IDs (:id) that are
//     PostgreSQL-generated UUIDs (e.g. interaction IDs).
//
//   validateObjectIdParam(paramName)
//     Enforces MongoDB ObjectId format (24-char hex string).  Use on resource
//     IDs (:id, :categoryId) that are MongoDB-generated ObjectIds.
//
//   validateNonEmptyParam(paramName, maxLength?)
//     Enforces that the parameter is a non-empty, printable string within an
//     optional maximum length.  Use on external reference codes (:ref) such as
//     customer CRM refs, vehicle VINs, and dealer codes that are NOT UUIDs.
//
// Usage:
//   router.get('/:id',  validateUuidParam('id'),       myController);
//   router.get('/:id',  validateObjectIdParam('id'),   myController);
//   router.get('/:ref', validateNonEmptyParam('ref'),   myController);
// =============================================================================

import { z } from 'zod';
import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../errors/AppError';

// Strict 24-char lowercase hex — matches exactly what MongoDB generates.
// Types.ObjectId.isValid() accepts 12-char binary strings too, which is
// broader than we want for route-parameter validation.
const OBJECT_ID_RE = /^[a-f\d]{24}$/i;

export const uuidSchema = z.string().uuid('Invalid ID format');

/**
 * Returns a middleware that validates `req.params[paramName]` as a UUID.
 * Calls next(AppError) with status 400 when validation fails.
 */
export function validateUuidParam(paramName: string) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = uuidSchema.safeParse(req.params[paramName]);
    if (!result.success) {
      return next(
        new AppError(
          'VALIDATION_ERROR',
          `Invalid ${paramName}: must be a valid UUID`,
          400,
        ),
      );
    }
    next();
  };
}

/**
 * Returns a middleware that validates `req.params[paramName]` as a MongoDB ObjectId.
 * Calls next(AppError) with status 400 when validation fails.
 */
export function validateObjectIdParam(paramName: string) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const value = req.params[paramName];
    if (!value || typeof value !== 'string' || !OBJECT_ID_RE.test(value)) {
      return next(
        new AppError(
          'VALIDATION_ERROR',
          `Invalid ${paramName}: must be a valid resource ID`,
          400,
        ),
      );
    }
    next();
  };
}

/**
 * Returns a middleware that validates `req.params[paramName]` as a non-empty
 * string with an optional maximum length (default 200 characters).
 * Use for external reference codes that are not UUIDs.
 * Calls next(AppError) with status 400 when validation fails.
 */
export function validateNonEmptyParam(paramName: string, maxLength = 200) {
  const schema = z
    .string()
    .min(1, `${paramName} must not be empty`)
    .max(maxLength, `${paramName} must be ${maxLength} characters or fewer`)
    .regex(/^[\x20-\x7E]+$/, `${paramName} contains invalid characters`);

  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.params[paramName]);
    if (!result.success) {
      return next(
        new AppError(
          'VALIDATION_ERROR',
          `Invalid ${paramName}: ${result.error.issues[0]?.message ?? 'invalid value'}`,
          400,
        ),
      );
    }
    next();
  };
}
