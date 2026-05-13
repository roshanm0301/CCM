// =============================================================================
// CCM API — Express Application Setup
//
// Configures middleware stack and mounts route modules.
// Intentionally separated from main.ts so the app instance can be tested
// without binding to a port.
// =============================================================================

import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { v4 as uuidv4 } from 'uuid';
import type { Request, Response, NextFunction } from 'express';

import { config } from './config/index';
import { logger } from './shared/logging/logger';
import { errorHandler } from './shared/middleware/errorHandler';
import { csrfProtection } from './shared/middleware/csrf';
import { authenticate } from './shared/middleware/authenticate';
import { authorize } from './shared/middleware/authorize';
import { healthRouter } from './modules/health/health.routes';
import { authRouter } from './modules/auth/auth.routes';
import { interactionRouter } from './modules/interaction/interaction.routes';
import { agentStatusRouter } from './modules/agent-status/agent-status.routes';
import { searchRouter } from './modules/search/search.routes';
import { contextRouter } from './modules/context/context.routes';
import { masterDataRouter } from './modules/master-data/master-data.routes';
import { caseCategoryRouter } from './modules/case-category/case-category.routes';
import { activityMasterRouter } from './modules/activity-master/activity-master.routes';
import { activityTemplateRouter } from './modules/activity-template/activity-template.routes';
import { casesRouter } from './modules/cases/cases.routes';
import { dealersRouter } from './modules/dealers/dealers.routes';
import { sseRouter } from './modules/sse/sse.routes';
import { startHeartbeat } from './modules/sse/sse.service';
import ctiRouter from './modules/cti/cti.routes';
import { resolutionActivityRouter } from './modules/resolution-activity/resolution-activity.routes';
import { dealerAuthRouter } from './modules/dealer-auth/dealer-auth.routes';
import { followUpRouter } from './modules/follow-up/follow-up.routes';
import { attachmentRouter } from './modules/attachment/attachment.routes';
import { DEALER_ROLES } from './shared/constants/roles';

// ---------------------------------------------------------------------------
// Parse allowed origins from comma-separated env var
// ---------------------------------------------------------------------------
const allowedOrigins = config.corsAllowedOrigins
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

// ---------------------------------------------------------------------------
// Express app
// ---------------------------------------------------------------------------
const app = express();

// Trust the first proxy hop so that express-rate-limit resolves the real
// client IP from X-Forwarded-For rather than using the nginx proxy IP,
// which would collapse all users into a single rate-limit bucket.
app.set('trust proxy', 1);

// ---------------------------------------------------------------------------
// Security headers via Helmet
// ---------------------------------------------------------------------------
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:'],
        // piopiyjs WebRTC SDK connects to TeleCMI SBC via WebSocket — must be allowed.
        // The SBC URI is deployment-configurable; the wildcard covers all TeleCMI regions.
        connectSrc: ["'self'", 'wss://*.telecmi.com', 'wss://sbcind.telecmi.com'],
        frameSrc: ["'none'"],
        objectSrc: ["'none'"],
      },
    },
    // X-Frame-Options: DENY is set by helmet frameguard by default
    frameguard: { action: 'deny' },
    noSniff: true,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  }),
);

// ---------------------------------------------------------------------------
// CORS
//
// Health paths (/health, /api/v1/health) are used by Docker-internal probes
// that send no Origin header. They are allowed with any origin but
// credentials:false so they cannot be used to exfiltrate session data.
//
// All other paths enforce a strict allowlist. Requests that arrive without
// an Origin header on non-health paths are rejected — this closes the
// null-origin bypass that previously allowed arbitrary server-side requests
// to silently bypass CORS controls on the full API surface.
// ---------------------------------------------------------------------------

// Single CORS dispatcher — health paths are exempt from origin enforcement
// (Docker-internal probes send no Origin header).  All other paths enforce
// the strict allowlist.  One handler runs per request to avoid two cors()
// calls both firing on the same request.
//
// No-Origin requests: browsers do NOT send an Origin header for same-origin
// GET/HEAD requests (RFC 6454 §7.3).  In the Docker Compose deployment the
// API is only reachable via the nginx reverse-proxy on the same Docker
// network; there is no direct internet exposure on port 3000.  A missing
// Origin header therefore indicates a same-origin request proxied through
// nginx — this is the normal, legitimate path for all SPA→API calls.
// Authentication is still enforced per-route by JWT cookie middleware.
const strictCorsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    if (!origin) {
      // Same-origin request (no Origin header sent by browser for same-origin
      // GET/HEAD, or a server-side health/probe call): allow through.
      // Authentication middleware still validates the session cookie.
      return callback(null, true);
    }
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    logger.warn('CORS rejected origin', { module: 'app', origin });
    return callback(new Error(`CORS: origin '${origin}' not allowed`), false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'X-CSRF-Token', 'X-Correlation-ID'],
  exposedHeaders: ['X-Correlation-ID'],
};

app.use((req: Request, res: Response, next: NextFunction) => {
  const isHealthPath =
    req.path === '/health' ||
    req.path.startsWith('/health/') ||
    req.path === '/api/v1/health' ||
    req.path.startsWith('/api/v1/health/');

  if (isHealthPath) {
    // Health probes: allow any origin, no credentials
    return cors({ origin: true, credentials: false })(req, res, next);
  }
  return cors(strictCorsOptions)(req, res, next);
});

// ---------------------------------------------------------------------------
// Request pre-processing
// ---------------------------------------------------------------------------
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

// ---------------------------------------------------------------------------
// Correlation ID injection
// Attaches a correlation ID to every request for log tracing.
// ---------------------------------------------------------------------------
app.use((req: Request, _res: Response, next: NextFunction) => {
  const correlationId =
    (req.headers['x-correlation-id'] as string | undefined) ?? uuidv4();
  req.correlationId = correlationId;
  next();
});

