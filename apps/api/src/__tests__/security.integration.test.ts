// =============================================================================
// CCM API — Security Integration Tests
//
// Verifies authentication and CSRF enforcement across all protected endpoints.
// No valid session cookie should return 401.
// No CSRF token on mutations should return 403.
// Login endpoint must NOT require CSRF.
// No stack traces in error responses.
// Source: security-principles.md, phase1-technical-blueprint.md §5.3
// =============================================================================

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app, loginAs, authedRequest } from './helpers/testApp';
import {
  getTestPool,
  closeTestPool,
  cleanupInteractions,
  cleanupAgentStatus,
  cleanupUserAuditEvents,
  seedInteraction,
} from './helpers/testDb';

// ---------------------------------------------------------------------------
// Test constants
// ---------------------------------------------------------------------------

const AGENT_USERNAME = 'agent1';
const AGENT_PASSWORD = 'Agent@123';

// ---------------------------------------------------------------------------
// Setup / Teardown
// ---------------------------------------------------------------------------

let agentUserId: string;

beforeAll(async () => {
  await getTestPool().query('SELECT 1');

  const { rows } = await getTestPool().query<{ id: string }>(
    `SELECT id FROM users WHERE username = $1`,
    [AGENT_USERNAME],
  );
  agentUserId = rows[0]!.id;
});

afterAll(async () => {
  await cleanupInteractions(agentUserId);
  await cleanupAgentStatus(agentUserId);
  await cleanupUserAuditEvents(agentUserId);
  await closeTestPool();
});

// ---------------------------------------------------------------------------
// All protected endpoints return 401 without session cookie
// ---------------------------------------------------------------------------

