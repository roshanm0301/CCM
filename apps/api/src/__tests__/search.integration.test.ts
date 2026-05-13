// =============================================================================
// CCM API — Search Integration Tests
//
// Tests the search endpoint against a real test database.
// Requires TEST_DATABASE_URL to be set.
// Source: CCM_Phase1_Agent_Interaction_Documentation.md §B3, §C3, §D3
// =============================================================================

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { app, loginAs, authedRequest } from './helpers/testApp';
import {
  getTestPool,
  closeTestPool,
  cleanupInteractions,
  cleanupAgentStatus,
  cleanupUserAuditEvents,
  countAuditEvents,
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
let activeInteractionId: string;

beforeAll(async () => {
  await getTestPool().query('SELECT 1');

  const { rows } = await getTestPool().query<{ id: string }>(
    `SELECT id FROM users WHERE username = $1`,
    [AGENT_USERNAME],
  );
  agentUserId = rows[0]!.id;
});

beforeEach(async () => {
  await cleanupInteractions(agentUserId);
  activeInteractionId = await seedInteraction(agentUserId, 'IDENTIFYING');
});

afterAll(async () => {
  await cleanupInteractions(agentUserId);
  await cleanupAgentStatus(agentUserId);
  await cleanupUserAuditEvents(agentUserId);
  await closeTestPool();
});

// ---------------------------------------------------------------------------
// POST /api/v1/search
// ---------------------------------------------------------------------------

describe('POST /api/v1/search', () => {
  it('should return 200 with search results for a valid mobile number in the mock dataset', async () => {
    const session = await loginAs(AGENT_USERNAME, AGENT_PASSWORD);

    const response = await authedRequest('post', '/api/v1/search', session).send({
      interactionId: activeInteractionId,
      filter: 'mobile',
      value: '9876543210', // Rahul Sharma in seeded data
    });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.results).toHaveLength(1);
    expect(response.body.data.results[0].customerName).toBe('Rahul Sharma');
    expect(response.body.data.resultCount).toBe(1);
  });

  it('should return 200 with masked chassis numbers in results', async () => {
    const session = await loginAs(AGENT_USERNAME, AGENT_PASSWORD);

    const response = await authedRequest('post', '/api/v1/search', session).send({
      interactionId: activeInteractionId,
      filter: 'mobile',
      value: '9876543210',
    });

    const vehicle = response.body.data.results[0].vehicles[0];
    expect(vehicle).toBeTruthy();
    // Masked chassis should have asterisks in the middle
    expect(vehicle.chassisNumberMasked).toMatch(/^[A-Z0-9]{3}\*+[A-Z0-9]{4}$/);
    // Should not expose full chassis number
    expect(vehicle.chassisNumberMasked).not.toContain('MD2A11EZ9MCA00001');
  });

  it('should return 200 with empty results for unknown mobile number', async () => {
    const session = await loginAs(AGENT_USERNAME, AGENT_PASSWORD);

    const response = await authedRequest('post', '/api/v1/search', session).send({
      interactionId: activeInteractionId,
      filter: 'mobile',
      value: '0000000000',
    });

    expect(response.status).toBe(200);
    expect(response.body.data.resultCount).toBe(0);
    expect(response.body.data.results).toHaveLength(0);
  });

  it('should write search_started and search_result_returned events to interaction_events', async () => {
    const session = await loginAs(AGENT_USERNAME, AGENT_PASSWORD);

    await authedRequest('post', '/api/v1/search', session).send({
      interactionId: activeInteractionId,
      filter: 'mobile',
      value: '9876543210',
    });

    const startedCount = await countAuditEvents(activeInteractionId, 'search_started');
    const returnedCount = await countAuditEvents(activeInteractionId, 'search_result_returned');

    expect(startedCount).toBeGreaterThanOrEqual(1);
    expect(returnedCount).toBeGreaterThanOrEqual(1);
  });

  it('should return 422 when search value is less than 3 characters', async () => {
    const session = await loginAs(AGENT_USERNAME, AGENT_PASSWORD);

    const response = await authedRequest('post', '/api/v1/search', session).send({
      interactionId: activeInteractionId,
      filter: 'mobile',
      value: '98', // only 2 chars
    });

    expect(response.status).toBe(422);
    expect(response.body.error.message).toContain('3 characters');
  });

  it('should return 422 when mobile search value contains non-digits', async () => {
    const session = await loginAs(AGENT_USERNAME, AGENT_PASSWORD);

    const response = await authedRequest('post', '/api/v1/search', session).send({
      interactionId: activeInteractionId,
      filter: 'mobile',
      value: '987654321a',
    });

    expect(response.status).toBe(422);
  });

  it('should return 422 when email format is invalid', async () => {
    const session = await loginAs(AGENT_USERNAME, AGENT_PASSWORD);

    const response = await authedRequest('post', '/api/v1/search', session).send({
      interactionId: activeInteractionId,
      filter: 'email',
      value: 'not-an-email',
    });

    expect(response.status).toBe(422);
    expect(response.body.error.message).toContain('email');
  });

  it('should return 401 when request is made without authentication', async () => {
    const response = await request(app)
      .post('/api/v1/search')
      .set('Content-Type', 'application/json')
      .send({
        interactionId: activeInteractionId,
        filter: 'mobile',
        value: '9876543210',
      });

    expect(response.status).toBe(401);
  });

  it('should return 403 when CSRF token is missing from mutation request', async () => {
    const session = await loginAs(AGENT_USERNAME, AGENT_PASSWORD);

    const response = await request(app)
      .post('/api/v1/search')
      .set('Cookie', session.cookieHeader)
      .set('Content-Type', 'application/json')
      .send({
        interactionId: activeInteractionId,
        filter: 'mobile',
        value: '9876543210',
      });
    // No X-CSRF-Token header

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('CSRF_MISSING');
  });

  it('should search by registration number and return matching vehicle', async () => {
    const session = await loginAs(AGENT_USERNAME, AGENT_PASSWORD);

    const response = await authedRequest('post', '/api/v1/search', session).send({
      interactionId: activeInteractionId,
      filter: 'registration_number',
      value: 'MH12AB1234',
    });

    expect(response.status).toBe(200);
    expect(response.body.data.results).toHaveLength(1);
    expect(response.body.data.results[0].vehicles[0].registrationNumber).toBe('MH12AB1234');
  });

  it('should return 422 when interactionId is not a valid UUID', async () => {
    const session = await loginAs(AGENT_USERNAME, AGENT_PASSWORD);

    const response = await authedRequest('post', '/api/v1/search', session).send({
      interactionId: 'not-a-uuid',
      filter: 'mobile',
      value: '9876543210',
    });

    expect(response.status).toBe(422);
  });

  it('should search by customer name and return matching customers', async () => {
    const session = await loginAs(AGENT_USERNAME, AGENT_PASSWORD);

    const response = await authedRequest('post', '/api/v1/search', session).send({
      interactionId: activeInteractionId,
      filter: 'customer_name',
      value: 'Rahul',
    });

    expect(response.status).toBe(200);
    expect(response.body.data.results.length).toBeGreaterThanOrEqual(1);
  });

  it('should return 422 when customer name contains digits', async () => {
    const session = await loginAs(AGENT_USERNAME, AGENT_PASSWORD);

    const response = await authedRequest('post', '/api/v1/search', session).send({
      interactionId: activeInteractionId,
      filter: 'customer_name',
      value: 'Rahul123',
    });

    expect(response.status).toBe(422);
  });

  it('should not expose stack traces in 422 error responses', async () => {
    const session = await loginAs(AGENT_USERNAME, AGENT_PASSWORD);

    const response = await authedRequest('post', '/api/v1/search', session).send({
      interactionId: activeInteractionId,
      filter: 'mobile',
      value: '98',
    });

    const bodyString = JSON.stringify(response.body);
    expect(bodyString).not.toContain('at Object.');
    expect(bodyString).not.toContain('.ts:');
  });
});