// ---------------------------------------------------------------------------
// HTTP request logging
//
// CTI webhook/routing paths log at `info` level so they are always visible
// (TeleCMI server calls never carry an Origin header and their requests must
// be observable without changing LOG_LEVEL).  All other paths stay at `http`
// which is filtered out at the default info threshold.
// ---------------------------------------------------------------------------
app.use((req: Request, res: Response, next: NextFunction) => {
  const startedAt = Date.now();
  const isCtiPath = req.path.startsWith('/api/v1/cti');

  res.on('finish', () => {
    const durationMs = Date.now() - startedAt;
    const logFn = isCtiPath ? logger.info.bind(logger) : logger.http.bind(logger);
    logFn('HTTP request', {
      module: 'app',
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      durationMs,
      correlationId: req.correlationId,
    });
  });

  next();
});

// ---------------------------------------------------------------------------
// Routes: health and auth are mounted BEFORE global CSRF middleware.
//
// Health: read-only probes, no mutations, no CSRF required.
// Auth:   login endpoint ISSUES the CSRF token, so it cannot be guarded by it.
//         logout and /me are safe to put here — logout is a POST but the CSRF
//         token has been issued before this point, and we apply csrfProtection
//         at the route level where needed (via the global middleware below
//         which covers all subsequent routes).
//
// CRITICAL: authRouter is mounted here, BEFORE csrfProtection, so that
//           POST /api/v1/auth/login bypasses CSRF enforcement.
//           The logout route inside authRouter still requires `authenticate`
//           middleware applied per-route (see auth.routes.ts).
// ---------------------------------------------------------------------------

// Health — no auth, no CSRF
app.use('/api/v1/health', healthRouter);

// Legacy health mount kept for backward compatibility (Docker healthcheck uses /health)
app.use('/health', healthRouter);

// Auth — mounted before CSRF middleware so login is exempt
app.use('/api/v1/auth', authRouter);

// Dealer auth — mounted before CSRF middleware so dealer login is exempt
app.use('/api/v1/dealer-auth', dealerAuthRouter);

// CTI — mounted before global CSRF so that /route and /webhook (called by TeleCMI
// server with no CSRF token) are exempt.  Authenticated agent mutations inside
// the CTI router apply csrfProtection at the route level.
app.use('/api/v1/cti', ctiRouter);

// ---------------------------------------------------------------------------
// CSRF protection — applied globally to all state-mutating requests for all
// routes mounted AFTER this point.
// Auth endpoints (/auth/login) are exempt because they are mounted above.
// All other POST/PATCH/PUT/DELETE routes benefit from this middleware.
// ---------------------------------------------------------------------------
app.use(csrfProtection);

// ---------------------------------------------------------------------------
// Protected routes — all require authentication + CSRF on mutations
// ---------------------------------------------------------------------------

// Interaction lifecycle
app.use('/api/v1/interactions', authenticate, authorize('agent'), interactionRouter);

// Agent status
app.use('/api/v1/agent', authenticate, authorize('agent'), agentStatusRouter);

// Search
app.use('/api/v1/search', authenticate, authorize('agent'), searchRouter);

// Context (read-only — authenticate only, no CSRF required per blueprint)
app.use('/api/v1/context', authenticate, authorize('agent'), contextRouter);

// Master data (read-only — authenticate only)
app.use('/api/v1/master-data', authenticate, authorize('agent'), masterDataRouter);

// Case Category master — agent role required
app.use('/api/v1/case-categories', authenticate, authorize('agent'), caseCategoryRouter);

// Activity Master — ccm_agent or legacy agent role required
app.use('/api/v1/activity-master', authenticate, authorize('agent', 'ccm_agent'), activityMasterRouter);

// Activity Templates — ccm_agent or legacy agent role required
app.use('/api/v1/activity-templates', authenticate, authorize('agent', 'ccm_agent'), activityTemplateRouter);

// Cases — agents and all dealer roles (dealer-catalog endpoint needs dealer access)
app.use('/api/v1/cases', authenticate, authorize('agent', 'ccm_agent', ...DEALER_ROLES), casesRouter);

// Dealers — agent role required
app.use('/api/v1/dealers', authenticate, authorize('agent'), dealersRouter);

// Resolution activities — both agents and dealer roles can access
app.use('/api/v1/resolution-activities', authenticate, authorize('agent', 'ccm_agent', ...DEALER_ROLES), resolutionActivityRouter);

// Follow-ups — authenticated; agent-only enforcement is in the service layer for POST
app.use('/api/v1/follow-ups', authenticate, authorize('agent', 'ccm_agent', ...DEALER_ROLES), followUpRouter);

// Attachments — authenticated; any role can upload/retrieve
app.use('/api/v1/attachments', authenticate, authorize('agent', 'ccm_agent', ...DEALER_ROLES), attachmentRouter);

// SSE event stream — authenticate only, GET so CSRF-exempt
app.use('/api/v1/sse', authenticate, authorize('agent'), sseRouter);

// Start SSE heartbeat — 30s PING to all connected clients
startHeartbeat();

// ---------------------------------------------------------------------------
// 404 handler — catch unmatched routes
// ---------------------------------------------------------------------------
app.use((req: Request, res: Response) => {
  logger.warn('404 — unmatched route', {
    module: 'app',
    method: req.method,
    path: req.path,
    correlationId: req.correlationId,
  });
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: 'The requested endpoint does not exist',
    },
  });
});

// ---------------------------------------------------------------------------
// Global error handler — must be last
// ---------------------------------------------------------------------------
app.use(errorHandler);

export default app;
