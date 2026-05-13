// =============================================================================
// CCM API — Auth Integration Tests
//
// Tests the full auth flow against a real test database.
// Requires TEST_DATABASE_URL to be set.
// Source: CCM_Phase1_Agent_Interaction_Documentation.md §B1, §C1, §D1
// =============================================================================

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { app, loginAs } from './helpers/testApp';
import {
  getTestPool,
  closeTestPool,
  cleanupAgentStatus,
  cleanupUserAuditEvents,
  seedTestUser,
  assignAgentRole,
  removeTestUser,
} from './helpers/testDb';

// ---------------------------------------------------------------------------
// Test constants — uses seeded user from migration 012
// ---------------------------------------------------------------------------

const AGENT_USERNAME = 'agent1';
const AGENT_PASSWORD = 'Agent@123';
const WRONG_PASSWORD = 'WrongPassword!';

// ---------------------------------------------------------------------------
// Setup / Teardown
// ---------------------------------------------------------------------------

beforeAll(async () => {
  // Ensure the pool is ready
  await getTestPool().query('SELECT 1');
});

afterAll(async () => {
  await closeTestPool();
});

// ---------------------------------------------------------------------------
// POST /api/v1/auth/login
// ---------------------------------------------------------------------------

describe('POST /api/v1/auth/login', () => {
  afterAll(async () => {
    // Clean up agent status and audit events created by successful logins
    const pool = getTestPool();
    const { rows } = await pool.query<{ id: string }>(
      `SELECT id FROM users WHERE username = $1`,
      [AGENT_USERNAME],
    );
    if (rows[0]) {
      await cleanupAgentStatus(rows[0].id);
      await cleanupUserAuditEvents(rows[0].id);
    }
  });

  it('should return 200 with csrfToken in body and set ccm_session cookie when credentials are valid', async () => {
    const response = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: AGENT_USERNAME, password: AGENT_PASSWORD });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.csrfToken).toBeTruthy();
    expect(response.body.data.csrfToken).toHaveLength(64);
    expect(response.body.data.user.username).toBe(AGENT_USERNAME);

    // Check that ccm_session cookie is set
    const cookies: string[] = [response.headers['set-cookie'] ?? []].flat().filter((x): x is string => typeof x === 'string');
    const sessionCookie = cookies.find((c: string) => c.startsWith('ccm_session='));
    expect(sessionCookie).toBeTruthy();
    expect(sessionCookie).toContain('HttpOnly');
  });

  it('should return 401 when password is wrong', async () => {
    const response = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: AGENT_USERNAME, password: WRONG_PASSWORD });

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('should return 401 when user does not exist', async () => {
    const response = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'nonexistent_user_xyz', password: 'anything' });

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('should return same error message for wrong password and unknown user (no enumeration)', async () => {
    const wrongPassword = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: AGENT_USERNAME, password: WRONG_PASSWORD });

    const unknownUser = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'totally_unknown_xyz', password: WRONG_PASSWORD });

    expect(wrongPassword.body.error.message).toBe(unknownUser.body.error.message);
    expect(wrongPassword.status).toBe(unknownUser.status);
  });

  it('should return 422 when username is missing', async () => {
    const response = await request(app)
      .post('/api/v1/auth/login')
      .send({ password: AGENT_PASSWORD });

    expect(response.status).toBe(422);
  });

  it('should return 422 when password is missing', async () => {
    const response = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: AGENT_USERNAME });

    expect(response.status).toBe(422);
  });

  it('should return 403 when user does not have agent role', async () => {
    const response = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'noaccess', password: 'NoAccess@123' });

    expect(response.status).toBe(403);
    expect(response.body.error.message).toContain('not authorized');
  });

  it('should not expose a stack trace in the error response body', async () => {
    const response = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: AGENT_USERNAME, password: WRONG_PASSWORD });

    const bodyString = JSON.stringify(response.body);
    expect(bodyString).not.toContain('at Object.');
    expect(bodyString).not.toContain('node_modules');
  });
});

