// =============================================================================
// CCM API — CTI Webhook Auth Middleware Unit Tests
//
// Verifies that verifyTeleCmiWebhook correctly authenticates TeleCMI webhook
// payloads using App ID + optional custom value verification.
//
// Background: TeleCMI does NOT send an HMAC-SHA256 signature header.
// Authentication is based on:
//   1. payload.appid (or payload.app_id for live events) must match TELECMI_APP_ID
//   2. If TELECMI_WEBHOOK_CUSTOM_VALUE is configured, payload.custom must match
//
// Both comparisons use crypto.timingSafeEqual (timing-safe).
// =============================================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';

// ---------------------------------------------------------------------------
// Mock dependencies before importing the middleware
// ---------------------------------------------------------------------------

vi.mock('../cti.config', () => ({
  getCtiConfig: vi.fn(),
}));

vi.mock('../../../shared/logging/logger', () => ({
  logger: {
    info: vi.fn(), warn: vi.fn(), error: vi.fn(),
    debug: vi.fn(), http: vi.fn(),
  },
}));

import { getCtiConfig } from '../cti.config';
import { verifyTeleCmiWebhook } from '../cti.hmac.middleware';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

const TEST_APP_ID = 33335989;
const TEST_CUSTOM_VALUE = 'ccm-webhook-secret-value';

type MockedCtiConfig = ReturnType<typeof getCtiConfig>;

function mockCtiConfig(overrides: Partial<MockedCtiConfig> = {}) {
  vi.mocked(getCtiConfig).mockReturnValue({
    appId: TEST_APP_ID,
    appSecret: 'test-app-secret',
    sbcUri: 'sbcind.telecmi.com',
    webhookCustomValue: TEST_CUSTOM_VALUE,
    baseUrl: 'https://rest.telecmi.com',
    callerId: '917943444751',
    ...overrides,
  });
}

function makeReq(body: Record<string, unknown> = {}): Request {
  return {
    body,
    correlationId: 'test-correlation-id',
  } as unknown as Request;
}

