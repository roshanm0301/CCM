// =============================================================================
// CCM API — CTI Outbound Call Service
//
// Orchestrates outbound click2call: validates the agent, normalises the
// destination number, calls TeleCMI click2call API, and inserts the initial
// cti_call_logs row using request_id (cmiuuid is populated later by CDR webhook).
//
// Outbound calls are standalone resolution activities — no interaction is
// created. The cti_call_logs row is the only persistent record until the
// CDR webhook arrives.
//
// Source: CCM_Phase6_Resolution_Activities.md — outbound calling section
// =============================================================================

import { getPool } from '../../shared/database/postgres';
import { logger } from '../../shared/logging/logger';
import { getCtiConfig } from './cti.config';
import { initiateClick2Call } from './cti.client';
import type { InitiateOutboundCallInput } from './cti.types';

// ---------------------------------------------------------------------------
// Destination normalisation
//
// Accepted inputs:
//   - 10-digit Indian mobile number (e.g. "9876543210")  → prepend "91"
//   - 12-digit full E.164 number without + (e.g. "919876543210")  → use as-is
//   - +91 prefixed input (e.g. "+919876543210")  → strip + then validate
//
// Returns the normalised digit string or null if the input cannot be parsed.
// ---------------------------------------------------------------------------

function normaliseDestination(raw: string): string | null {
  // Strip all non-digit characters (spaces, dashes, parens, +)
  const digits = raw.replace(/\D/g, '');

  if (digits.length === 10) {
    // Indian 10-digit number — prepend country code
    return `91${digits}`;
  }
  if (digits.length === 12 && digits.startsWith('91')) {
    // Already has country code
    return digits;
  }
  if (digits.length === 11 && digits.startsWith('0')) {
    // 0XXXXXXXXXX Indian format — replace leading 0 with 91
    return `91${digits.slice(1)}`;
  }
  // Cannot normalise
  return null;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export interface InitiateOutboundCallResult {
  requestId: string;
  destination: string;
}

export async function initiateOutboundCallService(
  userId: string,
  input: InitiateOutboundCallInput,
  correlationId: string,
): Promise<InitiateOutboundCallResult> {
  const config = getCtiConfig();
  const pool = getPool();

  // ── 1. Fetch agent TeleCMI provisioning ─────────────────────────────────
  const userResult = await pool.query<{
    telecmi_agent_id: string | null;
    telecmi_extension: number | null;
    telecmi_phone_number: string | null;
  }>(
    'SELECT telecmi_agent_id, telecmi_extension, telecmi_phone_number FROM users WHERE id = $1 LIMIT 1',
    [userId],
  );

  if (userResult.rows.length === 0) {
    logger.warn('Outbound call: user not found', { module: 'cti.outbound.service', userId, correlationId });
    const err = new Error('User not found') as Error & { statusCode: number; code: string };
    err.statusCode = 404;
    err.code = 'NOT_FOUND';
    throw err;
  }

  const user = userResult.rows[0];
  if (!user.telecmi_agent_id || !user.telecmi_extension) {
    logger.warn('Outbound call: agent not provisioned in TeleCMI', {
      module: 'cti.outbound.service',
      userId,
      correlationId,
    });
    const err = new Error('Agent is not provisioned in TeleCMI — cannot initiate outbound call') as Error & { statusCode: number; code: string };
    err.statusCode = 404;
    err.code = 'CTI_AGENT_NOT_PROVISIONED';
    throw err;
  }

  // ── 2. Normalise & validate destination ─────────────────────────────────
  const normalised = normaliseDestination(input.destination);
  if (!normalised) {
    logger.warn('Outbound call: invalid destination', {
      module: 'cti.outbound.service',
      destination: input.destination,
      correlationId,
    });
    const err = new Error(
      `Invalid destination number '${input.destination}'. Provide a 10-digit Indian mobile number or a full E.164 number (without +).`,
    ) as Error & { statusCode: number; code: string };
    err.statusCode = 422;
    err.code = 'INVALID_DESTINATION';
    throw err;
  }

  const destinationNum = parseInt(normalised, 10);

  // ── 3. Build user_id for click2call ─────────────────────────────────────
  // TeleCMI click2call user_id format: "{extension}_{appId}"
  const telecmiUserId = `${user.telecmi_extension}_${config.appId}`;

  // Caller ID: use configured DID, fall back to agent phone number
  const callerIdStr = config.callerId || user.telecmi_phone_number || '';
  const callerId = callerIdStr ? parseInt(callerIdStr.replace(/\D/g, ''), 10) : undefined;

  // ── 4. Call TeleCMI click2call API ───────────────────────────────────────
  const clickResponse = await initiateClick2Call({
    user_id: telecmiUserId,
    secret: config.appSecret,
    to: destinationNum,
    webrtc: true,
    extra_params: { ccm: true },
    ...(callerId ? { callerid: callerId } : {}),
  });

  const requestId = clickResponse.request_id ?? clickResponse.call_id ?? '';

  logger.info('Outbound call initiated via click2call', {
    module: 'cti.outbound.service',
    userId,
    telecmiAgentId: user.telecmi_agent_id,
    destination: normalised,
    requestId,
    correlationId,
  });

  // ── 5. Insert initial cti_call_logs row ──────────────────────────────────
  // cmiuuid is NOT available yet — it will be populated by the CDR webhook.
  // The request_id is the only link at this stage.
  // We use a placeholder cmiuuid derived from request_id to satisfy the
  // NOT NULL constraint; the CDR upsert will overwrite it.
  const placeholderCmiuuid = `outbound-pending-${requestId || correlationId}`;

  await pool.query(
    `INSERT INTO cti_call_logs (
       cmiuuid, direction, status,
       from_number, to_number,
       telecmi_agent_id, request_id,
       raw_payload, event_at
     ) VALUES ($1, 'outbound', 'waiting', $2, $3, $4, $5, $6, NOW())
     ON CONFLICT (cmiuuid) DO NOTHING`,
    [
      placeholderCmiuuid,
      callerIdStr || null,
      normalised,
      user.telecmi_agent_id,
      requestId || null,
      JSON.stringify({
        source: 'click2call',
        userId,
        destination: normalised,
        requestId,
        correlationId,
      }),
    ],
  );

  return { requestId, destination: normalised };
}
