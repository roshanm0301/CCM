// =============================================================================
// CCM API — Auth Controller
//
// Thin controller: validate → call service → shape response.
// Cookie management lives here (not in the service).
// Source: phase1-technical-blueprint.md §5.1–5.3
// =============================================================================

import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { loginSchema } from './auth.validator';
import { loginService, getMeService, getCsrfService, logoutService, setSessionModeService } from './auth.service';
import { AppError } from '../../shared/errors/AppError';
import { logger } from '../../shared/logging/logger';
import { config } from '../../config';

const SESSION_COOKIE = 'ccm_session';
const isSecureCookie = config.cookieSecure === 'true';

/**
 * Return the CSRF cookie name appropriate for the current environment.
 *
 * The `__Host-` prefix requires Secure + no Domain + path=/ and is enforced
 * by browsers only over HTTPS. In HTTP environments (localhost,
 * Docker Compose without TLS, LAN access via IP) browsers silently reject
 * `__Host-` cookies, so mutations never carry the token and every CSRF check
 * returns 403.
 *
 * COOKIE_SECURE=true  : __Host-ccm-csrf  (secure, host-bound)
 * COOKIE_SECURE=false  : ccm-csrf         (no Secure flag required, works over HTTP)
 */
export function getCsrfCookieName(): string {
  return isSecureCookie ? '__Host-ccm-csrf' : 'ccm-csrf';
}

// ---------------------------------------------------------------------------
// POST /api/v1/auth/login
// ---------------------------------------------------------------------------
export async function loginController(
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

    const result = await loginService(username, password, correlationId);

    // Set httpOnly session cookie
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
    // The CSRF token is set as an httpOnly=false cookie (ccm-csrf / __Host-ccm-csrf)
    // so the client can read it from document.cookie or call GET /api/v1/auth/csrf.
    // Returning it in the body creates a dual-exfiltration path under XSS.
    res.status(200).json({
      success: true,
      data: {
        user: result.user,
      },
      correlationId: req.correlationId,
    });
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// POST /api/v1/auth/logout
// ---------------------------------------------------------------------------
export async function logoutController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    // Phase 1.5: Run server-side logout cleanup (clear session_mode, audit) BEFORE
    // clearing cookies so we have the user identity available.
    if (req.user?.userId) {
      await logoutService(req.user.userId, req.correlationId ?? '');
    }

    // Clear both cookies regardless of whether session is valid
    res.clearCookie(SESSION_COOKIE, { path: '/' });
    res.clearCookie(getCsrfCookieName(), { path: '/' });

    logger.info('Agent logout', {
      module: 'auth.controller',
      correlationId: req.correlationId,
      userId: req.user?.userId,
    });

    res.status(200).json({
      success: true,
      data: { message: 'Signed out successfully.' },
      correlationId: req.correlationId,
    });
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// GET /api/v1/auth/csrf
// ---------------------------------------------------------------------------
/**
 * Issue a fresh CSRF token for a session that is already authenticated.
 *
 * This endpoint is intentionally positioned inside authRouter, which is
 * mounted BEFORE the global csrfProtection middleware in app.ts. It therefore
 * does NOT require a CSRF token on the incoming request — that is correct
 * because the whole purpose of this endpoint is to give the client a token
 * to use on subsequent mutating requests after a page refresh.
 *
 * authenticate middleware is applied on this route so only holders of a valid
 * session cookie can obtain a token.
 */
export async function csrfController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) {
      throw AppError.unauthorized('No authenticated user');
    }

    const result = getCsrfService();

    // Re-set the CSRF cookie using the same flags as login so the client-side
    // cookie store is refreshed even if the browser discarded the previous one.
    res.cookie(getCsrfCookieName(), result.csrfToken, {
      httpOnly: false,
      secure: isSecureCookie,
      sameSite: 'strict',
      path: '/',
    });

    logger.info('CSRF token refreshed', {
      module: 'auth.controller',
      correlationId: req.correlationId,
      userId: req.user.userId,
    });

    res.status(200).json({
      success: true,
      data: { csrfToken: result.csrfToken },
      correlationId: req.correlationId,
    });
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// PATCH /api/v1/auth/session-mode  (Phase 1.5)
// ---------------------------------------------------------------------------

const sessionModeSchema = z.object({
  sessionMode: z.enum(['manual', 'cti'], {
    errorMap: () => ({ message: 'sessionMode must be "manual" or "cti"' }),
  }),
});

export async function setSessionModeController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) {
      throw AppError.unauthorized('No authenticated user');
    }

    const parsed = sessionModeSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError('VALIDATION_ERROR', 'Request validation failed', 422, parsed.error.issues);
    }

    const result = await setSessionModeService(
      req.user.userId,
      parsed.data.sessionMode,
      req.correlationId ?? '',
    );

    res.status(200).json({
      success: true,
      data: result,
      correlationId: req.correlationId,
    });
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// GET /api/v1/auth/me
// ---------------------------------------------------------------------------
export async function meController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) {
      throw AppError.unauthorized('No authenticated user');
    }

    const result = await getMeService(req.user);

    res.status(200).json({
      success: true,
      data: result,
      correlationId: req.correlationId,
    });
  } catch (err) {
    next(err);
  }
}
