// =============================================================================
// CCM API — Dealer Auth Service
//
// Business logic for dealer workspace login.
//
// Differences from apps/api/src/modules/auth/auth.service.ts (agent login):
//   - Role guard: at least one role whose name starts with 'dealer_' is
//     required instead of the literal 'agent' role.
//   - No agent_statuses upsert — dealers have no agent presence/telephony.
//   - Returns `dealerRef` (users.external_user_ref) instead of `agentStatus`.
//   - Audit event written is 'dealer_login' (not 'agent_status_changed').
//
// Source: CCM_Phase6_Resolution_Activities.md — Dealer Catalog View / dealer login
// =============================================================================

import { AppError } from '../../shared/errors/AppError';
import { logger } from '../../shared/logging/logger';
import { getPool } from '../../shared/database/postgres';
import { findUserRoles } from '../auth/auth.repository';
import { writeAuditEvent } from '../audit/audit.repository';
import { verifyCredentials, signJwt, generateCsrfToken } from '../auth/common-login';
import { DEALER_ROLES } from '../../shared/constants/roles';

/**
 * Shape returned by dealerLoginService.
 *
 * `dealerRef` maps to users.external_user_ref and identifies the dealer outlet
 * or user in the external DMS / iDMS system. May be null if not yet linked.
 */
export interface DealerLoginResult {
  csrfToken: string;
  jwtToken: string;
  user: {
    id: string;
    username: string;
    displayName: string;
    roles: string[];
    dealerRef: string | null;
  };
}

/**
 * Fetch the external_user_ref column for a given user id.
 * This is a local query rather than a shared repository function because
 * external_user_ref is only relevant in the dealer auth context.
 */
async function findUserExternalRef(userId: string): Promise<string | null> {
  const result = await getPool().query<{ external_user_ref: string | null }>(
    'SELECT external_user_ref FROM users WHERE id = $1',
    [userId],
  );
  return result.rows[0]?.external_user_ref ?? null;
}

/**
 * Authenticate a dealer user and produce a JWT + CSRF token pair.
 *
 * Business rules:
 * - User must exist (generic error to avoid username enumeration)
 * - Password must match bcrypt hash
 * - User must be active (is_active = true)
 * - User must have at least one role whose name starts with 'dealer_'
 * - On success: write dealer_login audit event (non-blocking)
 * - Return JWT + CSRF token + user payload including dealerRef
 *
 * What this service deliberately does NOT do compared to agent login:
 * - No upsert into agent_statuses — dealers have no telephony/agent presence
 */
export async function dealerLoginService(
  username: string,
  password: string,
  correlationId: string,
): Promise<DealerLoginResult> {
  // Steps 1–3: look up user, verify password, check active — shared helper
  const user = await verifyCredentials(username, password, correlationId, 'dealer-auth.service');

  // Step 4: resolve roles — at least one must start with 'dealer_'
  const roles = await findUserRoles(user.id);
  const hasDealerRole = roles.some((r) => r.startsWith('dealer_'));
  if (!hasDealerRole) {
    logger.warn('Dealer login failed: user has no dealer role', {
      module: 'dealer-auth.service',
      correlationId,
      userId: user.id,
      roles,
      allowedPrefixedRoles: DEALER_ROLES,
    });
    throw new AppError('FORBIDDEN', 'You are not authorized for Dealer workspace.', 403);
  }

  // Step 5: fetch dealerRef (external_user_ref) — no agent_statuses upsert
  const dealerRef = await findUserExternalRef(user.id);

  // Step 6: write dealer_login audit event (non-blocking)
  try {
    await writeAuditEvent({
      interactionId: null,
      eventName: 'dealer_login',
      actorUserId: user.id,
      eventPayload: { dealerRef, trigger: 'login' },
      correlationId,
    });
  } catch (auditErr) {
    logger.error('Failed to write dealer login audit event', {
      module: 'dealer-auth.service',
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

  logger.info('Dealer login successful', {
    module: 'dealer-auth.service',
    correlationId,
    userId: user.id,
    username: user.username,
    dealerRef,
  });

  return {
    csrfToken,
    jwtToken,
    user: {
      id: user.id,
      username: user.username,
      displayName: user.display_name,
      roles,
      dealerRef,
    },
  };
}
