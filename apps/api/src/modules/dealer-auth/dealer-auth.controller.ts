// =============================================================================
// CCM API — Dealer Auth Controller
//
// Thin controller: validate → call service → shape response.
// Cookie management lives here (not in the service).
// Mirrors the pattern of apps/api/src/modules/auth/auth.controller.ts but
// serves the dealer workspace login endpoint.
//
// Source: CCM_Phase6_Resolution_Activities.md — Dealer Catalog View / dealer login
// =============================================================================

import type { Request, Response, NextFunction } from 'express';
import { loginSchema } from '../auth/auth.validator';
import { dealerLoginService } from './dealer-auth.service';
import { getCsrfCookieName } from '../auth/auth.controller';
import { AppError } from '../../shared/errors/AppError';
import { config } from '../../config';

const SESSION_COOKIE = 'ccm_session';
const isSecureCookie = config.cookieSecure === 'true';

// ---------------------------------------------------------------------------
// POST /api/v1/dealer-auth/login
// ---------------------------------------------------------------------------
export async function dealerLoginController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(
        'VALIDATION_ERROR',
        'Request validation failed',
        422,
        parsed.error.issues,
      );
    }

    const correlationId = req.correlationId ?? '';
    const { username, password } = parsed.data;

    const result = await dealerLoginService(username, password, correlationId);

    // Set httpOnly session cookie (same cookie name as agent login — single
    // session model; the JWT roles distinguish workspace access on each request)
    res.cookie(SESSION_COOKIE, result.jwtToken, {
      httpOnly: true,
      secure: isSecureCookie,
      sameSite: 'strict',
      path: '/',
    });

    // Set CSRF token cookie — httpOnly=false so JS can read it.
    // When COOKIE_SECURE=true the __Host- prefix enforces Secure + host-binding.
    // When COOKIE_SECURE=false the plain name is used so the cookie is accepted over HTTP.
    res.cookie(getCsrfCookieName(), result.csrfToken, {
      httpOnly: false,
      secure: isSecureCookie,
      sameSite: 'strict',
      path: '/',
    });

    // NOTE: csrfToken is intentionally NOT returned in the response body.
    // The CSRF token is set as an httpOnly=false cookie so the client can read
    // it from document.cookie. Returning it in the body creates a dual-exfiltration
    // path under XSS.
    res.status(200).json({
      success: true,
      data: {
        user: {
          id: result.user.id,
          username: result.user.username,
          displayName: result.user.displayName,
          roles: result.user.roles,
          dealerRef: result.user.dealerRef,
        },
      },
      correlationId: req.correlationId,
    });
  } catch (err) {
    next(err);
  }
}
