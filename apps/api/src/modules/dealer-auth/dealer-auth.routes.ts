// =============================================================================
// CCM API — Dealer Auth Routes
//
// POST /api/v1/dealer-auth/login — no auth, no CSRF (login issues the CSRF token)
//
// NOTE: This router should be mounted BEFORE the global csrfProtection
// middleware in app.ts (same pattern as authRouter) so that the login endpoint
// is exempt from CSRF enforcement. The login endpoint ISSUES the CSRF token —
// it cannot require one on the incoming request.
//
// Source: CCM_Phase6_Resolution_Activities.md — Dealer Catalog View / dealer login
// =============================================================================

import { Router } from 'express';
import { dealerLoginController } from './dealer-auth.controller';

export const dealerAuthRouter = Router();

// No auth, no CSRF — this endpoint ISSUES the CSRF token
dealerAuthRouter.post('/login', dealerLoginController);
