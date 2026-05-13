// =============================================================================
// CCM API — Audit Trail Integration Tests
//
// Verifies that each workflow action produces the required audit event in
// the interaction_events table. These tests are the primary guard against
// silent audit gaps.
// Source: CCM_Phase1_Agent_Interaction_Documentation.md §C10, §D10
// =============================================================================

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
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

  const { rows } = await getTestPool().query<{ id: string }>(
    `SELECT id FROM users WHERE username = $1`,
    [AGENT_USERNAME],
  );
  agentUserId = rows[0]!.id;
});

beforeEach(async () => {
  await cleanupInteractions(agentUserId);
});

afterAll(async () => {
  await cleanupInteractions(agentUserId);
  await cleanupAgentStatus(agentUserId);
  await cleanupUserAuditEvents(agentUserId);
  await closeTestPool();
});

// ---------------------------------------------------------------------------
// interaction_created event
// ---------------------------------------------------------------------------

describe('Audit: interaction_created', () => {
  it('should write interaction_created event after POST /api/v1/interactions', async () => {
    const session = await loginAs(AGENT_USERNAME, AGENT_PASSWORD);

    const response = await authedRequest('post', '/api/v1/interactions', session).send({
      channel: 'manual',
      mode: 'manual',
    });

    expect(response.status).toBe(201);
    const interactionId = response.body.data.interactionId as string;

    const count = await countAuditEvents(interactionId, 'interaction_created');
    expect(count).toBe(1);
  });

  it('should store actor_user_id on the interaction_created event', async () => {
    const session = await loginAs(AGENT_USERNAME, AGENT_PASSWORD);

    const response = await authedRequest('post', '/api/v1/interactions', session).send({
      channel: 'manual',
      mode: 'manual',
    });

    const interactionId = response.body.data.interactionId as string;

    const { rows } = await getTestPool().query<{ actor_user_id: string }>(
      `SELECT actor_user_id FROM interaction_events WHERE interaction_id = $1 AND event_name = 'interaction_created'`,
      [interactionId],
    );

    expect(rows[0]!.actor_user_id).toBe(agentUserId);
  });
});

// ---------------------------------------------------------------------------
// search_started + search_result_returned events
// ---------------------------------------------------------------------------