function makeRes(): Response & { statusCode: number; jsonBody: unknown } {
  const res = {
    statusCode: 200,
    jsonBody: null as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(body: unknown) {
      this.jsonBody = body;
      return this;
    },
  };
  return res as unknown as Response & { statusCode: number; jsonBody: unknown };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('verifyTeleCmiWebhook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCtiConfig();
  });

  // -------------------------------------------------------------------------
  // Happy path — CDR payload (uses appid)
  // -------------------------------------------------------------------------

  describe('PASS — valid CDR payload', () => {
    it('calls next() for CDR payload with correct appid and custom value', () => {
      const req = makeReq({ type: 'cdr', appid: 33335989, custom: TEST_CUSTOM_VALUE, cmiuuid: 'test-uuid' });
      const res = makeRes();
      const next = vi.fn() as unknown as NextFunction;

      verifyTeleCmiWebhook(req, res as Response, next);

      expect(next).toHaveBeenCalledOnce();
      expect(res.statusCode).toBe(200);
    });

    it('calls next() when appid is a string that matches the configured app ID', () => {
      const req = makeReq({ type: 'cdr', appid: '33335989', custom: TEST_CUSTOM_VALUE });
      const res = makeRes();
      const next = vi.fn() as unknown as NextFunction;

      verifyTeleCmiWebhook(req, res as Response, next);

      expect(next).toHaveBeenCalledOnce();
    });
  });

  // -------------------------------------------------------------------------
  // Happy path — live event payload (uses app_id)
  // -------------------------------------------------------------------------

  describe('PASS — valid live event payload', () => {
    it('calls next() for live event payload using app_id field', () => {
      const req = makeReq({ type: 'event', app_id: 33335989, custom: TEST_CUSTOM_VALUE, status: 'waiting' });
      const res = makeRes();
      const next = vi.fn() as unknown as NextFunction;

      verifyTeleCmiWebhook(req, res as Response, next);

      expect(next).toHaveBeenCalledOnce();
    });
  });

  // -------------------------------------------------------------------------
  // Happy path — no custom value configured (app ID only)
  // -------------------------------------------------------------------------

  describe('PASS — no custom value configured', () => {
    it('calls next() when webhookCustomValue is empty and appid matches', () => {
      mockCtiConfig({ webhookCustomValue: '' });
      const req = makeReq({ type: 'cdr', appid: 33335989 });
      const res = makeRes();
      const next = vi.fn() as unknown as NextFunction;

      verifyTeleCmiWebhook(req, res as Response, next);

      expect(next).toHaveBeenCalledOnce();
    });

    it('calls next() even if payload has no custom field when webhookCustomValue is not configured', () => {
      mockCtiConfig({ webhookCustomValue: '' });
      const req = makeReq({ type: 'event', app_id: 33335989 });
      const res = makeRes();
      const next = vi.fn() as unknown as NextFunction;

      verifyTeleCmiWebhook(req, res as Response, next);

      expect(next).toHaveBeenCalledOnce();
    });
  });

  // -------------------------------------------------------------------------
  // Rejection — app ID mismatch
  // -------------------------------------------------------------------------

  describe('REJECT 401 — app ID mismatch', () => {
    it('returns 401 when appid does not match configured app ID', () => {
      const req = makeReq({ type: 'cdr', appid: 9999999, custom: TEST_CUSTOM_VALUE });
      const res = makeRes();
      const next = vi.fn() as unknown as NextFunction;

      verifyTeleCmiWebhook(req, res as Response, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.statusCode).toBe(401);
      expect((res as unknown as { jsonBody: { error: { code: string } } }).jsonBody).toMatchObject({
        error: { code: 'UNAUTHORIZED' },
      });
    });

    it('returns 401 when payload has no appid or app_id field', () => {
      const req = makeReq({ type: 'cdr', custom: TEST_CUSTOM_VALUE, cmiuuid: 'test' });
      const res = makeRes();
      const next = vi.fn() as unknown as NextFunction;

      verifyTeleCmiWebhook(req, res as Response, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.statusCode).toBe(401);
      expect((res as unknown as { jsonBody: { error: { code: string; message: string } } }).jsonBody).toMatchObject({
        error: { code: 'UNAUTHORIZED', message: expect.stringContaining('appid') },
      });
    });
  });

  // -------------------------------------------------------------------------
  // Rejection — custom value mismatch
  // -------------------------------------------------------------------------

  describe('REJECT 401 — custom value mismatch', () => {
    it('returns 401 when custom value does not match configured value', () => {
      const req = makeReq({ type: 'cdr', appid: 33335989, custom: 'wrong-custom-value' });
      const res = makeRes();
      const next = vi.fn() as unknown as NextFunction;

      verifyTeleCmiWebhook(req, res as Response, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.statusCode).toBe(401);
    });

    it('returns 401 when custom value is configured but payload has no custom field', () => {
      const req = makeReq({ type: 'cdr', appid: 33335989 }); // no custom field
      const res = makeRes();
      const next = vi.fn() as unknown as NextFunction;

      verifyTeleCmiWebhook(req, res as Response, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.statusCode).toBe(401);
    });

    it('returns 401 when custom value is empty string but configured value is non-empty', () => {
      const req = makeReq({ type: 'cdr', appid: 33335989, custom: '' });
      const res = makeRes();
      const next = vi.fn() as unknown as NextFunction;

      verifyTeleCmiWebhook(req, res as Response, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.statusCode).toBe(401);
    });
  });

  // -------------------------------------------------------------------------
  // Fail-secure: placeholder app ID
  //
  // Behaviour depends on NODE_ENV:
  //   - NODE_ENV=development: warn-and-allow (dev convenience)
  //   - NODE_ENV=test or production: reject 403 (fail-secure)
  // Tests run with NODE_ENV=test, so the placeholder MUST be rejected.
  // -------------------------------------------------------------------------

  describe('REJECT 403 — placeholder app ID in non-development modes', () => {
    it('returns 403 when appId is the placeholder default "1111112" in test/production mode', () => {
      // NODE_ENV is 'test' in Vitest — placeholder is treated as unconfigured
      mockCtiConfig({ appId: 1111112, webhookCustomValue: '' });
      const req = makeReq({ type: 'cdr', appid: 1111112 });
      const res = makeRes();
      const next = vi.fn() as unknown as NextFunction;

      verifyTeleCmiWebhook(req, res as Response, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.statusCode).toBe(403);
    });

    it('allows through with a warning in development mode (NODE_ENV=development)', () => {
      const orig = process.env['NODE_ENV'];
      process.env['NODE_ENV'] = 'development';
      try {
        mockCtiConfig({ appId: 1111112, webhookCustomValue: '' });
        const req = makeReq({ type: 'cdr', appid: 1111112 });
        const res = makeRes();
        const next = vi.fn() as unknown as NextFunction;

        verifyTeleCmiWebhook(req, res as Response, next);

        // In development mode the placeholder warns but allows through
        expect(next).toHaveBeenCalledOnce();
        expect(res.statusCode).toBe(200);
      } finally {
        process.env['NODE_ENV'] = orig;
      }
    });
  });

  // -------------------------------------------------------------------------
  // Fail-secure: no app ID configured at all
  // -------------------------------------------------------------------------

  describe('REJECT 403 — no app ID configured (fail-secure)', () => {
    it('returns 403 when appId is 0 (falsy — simulates unconfigured)', () => {
      mockCtiConfig({ appId: 0 });
      const req = makeReq({ type: 'cdr', appid: 33335989 });
      const res = makeRes();
      const next = vi.fn() as unknown as NextFunction;

      verifyTeleCmiWebhook(req, res as Response, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.statusCode).toBe(403);
    });
  });

  // -------------------------------------------------------------------------
  // Timing-safe: no false positives
  // -------------------------------------------------------------------------

  describe('timing-safe comparison — no false positives', () => {
    it('rejects when appid is numerically close but different', () => {
      const req = makeReq({ type: 'cdr', appid: 33335988, custom: TEST_CUSTOM_VALUE });
      const res = makeRes();
      const next = vi.fn() as unknown as NextFunction;

      verifyTeleCmiWebhook(req, res as Response, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.statusCode).toBe(401);
    });

    it('uses timingSafeEqual — both appid and custom must match independently', () => {
      // Correct appid but wrong custom
      const req1 = makeReq({ type: 'cdr', appid: 33335989, custom: 'wrong' });
      const res1 = makeRes();
      const next1 = vi.fn() as unknown as NextFunction;
      verifyTeleCmiWebhook(req1, res1 as Response, next1);
      expect(next1).not.toHaveBeenCalled();

      // Correct custom but wrong appid
      const req2 = makeReq({ type: 'cdr', appid: 0, custom: TEST_CUSTOM_VALUE });
      const res2 = makeRes();
      const next2 = vi.fn() as unknown as NextFunction;
      verifyTeleCmiWebhook(req2, res2 as Response, next2);
      expect(next2).not.toHaveBeenCalled();
    });
  });
});

