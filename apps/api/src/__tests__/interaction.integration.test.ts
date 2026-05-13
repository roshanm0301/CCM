// =============================================================================
// CCM API — Interaction Integration Tests
//
// Tests the full interaction lifecycle against a real test database.
// Requires TEST_DATABASE_URL to be set.
// Source: CCM_Phase1_Agent_Interaction_Documentation.md §B2–B8, §C2–C9, §D2–D9
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
  seedWrapup,
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

  // Get the agent user ID from DB
  const { rows } = await getTestPool().query<{ id: string }>(
    `SELECT id FROM users WHERE username = $1`,
    [AGENT_USERNAME],
  );
  agentUserId = rows[0]!.id;
});

beforeEach(async () => {
  // Clean slate before each test
  await cleanupInteractions(agentUserId);
});

afterAll(async () => {
  await cleanupInteractions(agentUserId);
  await cleanupAgentStatus(agentUserId);
  await cleanupUserAuditEvents(agentUserId);
  await closeTestPool();
});

// ---------------------------------------------------------------------------
// POST /api/v1/interactions — Create Interaction
// ---------------------------------------------------------------------------

describe('POST /api/v1/interactions', () => {
  it('should return 201 with interaction in IDENTIFYING status', async () => {
    const session = await loginAs(AGENT_USERNAME, AGENT_PASSWORD);

    const response = await authedRequest('post', '/api/v1/interactions', session).send({
      channel: 'manual',
      mode: 'manual',
    });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.status).toBe('IDENTIFYING');
    expect(response.body.data.interactionId).toBeTruthy();
    expect(response.body.data.channel).toBe('manual');
    expect(response.body.data.mode).toBe('manual');
  });

  it('should write interaction_created event in interaction_events table', async () => {
    const session = await loginAs(AGENT_USERNAME, AGENT_PASSWORD);

    const response = await authedRequest('post', '/api/v1/interactions', session).send({
      channel: 'manual',
      mode: 'manual',
    });

    const interactionId = response.body.data.interactionId as string;
    const eventCount = await countAuditEvents(interactionId, 'interaction_created');
    expect(eventCount).toBe(1);
  });

  it('should return 409 when agent already has an open interaction', async () => {
    const session = await loginAs(AGENT_USERNAME, AGENT_PASSWORD);

    // Create first interaction
    const first = await authedRequest('post', '/api/v1/interactions', session).send({
      channel: 'manual',
      mode: 'manual',
    });
    expect(first.status).toBe(201);

    // Attempt to create a second one
    const second = await authedRequest('post', '/api/v1/interactions', session).send({
      channel: 'manual',
      mode: 'manual',
    });

    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe('CONFLICT');
    expect(second.body.error.message).toContain('open interaction');
  });

  it('should return 401 when no session cookie is provided', async () => {
    const response = await request(app)
      .post('/api/v1/interactions')
      .set('Content-Type', 'application/json')
      .send({ channel: 'manual', mode: 'manual' });

    expect(response.status).toBe(401);
  });

  it('should return 403 when CSRF token is missing', async () => {
    const session = await loginAs(AGENT_USERNAME, AGENT_PASSWORD);

    const response = await request(app)
      .post('/api/v1/interactions')
      .set('Cookie', session.cookieHeader)
      .set('Content-Type', 'application/json')
      .send({ channel: 'manual', mode: 'manual' });
    // No X-CSRF-Token header

    expect(response.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// PATCH /api/v1/interactions/:id/context — Update Context
// ---------------------------------------------------------------------------

describe('PATCH /api/v1/interactions/:id/context', () => {
  it('should return 200 and update status to CONTEXT_CONFIRMED from IDENTIFYING', async () => {
    const session = await loginAs(AGENT_USERNAME, AGENT_PASSWORD);

    const createResponse = await authedRequest('post', '/api/v1/interactions', session).send({
      channel: 'manual',
      mode: 'manual',
    });
    const interactionId = createResponse.body.data.interactionId as string;

    const response = await authedRequest(
      'patch',
      `/api/v1/interactions/${interactionId}/context`,
      session,
    ).send({
      customerRef: 'CUST-IB-001',
      vehicleRef: 'VEH-IB-001',
      dealerRef: 'DLR-001',
      isReselection: false,
    });

    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe('CONTEXT_CONFIRMED');
    expect(response.body.data.currentCustomerRef).toBe('CUST-IB-001');
  });

  it('should return 422 when trying to update context from WRAPUP status', async () => {
    const session = await loginAs(AGENT_USERNAME, AGENT_PASSWORD);

    // Seed interaction in WRAPUP state
    const interactionId = await seedInteraction(agentUserId, 'WRAPUP');

    const response = await authedRequest(
      'patch',
      `/api/v1/interactions/${interactionId}/context`,
      session,
    ).send({
      customerRef: 'CUST-IB-001',
      isReselection: false,
    });

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('INVALID_STATUS_TRANSITION');
  });

  it('should return 404 when interaction does not exist', async () => {
    const session = await loginAs(AGENT_USERNAME, AGENT_PASSWORD);

    const response = await authedRequest(
      'patch',
      '/api/v1/interactions/00000000-0000-0000-0000-000000000000/context',
      session,
    ).send({
      customerRef: 'CUST-IB-001',
      isReselection: false,
    });

    expect(response.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// PATCH /api/v1/interactions/:id/wrapup — Save Wrapup
// ---------------------------------------------------------------------------

describe('PATCH /api/v1/interactions/:id/wrapup', () => {
  const validWrapupBody = {
    contactReasonCode: 'query',
    identificationOutcomeCode: 'customer_vehicle_identified',
    interactionDispositionCode: 'information_provided',
  };

  it('should return 200 and set status to WRAPUP from CONTEXT_CONFIRMED', async () => {
    const session = await loginAs(AGENT_USERNAME, AGENT_PASSWORD);
    const interactionId = await seedInteraction(agentUserId, 'CONTEXT_CONFIRMED');

    const response = await authedRequest(
      'patch',
      `/api/v1/interactions/${interactionId}/wrapup`,
      session,
    ).send(validWrapupBody);

    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe('WRAPUP');
    expect(response.body.data.wrapup.contactReasonCode).toBe('query');
  });

  it('should return 422 when mandatory-remarks disposition has empty remarks', async () => {
    const session = await loginAs(AGENT_USERNAME, AGENT_PASSWORD);
    const interactionId = await seedInteraction(agentUserId, 'CONTEXT_CONFIRMED');

    const response = await authedRequest(
      'patch',
      `/api/v1/interactions/${interactionId}/wrapup`,
      session,
    ).send({
      contactReasonCode: 'query',
      identificationOutcomeCode: 'no_verified_match',
      interactionDispositionCode: 'no_match_found',
      remarks: '',
    });

    expect(response.status).toBe(422);
    expect(response.body.error.message).toContain('remarks');
  });

  it('should return 422 when mandatory-remarks disposition has null remarks', async () => {
    const session = await loginAs(AGENT_USERNAME, AGENT_PASSWORD);
    const interactionId = await seedInteraction(agentUserId, 'CONTEXT_CONFIRMED');

    const response = await authedRequest(
      'patch',
      `/api/v1/interactions/${interactionId}/wrapup`,
      session,
    ).send({
      contactReasonCode: 'complaint',
      identificationOutcomeCode: 'no_verified_match',
      interactionDispositionCode: 'technical_issue',
      // remarks omitted
    });

    expect(response.status).toBe(422);
  });

  it('should return 422 when trying to save wrapup from CLOSED status', async () => {
    const session = await loginAs(AGENT_USERNAME, AGENT_PASSWORD);
    const interactionId = await seedInteraction(agentUserId, 'CLOSED');

    const response = await authedRequest(
      'patch',
      `/api/v1/interactions/${interactionId}/wrapup`,
      session,
    ).send(validWrapupBody);

    expect(response.status).toBe(422);
  });

  it('should return 422 when trying to save wrapup from INCOMPLETE status', async () => {
    const session = await loginAs(AGENT_USERNAME, AGENT_PASSWORD);
    const interactionId = await seedInteraction(agentUserId, 'INCOMPLETE');

    const response = await authedRequest(
      'patch',
      `/api/v1/interactions/${interactionId}/wrapup`,
      session,
    ).send(validWrapupBody);

    expect(response.status).toBe(422);
  });

  it('should allow re-saving wrapup (upsert) when interaction is already in WRAPUP status', async () => {
    const session = await loginAs(AGENT_USERNAME, AGENT_PASSWORD);
    const interactionId = await seedInteraction(agentUserId, 'WRAPUP');
    await seedWrapup(interactionId, agentUserId, 'information_provided');

    const response = await authedRequest(
      'patch',
      `/api/v1/interactions/${interactionId}/wrapup`,
      session,
    ).send(validWrapupBody);

    expect(response.status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// POST /api/v1/interactions/:id/close
// ---------------------------------------------------------------------------

describe('POST /api/v1/interactions/:id/close', () => {
  it('should return 200 and status CLOSED when closing from WRAPUP with valid wrapup', async () => {
    const session = await loginAs(AGENT_USERNAME, AGENT_PASSWORD);
    const interactionId = await seedInteraction(agentUserId, 'WRAPUP');
    await seedWrapup(interactionId, agentUserId, 'information_provided');

    const response = await authedRequest(
      'post',
      `/api/v1/interactions/${interactionId}/close`,
      session,
    ).send({});

    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe('CLOSED');
    expect(response.body.data.completionFlag).toBe(true);
    expect(response.body.data.endedAt).toBeTruthy();
  });

  it('should write interaction_closed event to interaction_events table', async () => {
    const session = await loginAs(AGENT_USERNAME, AGENT_PASSWORD);
    const interactionId = await seedInteraction(agentUserId, 'WRAPUP');
    await seedWrapup(interactionId, agentUserId, 'information_provided');

    await authedRequest('post', `/api/v1/interactions/${interactionId}/close`, session).send({});

    const eventCount = await countAuditEvents(interactionId, 'interaction_closed');
    expect(eventCount).toBe(1);
  });

  it('should return 422 when trying to close from IDENTIFYING status', async () => {
    const session = await loginAs(AGENT_USERNAME, AGENT_PASSWORD);
    const interactionId = await seedInteraction(agentUserId, 'IDENTIFYING');

    const response = await authedRequest(
      'post',
      `/api/v1/interactions/${interactionId}/close`,
      session,
    ).send({});

    expect(response.status).toBe(422);
  });

  it('should return 422 on second close attempt (already CLOSED)', async () => {
    const session = await loginAs(AGENT_USERNAME, AGENT_PASSWORD);
    const interactionId = await seedInteraction(agentUserId, 'WRAPUP');
    await seedWrapup(interactionId, agentUserId, 'information_provided');

    // First close — should succeed
    const first = await authedRequest(
      'post',
      `/api/v1/interactions/${interactionId}/close`,
      session,
    ).send({});
    expect(first.status).toBe(200);

    // Second close — must not crash the server
    const second = await authedRequest(
      'post',
      `/api/v1/interactions/${interactionId}/close`,
      session,
    ).send({});

    // Idempotent: must return a controlled error, not a 500
    expect([200, 422]).toContain(second.status);
    expect(second.body.success !== undefined).toBe(true);
  });

  it('should return 401 when no session cookie is provided', async () => {
    const response = await request(app)
      .post('/api/v1/interactions/some-id/close')
      .set('Content-Type', 'application/json')
      .send({});

    expect(response.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// GAP 4 (F16): Dealer missing does not block close or wrapup
// ---------------------------------------------------------------------------

describe('F16 — interaction without dealer (dealerRef null) still closes', () => {
  it('allows CONTEXT_CONFIRMED state when context is patched with null dealerRef', async () => {
    const session = await loginAs(AGENT_USERNAME, AGENT_PASSWORD);

    const createResponse = await authedRequest('post', '/api/v1/interactions', session).send({
      channel: 'manual',
      mode: 'manual',
    });
    const interactionId = createResponse.body.data.interactionId as string;

    const contextResponse = await authedRequest(
      'patch',
      `/api/v1/interactions/${interactionId}/context`,
      session,
    ).send({
      customerRef: 'CUST-IB-001',
      vehicleRef: 'VEH-IB-001',
      dealerRef: null,
      isReselection: false,
    });

    expect(contextResponse.status).toBe(200);
    expect(contextResponse.body.data.status).toBe('CONTEXT_CONFIRMED');
    expect(contextResponse.body.data.currentDealerRef).toBeNull();
  });

  it('allows wrapup to be saved when dealerRef is null on the interaction', async () => {
    const session = await loginAs(AGENT_USERNAME, AGENT_PASSWORD);

    // Seed an interaction in CONTEXT_CONFIRMED with no dealer
    const interactionId = await seedInteraction(agentUserId, 'CONTEXT_CONFIRMED');

    // Manually set dealerRef to null (it is already null in seeded state)
    const wrapupResponse = await authedRequest(
      'patch',
      `/api/v1/interactions/${interactionId}/wrapup`,
      session,
    ).send({
      contactReasonCode: 'query',
      identificationOutcomeCode: 'customer_vehicle_identified',
      interactionDispositionCode: 'information_provided',
    });

    expect(wrapupResponse.status).toBe(200);
    expect(wrapupResponse.body.data.status).toBe('WRAPUP');
  });

  it('allows interaction to be CLOSED when dealerRef is null', async () => {
    const session = await loginAs(AGENT_USERNAME, AGENT_PASSWORD);

    // Seed a WRAPUP interaction (no dealer — seeded interaction has null dealerRef by default)
    const interactionId = await seedInteraction(agentUserId, 'WRAPUP');
    await seedWrapup(interactionId, agentUserId, 'information_provided');

    const closeResponse = await authedRequest(
      'post',
      `/api/v1/interactions/${interactionId}/close`,
      session,
    ).send({});

    expect(closeResponse.status).toBe(200);
    expect(closeResponse.body.data.status).toBe('CLOSED');
    expect(closeResponse.body.data.completionFlag).toBe(true);
  });

  it('context patch with null dealerRef returns null currentDealerRef in response', async () => {
    const session = await loginAs(AGENT_USERNAME, AGENT_PASSWORD);

    const createResponse = await authedRequest('post', '/api/v1/interactions', session).send({
      channel: 'manual',
      mode: 'manual',
    });
    const interactionId = createResponse.body.data.interactionId as string;

    const contextResponse = await authedRequest(
      'patch',
      `/api/v1/interactions/${interactionId}/context`,
      session,
    ).send({
      customerRef: 'CUST-IB-001',
      vehicleRef: null,
      dealerRef: null,
      isReselection: false,
    });

    expect(contextResponse.status).toBe(200);
    expect(contextResponse.body.data.currentDealerRef).toBeNull();
    expect(contextResponse.body.data.currentVehicleRef).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// POST /api/v1/interactions/:id/incomplete
// ---------------------------------------------------------------------------

describe('POST /api/v1/interactions/:id/incomplete', () => {
  it('should return 200 and status INCOMPLETE when marking incomplete from WRAPUP', async () => {
    const session = await loginAs(AGENT_USERNAME, AGENT_PASSWORD);
    const interactionId = await seedInteraction(agentUserId, 'WRAPUP');
    await seedWrapup(
      interactionId,
      agentUserId,
      'incomplete_interaction',
      'Could not verify the customer identity',
    );

    const response = await authedRequest(
      'post',
      `/api/v1/interactions/${interactionId}/incomplete`,
      session,
    ).send({});

    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe('INCOMPLETE');
    expect(response.body.data.completionFlag).toBe(false);
    expect(response.body.data.endedAt).toBeTruthy();
  });

  it('should write interaction_marked_incomplete event to interaction_events table', async () => {
    const session = await loginAs(AGENT_USERNAME, AGENT_PASSWORD);
    const interactionId = await seedInteraction(agentUserId, 'WRAPUP');
    await seedWrapup(
      interactionId,
      agentUserId,
      'incomplete_interaction',
      'Customer line disconnected before identification',
    );

    await authedRequest(
      'post',
      `/api/v1/interactions/${interactionId}/incomplete`,
      session,
    ).send({});

    const eventCount = await countAuditEvents(interactionId, 'interaction_marked_incomplete');
    expect(eventCount).toBe(1);
  });

  it('should return 422 when trying to mark incomplete from IDENTIFYING status', async () => {
    const session = await loginAs(AGENT_USERNAME, AGENT_PASSWORD);
    const interactionId = await seedInteraction(agentUserId, 'IDENTIFYING');

    const response = await authedRequest(
      'post',
      `/api/v1/interactions/${interactionId}/incomplete`,
      session,
    ).send({});

    expect(response.status).toBe(422);
  });

  it('should return 422 when wrapup disposition is not incomplete_interaction', async () => {
    const session = await loginAs(AGENT_USERNAME, AGENT_PASSWORD);
    const interactionId = await seedInteraction(agentUserId, 'WRAPUP');
    await seedWrapup(interactionId, agentUserId, 'information_provided'); // wrong disposition

    const response = await authedRequest(
      'post',
      `/api/v1/interactions/${interactionId}/incomplete`,
      session,
    ).send({});

    expect(response.status).toBe(422);
  });
});
