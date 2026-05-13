// =============================================================================
// CCM API — CTI Call Service
//
// Business logic for inbound call interaction creation, caller lookup,
// and SDK config retrieval.
// =============================================================================

import { AgentStatus, SearchFilter } from '@ccm/types';
import { getPool } from '../../shared/database/postgres';
import { AppError } from '../../shared/errors/AppError';
import { logger } from '../../shared/logging/logger';
import { createInteraction } from '../interaction/interaction.repository';
import { getAgentStatusByUserId } from '../agent-status/agent-status.repository';
import { getInstallBaseAdapter, getCustomerMasterAdapter } from '../integration/adapterFactory';
import { maskChassisNumber, type SearchResultItemDto } from '../search/search.service';
import { getCtiConfig } from './cti.config';
import type { CallerLookupResult, CreateInteractionFromCallInput } from './cti.types';

// ---------------------------------------------------------------------------
// Create Interaction From Call
// ---------------------------------------------------------------------------

export async function createInteractionFromCallService(
  userId: string,
  input: CreateInteractionFromCallInput,
  correlationId: string,
): Promise<{ interactionId: string; status: string; channel: string; mode: string; startedAt: string; customerContext: CallerLookupResult }> {
  // NOTE: The concurrent-interaction guard (findOpenInteractionForAgent / 409)
  // is intentionally NOT applied to CTI calls.  Agents must always be able to
  // receive an inbound call regardless of any existing interaction's status,
  // including WRAPUP or INCOMPLETE from a previous session.  The telephony
  // layer routes calls autonomously; blocking at the API level would strand
  // the caller and the agent with no recourse.  The frontend callStatus guard
  // (callStatus !== 'idle' in useCtiClient) is the correct layer for
  // preventing concurrent live calls.

  // Agent status guard — defense-in-depth.
  // The frontend rejects the call at inComingCall time if the agent is not
  // ready, so this should only fire in race conditions or direct API calls.
  const agentStatus = await getAgentStatusByUserId(userId);
  if (!agentStatus || agentStatus.status_code !== AgentStatus.READY_FOR_CALLS) {
    throw new AppError(
      'AGENT_NOT_AVAILABLE',
      'Agent is not in a ready state to accept calls.',
      422,
      { statusCode: agentStatus?.status_code ?? 'unknown' },
    );
  }

  const pool = getPool();
  const client = await pool.connect();
  let interactionId: string;
  let status: string;
  let channel: string;
  let mode: string;
  let startedAt: Date;

  try {
    await client.query('BEGIN');

    const interaction = await createInteraction(userId, correlationId, client, {
      channel: 'inbound_call',
      mode: 'inbound_call',
      ctiCmiuuid: input.cmiuuid,
      ctiFromNumber: input.fromNumber,
    });

    // Write cti_call_answered audit event directly (CTI event names not in
    // the legacy AuditEventName union — write directly to avoid type mismatch)
    await client.query(
      `INSERT INTO interaction_events (interaction_id, event_name, actor_user_id, event_payload_json, correlation_id)
       VALUES ($1, 'cti_call_answered', $2, $3::jsonb, $4)`,
      [
        interaction.id,
        userId,
        JSON.stringify({ cmiuuid: input.cmiuuid, fromNumber: input.fromNumber }),
        correlationId,
      ],
    );

    await client.query('COMMIT');

    interactionId = interaction.id;
    status = interaction.status;
    channel = interaction.channel;
    mode = interaction.mode;
    startedAt = interaction.started_at;
  } catch (err: unknown) {
    await client.query('ROLLBACK');
    if (
      err instanceof Error &&
      'code' in err &&
      (err as { code?: string }).code === '23P01'
    ) {
      throw new AppError(
        'INTERACTION_ALREADY_ACTIVE',
        'Agent already has an active interaction in progress',
        409,
      );
    }
    throw err;
  } finally {
    client.release();
  }

  logger.info('CTI interaction created', {
    module: 'cti.call.service',
    correlationId,
    interactionId,
    userId,
    cmiuuid: input.cmiuuid,
  });

  // Run caller lookup and if single match, set context refs
  const customerContext = await callerLookupService(input.fromNumber);

  return {
    interactionId,
    status,
    channel,
    mode,
    startedAt: startedAt.toISOString(),
    customerContext,
  };
}

// ---------------------------------------------------------------------------
// Caller Lookup
// ---------------------------------------------------------------------------

export async function callerLookupService(number: string): Promise<CallerLookupResult> {
  // Normalize: strip leading +91, 0, keep last 10 digits
  const digits = number.replace(/\D/g, '');
  let normalized = digits;
  if (digits.length > 10) {
    normalized = digits.slice(-10);
  }

  if (normalized.length === 0) {
    return { found: false };
  }

  try {
    // Try Install Base first
    let results = await getInstallBaseAdapter().search(SearchFilter.MOBILE, normalized);

    // Fall back to Customer Master if IB returns nothing
    if (results.length === 0) {
      results = await getCustomerMasterAdapter().search(SearchFilter.MOBILE, normalized);
    }

    if (results.length === 1) {
      const match = results[0];
      return {
        found: true,
        name: match.customerName,
        customerId: match.customerRef,
      };
    }

    return { found: results.length > 0 };
  } catch (err) {
    logger.error('CTI caller lookup failed', {
      module: 'cti.call.service',
      number,
      message: err instanceof Error ? err.message : String(err),
    });
    return { found: false };
  }
}

