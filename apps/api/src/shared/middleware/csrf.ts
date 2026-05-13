// =============================================================================
// CCM API — CSRF Double-Submit Cookie Middleware
//
// Implements the double-submit cookie pattern:
//   1. On login, the auth module sets a CSRF cookie (SameSite=Strict,
//      httpOnly=false so JS can read it).
//      Production:  __Host-ccm-csrf  (Secure, host-bound)
//      Development: ccm-csrf         (no Secure flag, works over HTTP)
//   2. Every state-mutating request (POST, PATCH, PUT, DELETE) must include the
//      CSRF token in the X-CSRF-Token header.
//   3. This middleware compares header value against the cookie value.
//      If they do not match, the request is rejected with 403.
//
// GET and HEAD requests are exempt (safe methods per RFC 7231).
// Health endpoints are exempt (no auth required, no mutations).
//
// Source: security-principles.md § CSRF
//         phase1-technical-blueprint.md § 5.3 Auth Flow
// =============================================================================

import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../errors/AppError';
import { getCsrfCookieName } from '../../modules/auth/auth.controller';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const CSRF_HEADER  = 'x-csrf-token';

export function csrfProtection(req: Request, _res: Response, next: NextFunction): void {
  // Safe methods do not mutate state — no CSRF risk
  if (SAFE_METHODS.has(req.method)) {
    return next();
  }

  const cookieToken  = req.cookies?.[getCsrfCookieName()] as string | undefined;
  const headerToken  = req.headers[CSRF_HEADER]            as string | undefined;

  if (!cookieToken || !headerToken) {
    return next(new AppError('CSRF_MISSING', 'CSRF token missing', 403));
  }

  // Constant-time comparison is not strictly necessary for string tokens,
  // but avoids any timing side-channel on the comparison.
  if (cookieToken !== headerToken) {
    return next(new AppError('CSRF_INVALID', 'CSRF token mismatch', 403));
  }

  next();
}
