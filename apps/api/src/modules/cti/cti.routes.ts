// =============================================================================
// CCM API — CTI Routes
//
// /route and /webhook are no-auth (called by TeleCMI server).
// /interactions, /caller-lookup, /sdk-config require agent authentication.
// =============================================================================

import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import type { Request } from 'express';
import { ctiRoutingController } from './cti.routing.controller';
import { ctiWebhookController } from './cti.webhook.controller';
import { createInteractionFromCallController, callerLookupController, getSdkConfigController, getCallerContextController, reprovisionTeleCmiAgentController } from './cti.call.controller';
import { initiateOutboundCallController } from './cti.outbound.controller';
import { getRecordingStatusController, streamRecordingController } from './cti.recording.controller';
import { authenticate } from '../../shared/middleware/authenticate';
import { authorize } from '../../shared/middleware/authorize';
import { csrfProtection } from '../../shared/middleware/csrf';
import { verifyTeleCmiWebhook } from './cti.hmac.middleware';

const router = Router();

// CCM-SEC-CTI-02: Per-agent rate limit on outbound call initiation.
// Max 3 click2call requests per agent per 30-second window.
// keyGenerator uses userId from the authenticated session (set by authenticate middleware).
// This prevents billing abuse from looping clients or compromised session tokens.
// Source: security-principles.md — abuse prevention; HIGH-3 from gate review
const outboundCallRateLimiter = rateLimit({
  windowMs: 30 * 1000, // 30-second window
  max: 3,              // max 3 outbound calls per agent per window
  standardHeaders: true,
  legacyHeaders: false,
  // Key by authenticated userId — NOT by IP (agents share office IPs)
  keyGenerator: (req: Request) => req.user?.userId ?? req.ip ?? 'unknown',
  message: {
    success: false,
    error: {
      code: 'RATE_LIMITED',
      message: 'Too many outbound call attempts. Please wait before dialling again.',
    },
  },
  skipSuccessfulRequests: false,
});

// No-auth routes (called by TeleCMI server)
router.post('/route', ctiRoutingController);
// Webhook: payload appId + optional custom value verification (see cti.hmac.middleware.ts)
router.post('/webhook', verifyTeleCmiWebhook, ctiWebhookController);

// Authenticated agent routes
router.post('/interactions', authenticate, authorize('agent'), csrfProtection, createInteractionFromCallController);
router.get('/caller-lookup', authenticate, authorize('agent'), callerLookupController);
// Pre-fetch full customer record by phone number before an interaction is created.
// No interactionId required — used by the frontend during inComingCall to pre-populate
// the search panel so the agent sees results the moment they answer.
router.get('/caller-context', authenticate, authorize('agent'), getCallerContextController);
router.get('/sdk-config', authenticate, authorize('agent'), getSdkConfigController);

// Recording playback — no CSRF (GET requests, no state mutation)
// CCM-SEC-CTI: authenticate + authorize ensures only authenticated agents can fetch recordings.
// Audio is proxied from TeleCMI — never stored in CCM.
router.get('/recording/:interactionId/status', authenticate, authorize('agent'), getRecordingStatusController);
router.get('/recording/:interactionId', authenticate, authorize('agent'), streamRecordingController);

// Outbound calling — agents initiate click2call from Idle Workspace
// Rate-limited per-agent (3 per 30s) to prevent billing abuse — CCM-SEC-CTI-02
router.post('/calls', authenticate, authorize('agent', 'ccm_agent'), csrfProtection, outboundCallRateLimiter, initiateOutboundCallController);

// Admin routes
router.post('/admin/users/:userId/reprovision', authenticate, authorize('admin'), csrfProtection, reprovisionTeleCmiAgentController);

export default router;
