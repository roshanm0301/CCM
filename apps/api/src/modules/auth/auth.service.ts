// =============================================================================
// CCM API — Auth Service
//
// Business logic for login, logout, session management.
// Source: phase1-technical-blueprint.md §5.1–5.3
//         CCM_Phase1_Agent_Interaction_Documentation.md §B1, §C1, §D1
//
// TeleCMI provisioning hook — IMPORTANT for user management build-out:
// CCM does not yet have a user creation API (users are DB-seeded only).
// When a user management API is implemented, any user INSERT that assigns
// the 'agent' role must call:
//
//   import { provisionTeleCmiAgent } from '../cti/cti.agent.service';
//   provisionTeleCmiAgent(newUser.id).catch(() => { /* already logged */ });
//
// This must be fire-and-forget (do not await in the HTTP handler) so that
// TeleCMI provisioning failures never block CCM user creation.
// =============================================================================

import { config } from '../../config/index';
import { AppError } from '../../shared/errors/AppError';
import { logger } from '../../shared/logging/logger';
import {
  findUserRoles,
  upsertAgentStatusOffline,
  getAgentStatus,
  findUserDisplayName,
  findUserById,
  setSessionMode,
  clearSessionMode,
} from './auth.repository';
import { writeAuditEvent } from '../audit/audit.repository';
import { verifyCredentials, signJwt, generateCsrfToken } from './common-login';
import type { ActorContext } from '../../shared/middleware/authenticate';

export interface JwtPayload {
  userId: string;
  username: string;
  roles: string[];
}

export interface LoginResult {
  csrfToken: string;
  jwtToken: string;
  user: {
    id: string;
    username: string;
    displayName: string;
    roles: string[];
    agentStatus: string;
  };
}

/**
 * Shape returned by GET /api/v1/auth/me.
 *
 * NOTE: /me does NOT return a CSRF token. After a page refresh the caller must
 * follow up with GET /api/v1/auth/csrf (authenticate required, no CSRF required)
 * to obtain a fresh CSRF token and re-hydrate the client-side CSRF store.
 */
export interface MeResult {
  id: string;
  username: string;
  displayName: string;
  roles: string[];
  agentStatus: string;
  /** Phase 1.5: session mode selected at login. null = not yet selected. */
  sessionMode: 'manual' | 'cti' | null;
}

export interface CsrfResult {
  csrfToken: string;
}

/**
 * Authenticate the agent and produce a JWT + CSRF token pair.
 *
 * Business rules:
 * - User must exist
 * - Password must match bcrypt hash
 * - User must be active (is_active = true)
 * - User must have the 'agent' role
 * - On success: ensure agent_statuses row exists (offline)
 * - Write agent_status_changed audit event
 */
export async function loginService(
  username: string,
  password: string,
  correlationId: string,
): Promise<LoginResult> {
  // Steps 1–3: look up user, verify password, check active — shared helper
  const user = await verifyCredentials(username, password, correlationId, 'auth.service');

  // Step 4: resolve roles
  const roles = await findUserRoles(user.id);
  if (!roles.includes('agent')) {
    logger.warn('Login failed: user does not have agent role', {
      module: 'auth.service',
      correlationId,
      userId: user.id,
      roles,
    });
    throw new AppError('FORBIDDEN', 'You are not authorized for Agent workspace.', 403);
  }

  // Step 5: ensure agent_statuses row — always offline on login
  await upsertAgentStatusOffline(user.id);

  // Step 6: write agent_status_changed audit event (non-blocking)
  try {
    await writeAuditEvent({
      interactionId: null,
      eventName: 'agent_status_changed',
      actorUserId: user.id,
      eventPayload: { newStatus: 'offline', trigger: 'login' },
      correlationId,
    });
  } catch (auditErr) {
    logger.error('Failed to write login audit event', {
      module: 'auth.service',
      correlationId,
      userId: user.id,
      message: auditErr instanceof Error ? auditErr.message : String(auditErr),
    });
    // Do not block login on audit failure
  }

  // Step 7: sign JWT
  const jwtToken = signJwt(user.id, user.username, roles);

  // Step 8: generate CSRF token (cryptographically random)
  const csrfToken = generateCsrfToken();

  logger.info('Agent login successful', {
    module: 'auth.service',
    correlationId,
    userId: user.id,
    username: user.username,
  });

  return {
    csrfToken,
    jwtToken,
    user: {
      id: user.id,
      username: user.username,
      displayName: user.display_name,
      roles,
      agentStatus: 'offline',
    },
  };
}

/**
 * Generate a fresh CSRF token for an already-authenticated session.
 *
 * Called by GET /api/v1/auth/csrf after a page refresh, where the session
 * cookie is still valid but the in-memory CSRF token on the client has been
 * lost. The generated token is returned in the response body AND set as a
 * cookie by the controller so both storage locations are in sync.
 *
 * Uses the same generation strategy as loginService (32 random bytes, hex).
 */
export function getCsrfService(): CsrfResult {
  return { csrfToken: generateCsrfToken() };
}

/**
 * Resolve the current user from their JWT token payload.
 * Also fetches the current agent status from agent_statuses.
 */
export async function getMeService(actor: ActorContext): Promise<MeResult> {
  const [statusRow, displayName, userRow] = await Promise.all([
    getAgentStatus(actor.userId),
    findUserDisplayName(actor.userId),
    findUserById(actor.userId),
  ]);

  return {
    id: actor.userId,
    username: actor.username,
    displayName: displayName ?? actor.username,
    roles: actor.roles,
    agentStatus: statusRow?.status_code ?? 'offline',
    sessionMode: userRow?.session_mode ?? null,
  };
}

// ---------------------------------------------------------------------------
// Phase 1.5: Logout service — clears session_mode
// ---------------------------------------------------------------------------

/**
 * Performs server-side logout cleanup:
 * - Clears session_mode so the mode dialog reappears on next login.
 * - Emits a best-effort audit event.
 *
 * Cookie clearing is the controller's responsibility.
 */
export async function logoutService(userId: string, correlationId: string): Promise<void> {
  // Clear session_mode so dialog reappears on next login
  try {
    await clearSessionMode(userId);
  } catch (err) {
    logger.error('Failed to clear session_mode on logout', {
      module: 'auth.service',
      correlationId,
      userId,
      message: err instanceof Error ? err.message : String(err),
    });
    // Do not block logout on DB failure
  }

  // Best-effort audit event
  try {
    await writeAuditEvent({
      interactionId: null,
      eventName: 'agent_status_changed',
      actorUserId: userId,
      eventPayload: { trigger: 'logout' },
      correlationId,
    });
  } catch (auditErr) {
    logger.error('Failed to write logout audit event', {
      module: 'auth.service',
      correlationId,
      userId,
      message: auditErr instanceof Error ? auditErr.message : String(auditErr),
    });
  }
}

// ---------------------------------------------------------------------------
// Phase 1.5: Session mode service
// ---------------------------------------------------------------------------

/**
 * Persist the agent's chosen session mode (manual | cti).
 * Called by PATCH /api/v1/auth/session-mode.
 */
export async function setSessionModeService(
  userId: string,
  mode: 'manual' | 'cti',
  correlationId: string,
): Promise<{ sessionMode: string }> {
  await setSessionMode(userId, mode);

  logger.info('Agent session mode set', {
    module: 'auth.service',
    correlationId,
    userId,
    sessionMode: mode,
  });

  return { sessionMode: mode };
}