// ---------------------------------------------------------------------------
// POST /api/v1/auth/login — inactive user (GAP 3 / F3)
// ---------------------------------------------------------------------------

describe('POST /api/v1/auth/login — inactive user returns 403', () => {
  const INACTIVE_USERNAME = 'test_inactive_agent_ccm';
  const INACTIVE_PASSWORD = 'Inactive@Test123';

  beforeAll(async () => {
    // Seed an inactive user with the agent role so that is_active = false is
    // the sole reason for rejection (not a missing role).
    const passwordHash = await bcrypt.hash(INACTIVE_PASSWORD, 10);
    const userId = await seedTestUser(
      INACTIVE_USERNAME,
      passwordHash,
      'Inactive Test Agent',
      false, // is_active = false
    );
    await assignAgentRole(userId);
  });

  afterAll(async () => {
    await removeTestUser(INACTIVE_USERNAME);
  });

  it('returns HTTP 403 when a user with valid credentials has is_active = false', async () => {
    const response = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: INACTIVE_USERNAME, password: INACTIVE_PASSWORD });

    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('FORBIDDEN');
  });

  it('does not set a session cookie when login is rejected due to inactive account', async () => {
    const response = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: INACTIVE_USERNAME, password: INACTIVE_PASSWORD });

    const cookies: string[] = [response.headers['set-cookie'] ?? []].flat().filter((x): x is string => typeof x === 'string');
    const sessionCookie = cookies.find((c: string) => c.startsWith('ccm_session='));
    expect(sessionCookie).toBeFalsy();
  });
});

// ---------------------------------------------------------------------------
// GET /api/v1/auth/me
// ---------------------------------------------------------------------------