describe('Audit: search_started and search_result_returned', () => {
  it('should write search_started event after POST /api/v1/search', async () => {
    const session = await loginAs(AGENT_USERNAME, AGENT_PASSWORD);
    const interactionId = await seedInteraction(agentUserId, 'IDENTIFYING');

    await authedRequest('post', '/api/v1/search', session).send({
      interactionId,
      filter: 'mobile',
      value: '9876543210',
    });

    const count = await countAuditEvents(interactionId, 'search_started');
    expect(count).toBeGreaterThanOrEqual(1);
  });

  it('should write search_result_returned event after POST /api/v1/search', async () => {
    const session = await loginAs(AGENT_USERNAME, AGENT_PASSWORD);
    const interactionId = await seedInteraction(agentUserId, 'IDENTIFYING');

    await authedRequest('post', '/api/v1/search', session).send({
      interactionId,
      filter: 'mobile',
      value: '9876543210',
    });

    const count = await countAuditEvents(interactionId, 'search_result_returned');
    expect(count).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// customer_selected / vehicle_selected / dealer_loaded events
// ---------------------------------------------------------------------------

describe('Audit: customer_selected, vehicle_selected, dealer_loaded', () => {
  it('should write customer_selected event after PATCH /api/v1/interactions/:id/context with isReselection=false', async () => {
    const session = await loginAs(AGENT_USERNAME, AGENT_PASSWORD);
    const interactionId = await seedInteraction(agentUserId, 'IDENTIFYING');

    await authedRequest('patch', `/api/v1/interactions/${interactionId}/context`, session).send({
      customerRef: 'CUST-IB-001',
      vehicleRef: 'VEH-IB-001',
      dealerRef: 'DLR-001',
      isReselection: false,
    });

    const count = await countAuditEvents(interactionId, 'customer_selected');
    expect(count).toBeGreaterThanOrEqual(1);
  });

  it('should write vehicle_selected event when vehicleRef is provided', async () => {
    const session = await loginAs(AGENT_USERNAME, AGENT_PASSWORD);
    const interactionId = await seedInteraction(agentUserId, 'IDENTIFYING');

    await authedRequest('patch', `/api/v1/interactions/${interactionId}/context`, session).send({
      customerRef: 'CUST-IB-001',
      vehicleRef: 'VEH-IB-001',
      dealerRef: null,
      isReselection: false,
    });

    const count = await countAuditEvents(interactionId, 'vehicle_selected');
    expect(count).toBeGreaterThanOrEqual(1);
  });

  it('should write dealer_loaded event when dealerRef is provided', async () => {
    const session = await loginAs(AGENT_USERNAME, AGENT_PASSWORD);
    const interactionId = await seedInteraction(agentUserId, 'IDENTIFYING');

    await authedRequest('patch', `/api/v1/interactions/${interactionId}/context`, session).send({
      customerRef: 'CUST-IB-001',
      vehicleRef: 'VEH-IB-001',
      dealerRef: 'DLR-001',
      isReselection: false,
    });

    const count = await countAuditEvents(interactionId, 'dealer_loaded');
    expect(count).toBeGreaterThanOrEqual(1);
  });

  it('should write customer_reselected event when isReselection=true', async () => {
    const session = await loginAs(AGENT_USERNAME, AGENT_PASSWORD);
    const interactionId = await seedInteraction(agentUserId, 'CONTEXT_CONFIRMED');

    await authedRequest('patch', `/api/v1/interactions/${interactionId}/context`, session).send({
      customerRef: 'CUST-IB-002',
      vehicleRef: 'VEH-IB-002',
      dealerRef: 'DLR-002',
      isReselection: true,
    });

    const count = await countAuditEvents(interactionId, 'customer_reselected');
    expect(count).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// disposition_saved event
// ---------------------------------------------------------------------------

describe('Audit: disposition_saved', () => {
  it('should write disposition_saved event after PATCH /api/v1/interactions/:id/wrapup', async () => {
    const session = await loginAs(AGENT_USERNAME, AGENT_PASSWORD);
    const interactionId = await seedInteraction(agentUserId, 'CONTEXT_CONFIRMED');

    await authedRequest('patch', `/api/v1/interactions/${interactionId}/wrapup`, session).send({
      contactReasonCode: 'query',
      identificationOutcomeCode: 'customer_vehicle_identified',
      interactionDispositionCode: 'information_provided',
    });

    const count = await countAuditEvents(interactionId, 'disposition_saved');
    expect(count).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// interaction_closed event
// ---------------------------------------------------------------------------

describe('Audit: interaction_closed', () => {
  it('should write interaction_closed event after POST /api/v1/interactions/:id/close', async () => {
    const session = await loginAs(AGENT_USERNAME, AGENT_PASSWORD);
    const interactionId = await seedInteraction(agentUserId, 'WRAPUP');
    await seedWrapup(interactionId, agentUserId, 'information_provided');

    await authedRequest('post', `/api/v1/interactions/${interactionId}/close`, session).send({});

    const count = await countAuditEvents(interactionId, 'interaction_closed');
    expect(count).toBe(1);
  });

  it('should store the end timestamp in the interaction_closed event payload', async () => {
    const session = await loginAs(AGENT_USERNAME, AGENT_PASSWORD);
    const interactionId = await seedInteraction(agentUserId, 'WRAPUP');
    await seedWrapup(interactionId, agentUserId, 'information_provided');

    await authedRequest('post', `/api/v1/interactions/${interactionId}/close`, session).send({});

    const { rows } = await getTestPool().query<{ event_payload_json: { endedAt: string } }>(
      `SELECT event_payload_json FROM interaction_events WHERE interaction_id = $1 AND event_name = 'interaction_closed'`,
      [interactionId],
    );

    expect(rows[0]!.event_payload_json.endedAt).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// interaction_marked_incomplete event
// ---------------------------------------------------------------------------

describe('Audit: interaction_marked_incomplete', () => {
  it('should write interaction_marked_incomplete event after POST /api/v1/interactions/:id/incomplete', async () => {
    const session = await loginAs(AGENT_USERNAME, AGENT_PASSWORD);
    const interactionId = await seedInteraction(agentUserId, 'WRAPUP');
    await seedWrapup(
      interactionId,
      agentUserId,
      'incomplete_interaction',
      'Customer dropped the call',
    );

    await authedRequest(
      'post',
      `/api/v1/interactions/${interactionId}/incomplete`,
      session,
    ).send({});

    const count = await countAuditEvents(interactionId, 'interaction_marked_incomplete');
    expect(count).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// agent_status_changed event — stored with interaction_id = NULL
// ---------------------------------------------------------------------------

describe('Audit: agent_status_changed', () => {
  it('should write agent_status_changed event with NULL interaction_id after status update', async () => {
    await cleanupUserAuditEvents(agentUserId);

    const session = await loginAs(AGENT_USERNAME, AGENT_PASSWORD);
    await cleanupUserAuditEvents(agentUserId); // clear login event

    await authedRequest('patch', '/api/v1/agent/status', session).send({
      status: 'ready_for_calls',
    });

    const count = await countAuditEvents(null, 'agent_status_changed');
    expect(count).toBeGreaterThanOrEqual(1);
  });

  it('should store actor_user_id on the agent_status_changed event', async () => {
    await cleanupUserAuditEvents(agentUserId);

    const session = await loginAs(AGENT_USERNAME, AGENT_PASSWORD);
    await cleanupUserAuditEvents(agentUserId); // clear login event

    await authedRequest('patch', '/api/v1/agent/status', session).send({
      status: 'break',
    });

    const { rows } = await getTestPool().query<{ actor_user_id: string }>(
      `SELECT actor_user_id FROM interaction_events
       WHERE interaction_id IS NULL AND event_name = 'agent_status_changed'
       ORDER BY event_at DESC LIMIT 1`,
    );

    expect(rows[0]!.actor_user_id).toBe(agentUserId);
  });

  it('should store the new status in the event payload', async () => {
    await cleanupUserAuditEvents(agentUserId);

    const session = await loginAs(AGENT_USERNAME, AGENT_PASSWORD);
    await cleanupUserAuditEvents(agentUserId);

    await authedRequest('patch', '/api/v1/agent/status', session).send({
      status: 'training',
    });

    const { rows } = await getTestPool().query<{
      event_payload_json: { newStatus: string; previousStatus: string };
    }>(
      `SELECT event_payload_json FROM interaction_events
       WHERE interaction_id IS NULL AND event_name = 'agent_status_changed'
       ORDER BY event_at DESC LIMIT 1`,
    );

    expect(rows[0]!.event_payload_json.newStatus).toBe('training');
  });
});

// ---------------------------------------------------------------------------
// Event structure invariants
// ---------------------------------------------------------------------------

describe('Audit event structure invariants', () => {
  it('should store event_at timestamp on all written events', async () => {
    const session = await loginAs(AGENT_USERNAME, AGENT_PASSWORD);

    const response = await authedRequest('post', '/api/v1/interactions', session).send({
      channel: 'manual',
      mode: 'manual',
    });

    const interactionId = response.body.data.interactionId as string;

    const { rows } = await getTestPool().query<{ event_at: Date }>(
      `SELECT event_at FROM interaction_events WHERE interaction_id = $1 AND event_name = 'interaction_created'`,
      [interactionId],
    );

    expect(rows[0]!.event_at).toBeInstanceOf(Date);
  });

  it('should store correlation_id on interaction_created event', async () => {
    const correlationId = 'test-correlation-' + Date.now();
    const session = await loginAs(AGENT_USERNAME, AGENT_PASSWORD);

    const response = await authedRequest('post', '/api/v1/interactions', session)
      .set('X-Correlation-ID', correlationId)
      .send({ channel: 'manual', mode: 'manual' });

    const interactionId = response.body.data.interactionId as string;

    const { rows } = await getTestPool().query<{ correlation_id: string }>(
      `SELECT correlation_id FROM interaction_events WHERE interaction_id = $1 AND event_name = 'interaction_created'`,
      [interactionId],
    );

    expect(rows[0]!.correlation_id).toBe(correlationId);
  });
});
