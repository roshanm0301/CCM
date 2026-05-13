// =============================================================================
// CCM API — Test App Helper
//
// Creates the Express application for integration tests without binding a port.
// Provides a loginAs helper that performs a full login and returns session
// cookie and CSRF token for use in subsequent test requests.
// =============================================================================

import request, { type Response } from 'supertest';

// We need to set up environment variables before importing the app.
// The config module reads process.env at import time, so these must be set
// before the first import of anything that transitively imports config.

function setTestEnv(): void {
  const testUrl = process.env['TEST_DATABASE_URL'];
  if (!testUrl) {
    throw new Error(
      'TEST_DATABASE_URL is not set. Copy apps/api/.env.test.example to apps/api/.env.test.',
    );
  }

  // Parse TEST_DATABASE_URL → individual POSTGRES_* vars that config.ts expects
  // Format: postgresql://user:password@host:port/dbname
  const url = new URL(testUrl);
  process.env['POSTGRES_HOST'] = url.hostname;
  process.env['POSTGRES_PORT'] = url.port || '5432';
  process.env['POSTGRES_DB'] = url.pathname.replace(/^\//, '');
  process.env['POSTGRES_USER'] = url.username;
  process.env['POSTGRES_PASSWORD'] = url.password;

  if (!process.env['JWT_SECRET']) {
    process.env['JWT_SECRET'] = 'test-secret-that-is-at-least-32-characters-long';
  }

  if (!process.env['NODE_ENV']) {
    process.env['NODE_ENV'] = 'test';
  }

  // MongoDB env vars required by config validation — set dummies for tests
  // since MongoDB is not used in Phase 1 integration tests
  process.env['MONGO_HOST'] = process.env['MONGO_HOST'] ?? 'localhost';
  process.env['MONGO_PORT'] = process.env['MONGO_PORT'] ?? '27017';
  process.env['MONGO_DB'] = process.env['MONGO_DB'] ?? 'ccm_test';
  process.env['MONGO_USER'] = process.env['MONGO_USER'] ?? 'ccm';
  process.env['MONGO_PASSWORD'] = process.env['MONGO_PASSWORD'] ?? 'ccm';
  process.env['CORS_ALLOWED_ORIGINS'] = 'http://localhost:8080';
}

// Set env before importing app
setTestEnv();

// Dynamic import to ensure env is set before config is loaded
// eslint-disable-next-line @typescript-eslint/no-require-imports
const app = require('../../app').default;

export { app };

// ---------------------------------------------------------------------------
// Cookie name helper — must match auth.controller.ts logic
// In test environment, NODE_ENV = 'test' (not production) so plain name is used
// ---------------------------------------------------------------------------
export const SESSION_COOKIE_NAME = 'ccm_session';
export const CSRF_COOKIE_NAME = 'ccm-csrf';

// ---------------------------------------------------------------------------
// loginAs helper
// ---------------------------------------------------------------------------

export interface LoginSession {
  /** Full Set-Cookie header value for the session cookie — pass in subsequent requests */
  cookieHeader: string;
  /** CSRF token string — pass as X-CSRF-Token header in mutations */
  csrfToken: string;
  /** The session cookie name */
  sessionCookie: string;
  /** Raw response for assertions if needed */
  loginResponse: Response;
}

/**
 * Perform a login request and return the session cookie and CSRF token.
 *
 * @param username - the test user's username
 * @param password - the test user's password (plaintext)
 */
export async function loginAs(username: string, password: string): Promise<LoginSession> {
  const response = await request(app)
    .post('/api/v1/auth/login')
    .set('Content-Type', 'application/json')
    .send({ username, password });

  if (response.status !== 200) {
    throw new Error(
      `loginAs failed for user '${username}': status ${response.status} — ${JSON.stringify(response.body)}`,
    );
  }

  // Extract cookie header for ccm_session
  const setCookieHeader: string[] = [response.headers['set-cookie'] ?? []].flat().filter((x): x is string => typeof x === 'string');

  const sessionCookieEntry = setCookieHeader.find((c: string) =>
    c.startsWith(`${SESSION_COOKIE_NAME}=`),
  );
  if (!sessionCookieEntry) {
    throw new Error(`loginAs: ${SESSION_COOKIE_NAME} cookie not found in response headers`);
  }

  // Get just the cookie value part (everything before the first ';')
  const sessionCookieValue = sessionCookieEntry.split(';')[0]!;

  // Also extract CSRF token from cookie for convenience
  const csrfCookieEntry = setCookieHeader.find((c: string) =>
    c.startsWith(`${CSRF_COOKIE_NAME}=`),
  );
  const csrfCookieValue = csrfCookieEntry?.split(';')[0]?.split('=')?.[1] ?? '';

  // Also grab from response body (the canonical location)
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  const csrfToken = (response.body?.data?.csrfToken as string | undefined) ?? csrfCookieValue;

  return {
    cookieHeader: sessionCookieValue,
    csrfToken,
    sessionCookie: SESSION_COOKIE_NAME,
    loginResponse: response,
  };
}

/**
 * Build a supertest request with authentication headers pre-set.
 * Use this for any authenticated mutation endpoint.
 *
 * @param method - HTTP method
 * @param url - endpoint path
 * @param session - result of loginAs()
 */
export function authedRequest(
  method: 'get' | 'post' | 'patch' | 'put' | 'delete',
  url: string,
  session: LoginSession,
) {
  return request(app)
    [method](url)
    .set('Cookie', session.cookieHeader)
    .set('X-CSRF-Token', session.csrfToken)
    .set('Content-Type', 'application/json');
}