describe('Authentication guard — 401 without session cookie', () => {
  it('should return 401 on GET /api/v1/auth/me without cookie', async () => {
    const res = await request(app).get('/api/v1/auth/me');
    expect(res.status).toBe(401);
  });

  it('should return 401 on GET /api/v1/auth/csrf without cookie', async () => {
    const res = await request(app).get('/api/v1/auth/csrf');
    expect(res.status).toBe(401);
  });

  it('should return 401 on POST /api/v1/interactions without cookie', async () => {
    const res = await request(app)
      .post('/api/v1/interactions')
      .set('X-CSRF-Token', 'any_token')
      .send({ channel: 'manual', mode: 'manual' });
    expect(res.status).toBe(401);
  });

  it('should return 401 on GET /api/v1/agent/status without cookie', async () => {
    const res = await request(app).get('/api/v1/agent/status');
    expect(res.status).toBe(401);
  });

  it('should return 401 on PATCH /api/v1/agent/status without cookie', async () => {
    const res = await request(app)
      .patch('/api/v1/agent/status')
      .set('X-CSRF-Token', 'any_token')
      .send({ status: 'ready_for_calls' });
    expect(res.status).toBe(401);
  });

  it('should return 401 on POST /api/v1/search without cookie', async () => {
    const res = await request(app)
      .post('/api/v1/search')
      .set('X-CSRF-Token', 'any_token')
      .send({ interactionId: '00000000-0000-0000-0000-000000000001', filter: 'mobile', value: '9876543210' });
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// All mutation endpoints return 403 without X-CSRF-Token header
// ---------------------------------------------------------------------------

describe('CSRF guard — 403 on mutations without X-CSRF-Token', () => {
  it('should return 403 on POST /api/v1/interactions without CSRF header', async () => {
    const session = await loginAs(AGENT_USERNAME, AGENT_PASSWORD);

    const res = await request(app)
      .post('/api/v1/interactions')
      .set('Cookie', session.cookieHeader)
      .set('Content-Type', 'application/json')
      .send({ channel: 'manual', mode: 'manual' });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('CSRF_MISSING');
  });

  it('should return 403 on PATCH /api/v1/agent/status without CSRF header', async () => {
    const session = await loginAs(AGENT_USERNAME, AGENT_PASSWORD);

    const res = await request(app)
      .patch('/api/v1/agent/status')
      .set('Cookie', session.cookieHeader)
      .set('Content-Type', 'application/json')
      .send({ status: 'ready_for_calls' });

    expect(res.status).toBe(403);
  });

  it('should return 403 on POST /api/v1/search without CSRF header', async () => {
    const session = await loginAs(AGENT_USERNAME, AGENT_PASSWORD);
    const interactionId = await seedInteraction(agentUserId, 'IDENTIFYING');

    const res = await request(app)
      .post('/api/v1/search')
      .set('Cookie', session.cookieHeader)
      .set('Content-Type', 'application/json')
      .send({ interactionId, filter: 'mobile', value: '9876543210' });

    expect(res.status).toBe(403);
  });

  it('should return 403 on POST /api/v1/auth/logout without CSRF header', async () => {
    const session = await loginAs(AGENT_USERNAME, AGENT_PASSWORD);

    const res = await request(app)
      .post('/api/v1/auth/logout')
      .set('Cookie', session.cookieHeader)
      .set('Content-Type', 'application/json')
      .send({});

    expect(res.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// Login endpoint does NOT require CSRF
// ---------------------------------------------------------------------------

describe('CSRF endpoint — CSRF exemption', () => {
  it('should return 200 on GET /api/v1/auth/csrf without X-CSRF-Token (endpoint re-issues the token)', async () => {
    const session = await loginAs(AGENT_USERNAME, AGENT_PASSWORD);

    const res = await request(app)
      .get('/api/v1/auth/csrf')
      .set('Cookie', session.cookieHeader);
    // Must not return 403 — this endpoint IS the CSRF token re-issuance point
    expect(res.status).toBe(200);
  });
});

describe('Login endpoint — CSRF exemption', () => {
  it('should return 200 on POST /api/v1/auth/login without X-CSRF-Token (login issues the token)', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .set('Content-Type', 'application/json')
      .send({ username: AGENT_USERNAME, password: AGENT_PASSWORD });

    // Must not return 403 — login is the CSRF issuance point
    expect(res.status).toBe(200);
  });

  it('should still enforce valid credentials on the CSRF-exempt login endpoint', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .set('Content-Type', 'application/json')
      .send({ username: AGENT_USERNAME, password: 'wrong_password' });

    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// No stack traces in error responses
// ---------------------------------------------------------------------------

describe('Error responses — no stack trace exposure', () => {
  it('should not include stack trace in 401 error response', async () => {
    const res = await request(app).get('/api/v1/auth/me');

    const bodyString = JSON.stringify(res.body);
    expect(bodyString).not.toContain('at Object.');
    expect(bodyString).not.toContain('node_modules');
    expect(bodyString).not.toContain('.ts:');
  });

  it('should not include stack trace in 403 CSRF error response', async () => {
    const session = await loginAs(AGENT_USERNAME, AGENT_PASSWORD);

    const res = await request(app)
      .post('/api/v1/interactions')
      .set('Cookie', session.cookieHeader)
      .send({ channel: 'manual', mode: 'manual' });

    const bodyString = JSON.stringify(res.body);
    expect(bodyString).not.toContain('at Object.');
  });

  it('should not include stack trace in 422 validation error response', async () => {
    const session = await loginAs(AGENT_USERNAME, AGENT_PASSWORD);
    const interactionId = await seedInteraction(agentUserId, 'IDENTIFYING');

    const res = await authedRequest('post', '/api/v1/search', session).send({
      interactionId,
      filter: 'mobile',
      value: '98', // too short
    });

    const bodyString = JSON.stringify(res.body);
    expect(bodyString).not.toContain('at Object.');
  });

  it('should not include stack trace in 404 response', async () => {
    const session = await loginAs(AGENT_USERNAME, AGENT_PASSWORD);
    const interactionId = await seedInteraction(agentUserId, 'IDENTIFYING');

    const res = await authedRequest(
      'patch',
      '/api/v1/interactions/00000000-0000-0000-0000-000000000000/context',
      session,
    ).send({ customerRef: 'X', isReselection: false });

    const bodyString = JSON.stringify(res.body);
    expect(bodyString).not.toContain('at Object.');
  });

  it('should return a standard error envelope shape on 401', async () => {
    const res = await request(app).get('/api/v1/auth/me');

    expect(res.body).toMatchObject({
      success: false,
      error: {
        code: expect.any(String),
        message: expect.any(String),
      },
    });
    // Must not have stack or internal info
    expect(res.body.error).not.toHaveProperty('stack');
  });
});

// ---------------------------------------------------------------------------
// CSRF token mismatch returns 403 (not 401 or 500)
// ---------------------------------------------------------------------------

describe('CSRF token mismatch', () => {
  it('should return 403 when CSRF header token does not match the cookie token', async () => {
    const session = await loginAs(AGENT_USERNAME, AGENT_PASSWORD);

    const res = await request(app)
      .patch('/api/v1/agent/status')
      .set('Cookie', session.cookieHeader)
      .set('X-CSRF-Token', 'completely_wrong_value_that_does_not_match')
      .set('Content-Type', 'application/json')
      .send({ status: 'break' });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toMatch(/CSRF/);
  });
});

// ---------------------------------------------------------------------------
// Health endpoints are accessible without authentication (sanity check)
// ---------------------------------------------------------------------------

describe('Health endpoints — no auth required', () => {
  it('should return 200 on GET /health/live without any auth', async () => {
    const res = await request(app).get('/health/live');
    expect(res.status).toBe(200);
  });
});