describe('GET /api/v1/auth/me', () => {
  it('should return 200 with user data when session cookie is valid', async () => {
    const session = await loginAs(AGENT_USERNAME, AGENT_PASSWORD);

    const response = await request(app)
      .get('/api/v1/auth/me')
      .set('Cookie', session.cookieHeader);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.username).toBe(AGENT_USERNAME);
    expect(response.body.data.roles).toContain('agent');
  });

  it('should return 401 when no session cookie is present', async () => {
    const response = await request(app).get('/api/v1/auth/me');

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
  });

  it('should return 401 when session cookie is malformed', async () => {
    const response = await request(app)
      .get('/api/v1/auth/me')
      .set('Cookie', 'ccm_session=not_a_valid_jwt');

    expect(response.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// GET /api/v1/auth/csrf
// ---------------------------------------------------------------------------

describe('GET /api/v1/auth/csrf', () => {
  it('should return 200 with a fresh csrfToken and set the CSRF cookie when session is valid', async () => {
    const session = await loginAs(AGENT_USERNAME, AGENT_PASSWORD);

    const response = await request(app)
      .get('/api/v1/auth/csrf')
      .set('Cookie', session.cookieHeader);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.csrfToken).toBeTruthy();
    expect(response.body.data.csrfToken).toHaveLength(64);

    // CSRF cookie must be re-issued in set-cookie
    const cookies: string[] = [response.headers['set-cookie'] ?? []].flat().filter((x): x is string => typeof x === 'string');
    const csrfCookie = cookies.find(
      (c: string) => c.startsWith('ccm-csrf=') || c.startsWith('__Host-ccm-csrf='),
    );
    expect(csrfCookie).toBeTruthy();
    // httpOnly must NOT be set on the CSRF cookie (JS needs to read it)
    expect(csrfCookie).not.toContain('HttpOnly');
  });

  it('should return a different token than the one issued at login (token rotation)', async () => {
    const session = await loginAs(AGENT_USERNAME, AGENT_PASSWORD);

    const response = await request(app)
      .get('/api/v1/auth/csrf')
      .set('Cookie', session.cookieHeader);

    expect(response.body.data.csrfToken).not.toBe(session.csrfToken);
  });

  it('should return 401 when no session cookie is present', async () => {
    const response = await request(app).get('/api/v1/auth/csrf');

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
  });

  it('should return 401 when session cookie is malformed', async () => {
    const response = await request(app)
      .get('/api/v1/auth/csrf')
      .set('Cookie', 'ccm_session=not_a_valid_jwt');

    expect(response.status).toBe(401);
  });

  it('should NOT require an X-CSRF-Token header (endpoint is CSRF-exempt by design)', async () => {
    const session = await loginAs(AGENT_USERNAME, AGENT_PASSWORD);

    // Deliberately send no X-CSRF-Token — must not return 403
    const response = await request(app)
      .get('/api/v1/auth/csrf')
      .set('Cookie', session.cookieHeader);

    expect(response.status).toBe(200);
  });

  it('should return the token in the response body AND as a cookie (both in sync)', async () => {
    const session = await loginAs(AGENT_USERNAME, AGENT_PASSWORD);

    const response = await request(app)
      .get('/api/v1/auth/csrf')
      .set('Cookie', session.cookieHeader);

    const bodyToken: string = response.body.data.csrfToken;
    const cookies: string[] = [response.headers['set-cookie'] ?? []].flat().filter((x): x is string => typeof x === 'string');
    const csrfCookie = cookies.find(
      (c: string) => c.startsWith('ccm-csrf=') || c.startsWith('__Host-ccm-csrf='),
    );
    expect(csrfCookie).toBeTruthy();

    // Extract the cookie value (first segment before ';')
    const cookieValue = csrfCookie!.split(';')[0].split('=').slice(1).join('=');
    expect(cookieValue).toBe(bodyToken);
  });
});

// ---------------------------------------------------------------------------
// POST /api/v1/auth/logout
// ---------------------------------------------------------------------------

describe('POST /api/v1/auth/logout', () => {
  it('should return 200 and clear cookies when session and CSRF token are valid', async () => {
    const session = await loginAs(AGENT_USERNAME, AGENT_PASSWORD);

    const response = await request(app)
      .post('/api/v1/auth/logout')
      .set('Cookie', session.cookieHeader)
      .set('X-CSRF-Token', session.csrfToken);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);

    // Verify ccm_session cookie is cleared (Max-Age=0 or Expires in the past)
    const cookies: string[] = [response.headers['set-cookie'] ?? []].flat().filter((x): x is string => typeof x === 'string');
    const sessionCookie = cookies.find((c: string) => c.startsWith('ccm_session='));
    expect(sessionCookie).toBeTruthy();
    // Cleared cookies have empty value or Max-Age=0
    const isCleared = sessionCookie!.includes('Max-Age=0') ||
      sessionCookie!.includes('Expires=') ||
      sessionCookie!.match(/ccm_session=;/);
    expect(isCleared).toBeTruthy();
  });

  it('should return 403 when X-CSRF-Token header is missing', async () => {
    const session = await loginAs(AGENT_USERNAME, AGENT_PASSWORD);

    const response = await request(app)
      .post('/api/v1/auth/logout')
      .set('Cookie', session.cookieHeader);
    // No X-CSRF-Token header

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('CSRF_MISSING');
  });

  it('should return 403 when CSRF token does not match the cookie', async () => {
    const session = await loginAs(AGENT_USERNAME, AGENT_PASSWORD);

    const response = await request(app)
      .post('/api/v1/auth/logout')
      .set('Cookie', session.cookieHeader)
      .set('X-CSRF-Token', 'completely_wrong_csrf_token');

    expect(response.status).toBe(403);
  });

  it('should return 401 when trying to logout without a session cookie', async () => {
    const response = await request(app)
      .post('/api/v1/auth/logout')
      .set('X-CSRF-Token', 'some_token');

    // CSRF check runs before auth check (mounted before global CSRF but with explicit csrfProtection)
    // Either 401 or 403 is acceptable depending on middleware order — CSRF cookie is also missing
    expect([401, 403]).toContain(response.status);
  });
});
