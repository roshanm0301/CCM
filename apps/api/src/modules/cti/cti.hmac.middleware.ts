// =============================================================================
// CCM API — TeleCMI Webhook Authentication Middleware
//
// TeleCMI does NOT send an HMAC-SHA256 signature header. Instead, it embeds
// the App ID in every webhook payload (`appid` for CDR events, `app_id` for
// live events). An optional shared "Custom value" string can be configured in
// the TeleCMI portal (Business Number → Settings → Webhooks → Custom value)
// and TeleCMI echoes it back as `"custom": "<value>"` in every payload.
//
// This middleware performs two checks:
//   1. payload.appid (or payload.app_id) must equal TELECMI_APP_ID.
//   2. If TELECMI_WEBHOOK_CUSTOM_VALUE is configured, payload.custom must match.
//
// Both comparisons use crypto.timingSafeEqual to prevent timing-oracle attacks.
//
// Security notes:
// - If TELECMI_APP_ID is not configured (empty/default), all webhooks are
//   rejected (fail-secure posture).
// - The App ID check alone is sufficient when no custom value is configured;
//   configuring a custom value adds a second independent layer.
// =============================================================================

import crypto from 'crypto';
import type { Request, Response, NextFunction } from 'express';
import { logger } from '../../shared/logging/logger';
import { getCtiConfig } from './cti.config';

/** Express middleware that authenticates TeleCMI webhook payloads. */
export function verifyTeleCmiWebhook(req: Request, res: Response, next: NextFunction): void {
  const config = getCtiConfig();

  // Fail-secure: if no App ID is configured, reject all webhooks.
  // '1111112' is the placeholder default in .env.example / docker-compose.yml.
  // In production this MUST be replaced with the real App ID.
  // In development (NODE_ENV=development) we warn but allow through so the
  // developer can test the webhook flow without changing env vars.
  // In production and test modes the placeholder is treated as unconfigured
  // (fail-secure) — this prevents a misconfigured deployment accepting all webhooks.
  if (!config.appId || config.appId === 1111112) {
    const isDevMode = process.env['NODE_ENV'] === 'development';
    if (isDevMode && config.appId === 1111112) {
      logger.warn('TeleCMI webhook: TELECMI_APP_ID is the placeholder default — allowing through in development mode only', {
        module: 'cti.webhook.auth',
        correlationId: req.correlationId,
      });
      // Allow through in dev only — do not return, fall through to payload checks
    } else {
      logger.error('TeleCMI webhook received but TELECMI_APP_ID is not configured — rejecting (fail-secure)', {
        module: 'cti.webhook.auth',
        correlationId: req.correlationId,
      });
      res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Webhook not configured' } });
      return;
    }
  }

  // req.body has already been parsed by express.json() upstream
  const payload = req.body as {
    appid?: number | string;
    app_id?: number | string;
    custom?: string;
  };

  // ── Step 1: App ID verification ──────────────────────────────────────────
  const payloadAppId = payload.appid ?? payload.app_id;
  if (payloadAppId == null) {
    logger.warn('TeleCMI webhook payload missing appid field — rejecting', {
      module: 'cti.webhook.auth',
      correlationId: req.correlationId,
    });
    res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Missing appid in payload' } });
    return;
  }

  const expectedAppId = String(config.appId);
  const receivedAppId = String(payloadAppId);

  // Timing-safe comparison — pad to same length first to avoid length oracle
  const expectedBuf = Buffer.from(expectedAppId.padEnd(20, '\0'), 'utf8');
  const receivedBuf = Buffer.from(receivedAppId.padEnd(20, '\0'), 'utf8');

  if (
    expectedBuf.length !== receivedBuf.length ||
    !crypto.timingSafeEqual(expectedBuf, receivedBuf)
  ) {
    logger.warn('TeleCMI webhook appid mismatch — rejecting', {
      module: 'cti.webhook.auth',
      correlationId: req.correlationId,
      receivedAppId,
    });
    res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'App ID mismatch' } });
    return;
  }

  // ── Step 2: Custom value verification (if configured) ────────────────────
  const customValue = config.webhookCustomValue;
  if (customValue) {
    const receivedCustom = payload.custom ?? '';

    const expectedCustomBuf = Buffer.from(customValue.padEnd(64, '\0'), 'utf8');
    const receivedCustomBuf = Buffer.from(receivedCustom.padEnd(64, '\0'), 'utf8');

    if (
      expectedCustomBuf.length !== receivedCustomBuf.length ||
      !crypto.timingSafeEqual(expectedCustomBuf, receivedCustomBuf)
    ) {
      logger.warn('TeleCMI webhook custom value mismatch — rejecting', {
        module: 'cti.webhook.auth',
        correlationId: req.correlationId,
      });
      res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Webhook custom value mismatch' } });
      return;
    }
  }

  next();
}
