// =============================================================================
// CCM API — Agent Status Integration Tests
//
// Tests GET and PATCH agent status against a real test database.
// Requires TEST_DATABASE_URL to be set.
// Source: CCM_Phase1_Agent_Interaction_Documentation.md §C11, §D11
// =============================================================================

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app, loginAs, authedRequest } from './helpers/testApp';
import {
  getTestPool,
  closeTestPool,
  cleanupAgentStatus,
  cleanupUserAuditEvents,
  countAuditEvents,
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
  await cleanupAgentStatus(agentUserId);
  await cleanupUserAuditEvents(agentUserId);
  await closeTestPool();
});

// ---------------------------------------------------------------------------
// GET /api/v1/agent/status
// ---------------------------------------------------------------------------

describe('GET /api/v1/agent/status', () => {
  it('should return 200 with current agent status when authenticated', async () => {
    const session = await loginAs(AGENT_USERNAME, AGENT_PASSWORD);

    const response = await request(app)
      .get('/api/v1/agent/status')
      .set('Cookie', session.cookieHeader);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.currentStatus).toBeDefined();
    expect(['ready_for_calls', 'break', 'offline', 'training']).toContain(
      response.body.data.currentStatus,
    );
  });

  it('should return offline status immediately after login (default per spec)', async () => {
    await cleanupAgentStatus(agentUserId);
    const session = await loginAs(AGENT_USERNAME, AGENT_PASSWORD);

    const response = await request(app)
      .get('/api/v1/agent/status')
      .set('Cookie', session.cookieHeader);

    expect(response.status).toBe(200);
    expect(response.body.data.currentStatus).toBe('offline');
  });

  it('should return 401 when no session cookie is provided', async () => {
    const response = await request(app).get('/api/v1/agent/status');

    expect(response.status).toBe(401);
  });

  it('should return correct userId in the response', async () => {
    const session = await loginAs(AGENT_USERNAME, AGENT_PASSWORD);

    const response = await request(app)
      .get('/api/v1/agent/status')
      .set('Cookie', session.cookieHeader);

    expect(response.body.data.userId).toBe(agentUserId);
  });
});

// ---------------------------------------------------------------------------
// PATCH /api/v1/agent/status
// ---------------------------------------------------------------------------

describe('PATCH /api/v1/agent/status', () => {
  it('should return 200 and update status to ready_for_calls', async () => {
    const session = await loginAs(AGENT_USERNAME, AGENT_PASSWORD);

    const response = await authedRequest('patch', '/api/v1/agent/status', session).send({
      status: 'ready_for_calls',
    });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.currentStatus).toBe('ready_for_calls');
  });

  it('should return 200 and update status to break', async () => {
    const session = await loginAs(AGENT_USERNAME, AGENT_PASSWORD);

    const response = await authedRequest('patch', '/api/v1/agent/status', session).send({
      status: 'break',
    });

    expect(response.status).toBe(200);
    expect(response.body.data.currentStatus).toBe('break');
  });

  it('should return 200 and update status to training', async () => {
    const session = await loginAs(AGENT_USERNAME, AGENT_PASSWORD);

    const response = await authedRequest('patch', '/api/v1/agent/status', session).send({
      status: 'training',
    });

    expect(response.status).toBe(200);
    expect(response.body.data.currentStatus).toBe('training');
  });

  it('should return 200 and update status to offline', async () => {
    // First set to something else
    const session = await loginAs(AGENT_USERNAME, AGENT_PASSWORD);
    await authedRequest('patch', '/api/v1/agent/status', session).send({ status: 'break' });

    const response = await authedRequest('patch', '/api/v1/agent/status', session).send({
      status: 'offline',
    });

    expect(response.status).toBe(200);
    expect(response.body.data.currentStatus).toBe('offline');
  });

  it('should write agent_status_changed event to interaction_events after update', async () => {
    await cleanupUserAuditEvents(agentUserId);
    const session = await loginAs(AGENT_USERNAME, AGENT_PASSWORD);
    await cleanupUserAuditEvents(agentUserId); // clean events from login

    await authedRequest('patch', '/api/v1/agent/status', session).send({
      status: 'ready_for_calls',
    });

    const eventCount = await countAuditEvents(null, 'agent_status_changed');
    expect(eventCount).toBeGreaterThanOrEqual(1);
  });

  it('should return 422 when status value is not in the allowed enum', async () => {
    const session = await loginAs(AGENT_USERNAME, AGENT_PASSWORD);

    const response = await authedRequest('patch', '/api/v1/agent/status', session).send({
      status: 'invalid_status_value',
    });

    expect(response.status).toBe(422);
    expect(response.body.success).toBe(false);
  });

  it('should return 422 when status is an empty string', async () => {
    const session = await loginAs(AGENT_USERNAME, AGENT_PASSWORD);

    const response = await authedRequest('patch', '/api/v1/agent/status', session).send({
      status: '',
    });

    expect(response.status).toBe(422);
  });

  it('should return 422 when status field is missing from request body', async () => {
    const session = await loginAs(AGENT_USERNAME, AGENT_PASSWORD);

    const response = await authedRequest('patch', '/api/v1/agent/status', session).send({});

    expect(response.status).toBe(422);
  });

  it('should return 401 when no session cookie is provided', async () => {
    const response = await request(app)
      .patch('/api/v1/agent/status')
      .set('Content-Type', 'application/json')
      .send({ status: 'ready_for_calls' });

    expect(response.status).toBe(401);
  });

  it('should return 403 when CSRF token is missing', async () => {
    const session = await loginAs(AGENT_USERNAME, AGENT_PASSWORD);

    const response = await request(app)
      .patch('/api/v1/agent/status')
      .set('Cookie', session.cookieHeader)
      .set('Content-Type', 'application/json')
      .send({ status: 'ready_for_calls' });
    // No X-CSRF-Token header

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('CSRF_MISSING');
  });

  it('should return 403 when CSRF token does not match', async () => {
    const session = await loginAs(AGENT_USERNAME, AGENT_PASSWORD);

    const response = await request(app)
      .patch('/api/v1/agent/status')
      .set('Cookie', session.cookieHeader)
      .set('X-CSRF-Token', 'tampered_csrf_token_value')
      .set('Content-Type', 'application/json')
      .send({ status: 'ready_for_calls' });

    expect(response.status).toBe(403);
  });
});