// ---------------------------------------------------------------------------
// Get SDK Config (for piopiyjs)
// ---------------------------------------------------------------------------

interface SdkConfigRow {
  telecmi_agent_id: string | null;
  telecmi_extension: number | null;
  telecmi_sip_password: string | null;
}

export async function getSdkConfigService(
  userId: string,
): Promise<{ telecmiAgentId: string; telecmiSipPassword: string; sbcUri: string }> {
  // SECURITY RISK ACCEPTANCE (documented per DA gate review):
  // The SIP password is returned in plaintext to the browser so piopiyjs can
  // authenticate directly with the TeleCMI SBC over WebRTC. This is an
  // inherent constraint of the piopiyjs SDK design — the password cannot be
  // kept server-side because piopiyjs runs in the browser.
  //
  // Compensating controls in place:
  // 1. Endpoint requires authenticated agent session (JWT cookie, HTTPOnly).
  // 2. Access is audit-logged below (agent + timestamp, NOT the password value).
  // 3. HTTPS (TLS) must be enforced at the nginx ingress layer so the response
  //    is encrypted in transit.
  // 4. Nginx access logs must strip the response body for this endpoint path
  //    (/api/v1/cti/sdk-config) to prevent the SIP password appearing in logs.
  //    nginx config: `location /api/v1/cti/sdk-config { access_log off; ... }`
  //    or log_format without $request_body.
  // 5. SIP passwords are rotated via POST /api/v1/cti/admin/users/:id/reprovision.

  const result = await getPool().query<SdkConfigRow>(
    'SELECT telecmi_agent_id, telecmi_extension, telecmi_sip_password FROM users WHERE id = $1 LIMIT 1',
    [userId],
  );

  const row = result.rows[0];
  if (!row || !row.telecmi_extension) {
    throw new AppError('NOT_FOUND', 'TeleCMI not configured for this agent', 404);
  }

  const config = getCtiConfig();

  // WebRTC SBC login user ID format required by piopiyjs: "{extension}_{appId}"
  // e.g.  "101_33335989"  — NOT the TeleCMI internal agent_id (e.g. "987654")
  const webrtcUserId = `${row.telecmi_extension}_${config.appId}`;

  // Audit log: record that SDK credentials were issued. Password value is NOT logged.
  logger.info('CTI SDK config issued', {
    module: 'cti.call.service',
    userId,
    telecmiAgentId: row.telecmi_agent_id,
    telecmiExtension: row.telecmi_extension,
    webrtcUserId,
    event: 'sdk_config_issued',
  });

  return {
    telecmiAgentId: webrtcUserId,         // piopiy.login(userId, ...) — must be {ext}_{appId}
    telecmiSipPassword: row.telecmi_sip_password ?? '',
    sbcUri: config.sbcUri,
  };
}

// ---------------------------------------------------------------------------
// Get Caller Context (for pre-fetch before interaction is created)
// ---------------------------------------------------------------------------

/**
 * Returns the full customer record(s) matching a caller's phone number,
 * in the same shape as the search service result.
 *
 * This is a lightweight, pre-interaction lookup — no interactionId is required,
 * no audit events are written, and no search_attempts row is inserted.
 * It exists solely to pre-populate the search panel before the agent answers
 * the call, so results appear instantly rather than requiring a manual search.
 *
 * Uses the same Install Base → Customer Master fallback as the main search.
 */
export async function getCallerContextService(
  number: string,
): Promise<SearchResultItemDto[]> {
  // Normalise: strip non-digits, keep last 10 digits (same as callerLookupService)
  const digits = number.replace(/\D/g, '');
  const normalized = digits.length > 10 ? digits.slice(-10) : digits;

  // Need at least 3 digits to avoid a wildcard-style full-table scan
  if (normalized.length < 3) return [];

  try {
    let results = await getInstallBaseAdapter().search(SearchFilter.MOBILE, normalized);

    if (results.length === 0) {
      results = await getCustomerMasterAdapter().search(SearchFilter.MOBILE, normalized);
    }

    return results.map((item) => ({
      customerRef: item.customerRef,
      customerName: item.customerName,
      primaryMobile: item.primaryMobile,
      email: item.email,
      vehicles: item.vehicles.map((v) => ({
        vehicleRef: v.vehicleRef,
        registrationNumber: v.registrationNumber,
        modelName: v.modelName,
        variant: v.variant,
        chassisNumberMasked: maskChassisNumber(v.chassisNumber),
        dealerRef: v.dealerRef,
      })),
      sourceSystem: item.sourceSystem,
    }));
  } catch (err) {
    logger.warn('getCallerContextService: adapter search failed', {
      module: 'cti.call.service',
      number: normalized,
      message: err instanceof Error ? err.message : String(err),
    });
    return [];
  }
}
