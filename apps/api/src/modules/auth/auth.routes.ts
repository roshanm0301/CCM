// =============================================================================
// CCM API — Auth Routes
//
// POST /api/v1/auth/login   — no auth, no CSRF (login issues the CSRF token)
// POST /api/v1/auth/logout  — requires CSRF + authenticate (explicit per-route)
// GET  /api/v1/auth/me      — requires authenticate; read-only (no CSRF needed)
// GET  /api/v1/auth/csrf    — requires authenticate; issues a fresh CSRF token
//                             after page refresh. No CSRF required on this
//                             request (it is exempt because authRouter is
//                             mounted before global csrfProtection in app.ts).
//
// NOTE: This router is mounted BEFORE the global csrfProtection middleware in
// app.ts so that the login and csrf endpoints are exempt from CSRF enforcement.
// Logout is protected against CSRF logout attacks by applying csrfProtection
// directly on the route rather than relying on the global middleware position.
// Source: phase1-technical-blueprint.md §5.1–5.3; security-principles.md § CSRF
// =============================================================================

import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { loginController, logoutController, meController, csrfController, setSessionModeController } from './auth.controller';
import { authenticate } from '../../shared/middleware/authenticate';
import { csrfProtection } from '../../shared/middleware/csrf';

export const authRouter = Router();

// Rate limiter scoped to the login route only.
// 10 attempts per IP per 15-minute window; successful requests are not counted.
// Source: security-principles.md — brute-force protection
const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // max 10 attempts per IP per window
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMITED',
      message: 'Too many login attempts. Please try again in 15 minutes.',
    },
  },
  skipSuccessfulRequests: true,
});

// No auth, no CSRF — this endpoint ISSUES the CSRF token
authRouter.post('/login', loginRateLimiter, loginController);

// Explicitly apply CSRF protection here because this router is mounted before
// the global csrfProtection middleware and logout would otherwise be unprotected.
authRouter.post('/logout', csrfProtection, authenticate, logoutController);

// Read-only — auth required, CSRF not needed (GET is a safe method)
authRouter.get('/me', authenticate, meController);

// Issues a fresh CSRF token after page refresh. Auth required; CSRF not
// required (this is how the client re-acquires the token it lost on refresh).
authRouter.get('/csrf', authenticate, csrfController);

// Phase 1.5: Store agent's chosen session mode (manual | cti).
// authenticate + csrfProtection applied explicitly because authRouter is mounted
// before the global csrfProtection middleware. The CSRF cookie is issued at
// login time so it is available by the time the mode dialog fires.
// Source: Fix HIGH-1 — closes CSRF gap on this state-changing endpoint.
authRouter.patch('/session-mode', authenticate, csrfProtection, setSessionModeController);
