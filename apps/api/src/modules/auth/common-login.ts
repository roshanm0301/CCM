// =============================================================================
// CCM API — Shared Login Helpers
//
// Extracted from auth.service.ts and dealer-auth.service.ts to eliminate the
// duplicated credential-verification and token-generation code that is common
// to both the agent and dealer login flows.
//
// Source: CCM code quality remediation plan — Wave 3 W3-1
// =============================================================================

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { config } from '../../config/index';
import { AppError } from '../../shared/errors/AppError';
import { logger } from '../../shared/logging/logger';
import { findUserByUsername } from './auth.repository';
import type { JwtPayload } from './auth.service';

// ---------------------------------------------------------------------------
// verifyCredentials
// ---------------------------------------------------------------------------

/**
 * Steps 1–3 of both login flows: look up the user, compare the password, and
 * check the account is active. Throws a typed AppError on any failure so the
 * calling service can proceed directly to its role-specific logic.
 *
 * Deliberately uses a generic 401 error for user-not-found and password
 * mismatch to avoid username enumeration.
 */
export async function verifyCredentials(
  username: string,
  password: string,
  correlationId: string,
  module: string,
): Promise<Awaited<ReturnType<typeof findUserByUsername>> & object> {
  // Step 1: look up user
  const user = await findUserByUsername(username);

  if (!user) {
    logger.warn('Login failed: user not found', { module, correlationId, username });
    throw new AppError('INVALID_CREDENTIALS', 'Invalid credentials. Please try again.', 401);
  }

  // Step 2: compare password
  const passwordMatch = await bcrypt.compare(password, user.password_hash);
  if (!passwordMatch) {
    logger.warn('Login failed: password mismatch', { module, correlationId, userId: user.id });
    throw new AppError('INVALID_CREDENTIALS', 'Invalid credentials. Please try again.', 401);
  }

  // Step 3: check account is active
  if (!user.is_active) {
    logger.warn('Login failed: account inactive', { module, correlationId, userId: user.id });
    throw new AppError('FORBIDDEN', 'Your account is inactive.', 403);
  }

  return user;
}

// ---------------------------------------------------------------------------
// signJwt
// ---------------------------------------------------------------------------

/**
 * Signs a JWT with the standard CCM payload shape using the configured secret
 * and expiry. Used by both agent and dealer login flows.
 */
export function signJwt(userId: string, username: string, roles: string[]): string {
  const payload: JwtPayload = { userId, username, roles };
  return jwt.sign(payload, config.jwtSecret, {
    expiresIn: config.jwtExpiry as string,
  } as jwt.SignOptions);
}

// ---------------------------------------------------------------------------
// generateCsrfToken
// ---------------------------------------------------------------------------

/**
 * Generates a cryptographically random 32-byte hex CSRF token. Used by both
 * login flows and the GET /csrf endpoint.
 */
export function generateCsrfToken(): string {
  return crypto.randomBytes(32).toString('hex');
}
