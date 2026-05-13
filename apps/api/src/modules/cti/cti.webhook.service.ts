// =============================================================================
// CCM API — CTI Webhook Service
//
// Processes inbound TeleCMI webhook events (CDR and live events).
// Handles both inbound call CDRs (linked to interactions) and
// outbound click2call CDRs (standalone, logged in cti_call_logs only).
// =============================================================================

import { AgentStatus } from '@ccm/types';
import { getPool } from '../../shared/database/postgres';
import { logger } from '../../shared/logging/logger';
import { setSystemStatus } from '../agent-status/agent-status.service';
import type { TeleCmiWebhookPayload, TeleCmiWebhookCdr } from './cti.types';

export async function handleWebhookEvent(
  payload: TeleCmiWebhookPayload,
  correlationId?: string,
): Promise<void> {
  const cmiuuid = payload.cmiuuid ?? payload.conversation_uuid;
  const direction = payload.direction ?? 'inbound';
  // Derive a correlation ID from cmiuuid when the caller does not supply one.
  const resolvedCorrelationId = correlationId ?? cmiuuid ?? `cti-${Date.now()}`;

  if (payload.type === 'cdr' && direction === 'inbound') {
    if (!cmiuuid) {
      logger.warn('TeleCMI inbound CDR received with no cmiuuid', { payload });
      return;
    }
    const cdr = payload as TeleCmiWebhookCdr;
    const eventAt = new Date(payload.time ?? Date.now());
    await upsertCtiCallLog(cmiuuid, cdr, eventAt);

  } else if (payload.type === 'cdr' && direction === 'outbound') {
    const cdr = payload as TeleCmiWebhookCdr;
    const eventAt = new Date(payload.time ?? Date.now());
    await upsertOutboundCtiCallLog(cdr, eventAt);

  } else if (payload.type === 'event' && payload.status === 'waiting') {
    if (!cmiuuid) {
      logger.warn('TeleCMI waiting event received with no cmiuuid', { payload });
      return;
    }
    const eventAt = new Date(payload.time ?? Date.now());
    await insertWaitingEvent(cmiuuid, payload, eventAt);

  } else if (payload.type === 'event' && payload.status === 'started' && direction === 'inbound') {
    // Phase 1.5: Inbound call answered — set agent to on_call (CTI mode only)
    await handleInboundStarted(payload, resolvedCorrelationId);

  } else if (payload.type === 'event' && payload.status === 'hangup' && direction === 'inbound') {
    // Phase 1.5: Inbound call ended — set agent to wrap_up (CTI mode only)
    await handleInboundHangup(payload, resolvedCorrelationId);

  } else if (payload.type === 'event' && direction === 'outbound' && payload.status === 'hangup') {
    // Outbound live hangup: call was cancelled before being answered
    if (cmiuuid) {
      await getPool().query(
        `UPDATE cti_call_logs
         SET status = 'cancelled'
         WHERE cmiuuid = $1 AND answered_sec IS NULL`,
        [cmiuuid],
      );
      logger.info('Outbound call cancelled (hung up before answer)', {
        module: 'cti.webhook.service',
        cmiuuid,
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Phase 1.5: CTI live-event agent status helpers
// ---------------------------------------------------------------------------

interface AgentSessionRow {
  id: string;
  session_mode: string | null;
  status_code: string | null;
}

async function lookupAgentByTeleCmiId(telecmiAgentId: string): Promise<AgentSessionRow | null> {
  const result = await getPool().query<AgentSessionRow>(
    `SELECT u.id, u.session_mode, a.status_code
     FROM users u
     LEFT JOIN agent_statuses a ON a.user_id = u.id
     WHERE u.telecmi_agent_id = $1
       AND u.is_active = TRUE
     LIMIT 1`,
    [telecmiAgentId],
  );
  return result.rows[0] ?? null;
}

async function handleInboundStarted(
  payload: TeleCmiWebhookPayload,
  correlationId: string,
): Promise<void> {
  const telecmiAgentId = (payload as { from?: string }).from ?? null;
  if (!telecmiAgentId) {
    logger.warn('TeleCMI inbound started event has no from field — skipping status change', {
      module: 'cti.webhook.service',
      payload,
    });
    return;
  }

  const agent = await lookupAgentByTeleCmiId(telecmiAgentId);

  if (!agent) {
    logger.warn('TeleCMI inbound started: agent not found for telecmi_agent_id', {
      module: 'cti.webhook.service',
      telecmiAgentId,
    });
    return;
  }

  if (agent.session_mode !== 'cti') {
    logger.info('TeleCMI inbound started: agent is not in CTI mode — skipping status change', {
      module: 'cti.webhook.service',
      agentId: agent.id,
      sessionMode: agent.session_mode,
    });
    return;
  }

  await setSystemStatus(agent.id, AgentStatus.ON_CALL, correlationId);

  logger.info('TeleCMI inbound started: agent status set to on_call', {
    module: 'cti.webhook.service',
    agentId: agent.id,
    correlationId,
  });
}

async function handleInboundHangup(
  payload: TeleCmiWebhookPayload,
  correlationId: string,
): Promise<void> {
  const telecmiAgentId = (payload as { from?: string }).from ?? null;
  if (!telecmiAgentId) {
    logger.warn('TeleCMI inbound hangup event has no from field — skipping status change', {
      module: 'cti.webhook.service',
      payload,
    });
    return;
  }

  const agent = await lookupAgentByTeleCmiId(telecmiAgentId);

  if (!agent) {
    logger.warn('TeleCMI inbound hangup: agent not found for telecmi_agent_id', {
      module: 'cti.webhook.service',
      telecmiAgentId,
    });
    return;
  }

  if (agent.session_mode !== 'cti') {
    logger.info('TeleCMI inbound hangup: agent is not in CTI mode — skipping status change', {
      module: 'cti.webhook.service',
      agentId: agent.id,
      sessionMode: agent.session_mode,
    });
    return;
  }

  if (agent.status_code !== AgentStatus.ON_CALL) {
    logger.info('TeleCMI inbound hangup: agent is not on_call — skipping wrap_up transition', {
      module: 'cti.webhook.service',
      agentId: agent.id,
      currentStatus: agent.status_code,
    });
    return;
  }

  await setSystemStatus(agent.id, AgentStatus.WRAP_UP, correlationId);

  logger.info('TeleCMI inbound hangup: agent status set to wrap_up', {
    module: 'cti.webhook.service',
    agentId: agent.id,
    correlationId,
  });
}

// ---------------------------------------------------------------------------
// Inbound CDR upsert
// ---------------------------------------------------------------------------

async function upsertCtiCallLog(cmiuuid: string, cdr: TeleCmiWebhookCdr, eventAt: Date): Promise<void> {
  const pool = getPool();

  // Find linked interaction if answered.
  // Primary: match by cti_cmiuuid (set when piopiy exposes the SIP call_id).
  // Fallback: match by from_number + inbound_call channel + started in last
  //           5 minutes — covers cases where piopiyjs did not expose a usable
  //           cmiuuid and the interaction was created with an empty cmiuuid.
  let interactionId: string | null = null;
  if (cdr.status === 'answered') {
    const fromNum = String(cdr.from ?? '');
    const intResult = await pool.query<{ id: string }>(
      `WITH ranked AS (
         SELECT id, 1 AS priority
           FROM interactions
          WHERE cti_cmiuuid = $1

         UNION ALL

         SELECT id, 2 AS priority
           FROM interactions
          WHERE (cti_cmiuuid IS NULL OR cti_cmiuuid = '')
            AND cti_from_number = $2
            AND channel = 'inbound_call'
            AND started_at >= NOW() - INTERVAL '30 minutes'
            AND status NOT IN ('CLOSED', 'INCOMPLETE')
       )
       SELECT id FROM ranked
       ORDER BY priority ASC
       LIMIT 1`,
      [cmiuuid, fromNum],
    );
    if (intResult.rows.length > 0) {
      interactionId = intResult.rows[0].id;
      // If matched via fallback, stamp the real cmiuuid on the interaction
      // so future CDR updates find it directly.
      if (interactionId) {
        await pool.query(
          `UPDATE interactions SET cti_cmiuuid = $1, updated_at = NOW()
           WHERE id = $2 AND (cti_cmiuuid IS NULL OR cti_cmiuuid = '')`,
          [cmiuuid, interactionId],
        );
      }
    }
  }

  await pool.query(
    `INSERT INTO cti_call_logs (
       cmiuuid, conversation_uuid, direction, status,
       from_number, to_number, virtual_number,
       telecmi_agent_id, interaction_id,
       answered_sec, duration_sec, recording_filename,
       hangup_reason, team, ivr_name,
       raw_payload, event_at
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
     ON CONFLICT (cmiuuid) DO UPDATE SET
       status             = EXCLUDED.status,
       telecmi_agent_id   = COALESCE(EXCLUDED.telecmi_agent_id, cti_call_logs.telecmi_agent_id),
       interaction_id     = COALESCE(EXCLUDED.interaction_id, cti_call_logs.interaction_id),
       answered_sec       = COALESCE(EXCLUDED.answered_sec, cti_call_logs.answered_sec),
       duration_sec       = COALESCE(EXCLUDED.duration_sec, cti_call_logs.duration_sec),
       recording_filename = COALESCE(EXCLUDED.recording_filename, cti_call_logs.recording_filename),
       hangup_reason      = COALESCE(EXCLUDED.hangup_reason, cti_call_logs.hangup_reason),
       raw_payload        = EXCLUDED.raw_payload`,
    [
      cmiuuid,
      cdr.conversation_uuid ?? null,
      cdr.direction,
      cdr.status,
      String(cdr.from ?? ''),
      cdr.to != null ? String(cdr.to) : null,
      cdr.virtual_number != null ? String(cdr.virtual_number) : null,
      cdr.user ?? null,
      interactionId,
      cdr.answeredsec ?? null,
      cdr.billsec ?? null,
      cdr.filename ?? null,
      cdr.hangup_reason ?? null,
      cdr.team ?? null,
      cdr.ivr_name ?? null,
      JSON.stringify(cdr),
      eventAt,
    ],
  );

  // Write audit event if interaction is linked
  if (interactionId && cdr.status === 'answered') {
    await pool.query(
      `INSERT INTO interaction_events (interaction_id, event_name, event_at, actor_user_id, event_payload_json, correlation_id)
       SELECT $1, 'cti_call_cdr_received', NOW(), started_by_user_id, $2::jsonb, correlation_id
       FROM interactions WHERE id = $1`,
      [interactionId, JSON.stringify({ cmiuuid, duration_sec: cdr.billsec, status: cdr.status })],
    );
  }
}

// ---------------------------------------------------------------------------
// Outbound CDR upsert
//
// Outbound CDR may arrive in two legs:
//   Leg A — agent's SIP leg (direction=outbound, leg='a')
//   Leg B — destination PSTN leg (direction=outbound, leg='b')
// Both share the same cmiuuid.
//
// For the initial insert we use the pending row created by click2call
// (identified by request_id). The cmiuuid is then stamped on that row.
// ---------------------------------------------------------------------------

async function upsertOutboundCtiCallLog(cdr: TeleCmiWebhookCdr, eventAt: Date): Promise<void> {
  const pool = getPool();
  const cmiuuid = cdr.cmiuuid ?? cdr.conversation_uuid;

  if (!cmiuuid) {
    logger.warn('TeleCMI outbound CDR received with no cmiuuid', {
      module: 'cti.webhook.service',
      cdr: { direction: cdr.direction, status: cdr.status, request_id: cdr.request_id },
    });
    return;
  }

  logger.info('TeleCMI outbound CDR received', {
    module: 'cti.webhook.service',
    cmiuuid,
    leg: cdr.leg,
    status: cdr.status,
    billsec: cdr.billsec,
    request_id: cdr.request_id,
  });

  // ── Step 1: If a pending row exists by request_id, stamp it with cmiuuid ─
  if (cdr.request_id) {
    const updateResult = await pool.query(
      `UPDATE cti_call_logs
       SET cmiuuid = $1
       WHERE request_id = $2 AND cmiuuid LIKE 'outbound-pending-%'`,
      [cmiuuid, cdr.request_id],
    );
    // CCM-OPS-CTI-01: if rowCount=0, no pending row was found for this request_id.
    // Step 2 will insert a new row — this row is an orphan (not linked to the agent
    // who initiated the call). Operations must investigate and reconcile.
    // Pre-flight query: SELECT * FROM cti_call_logs WHERE request_id = '<id>'
    if ((updateResult.rowCount ?? 0) === 0) {
      logger.warn('Outbound CDR: no pending cti_call_logs row found for request_id — creating orphan row', {
        module: 'cti.webhook.service',
        cmiuuid,
        request_id: cdr.request_id,
        action: 'orphan_row_created',
        // ops_ticket: 'CCM-OPS-CTI-01'
      });
    }
  }

  // ── Step 2: Upsert using cmiuuid as conflict target ──────────────────────
  await pool.query(
    `INSERT INTO cti_call_logs (
       cmiuuid, conversation_uuid, direction, status,
       from_number, to_number,
       telecmi_agent_id, request_id,
       answered_sec, duration_sec, recording_filename,
       hangup_reason, raw_payload, event_at
     ) VALUES ($1,$2,'outbound',$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
     ON CONFLICT (cmiuuid) DO UPDATE SET
       status             = EXCLUDED.status,
       telecmi_agent_id   = COALESCE(EXCLUDED.telecmi_agent_id, cti_call_logs.telecmi_agent_id),
       request_id         = COALESCE(cti_call_logs.request_id, EXCLUDED.request_id),
       answered_sec       = COALESCE(EXCLUDED.answered_sec, cti_call_logs.answered_sec),
       duration_sec       = COALESCE(EXCLUDED.duration_sec, cti_call_logs.duration_sec),
       recording_filename = COALESCE(EXCLUDED.recording_filename, cti_call_logs.recording_filename),
       hangup_reason      = COALESCE(EXCLUDED.hangup_reason, cti_call_logs.hangup_reason),
       raw_payload        = EXCLUDED.raw_payload`,
    [
      cmiuuid,
      cdr.conversation_uuid ?? null,
      cdr.status,
      String(cdr.callerid ?? cdr.from ?? ''),
      cdr.to != null ? String(cdr.to) : null,
      cdr.user ?? null,
      cdr.request_id ?? null,
      cdr.answeredsec ?? null,
      cdr.billsec ?? null,
      cdr.filename ?? null,
      cdr.hangup_reason ?? null,
      JSON.stringify(cdr),
      eventAt,
    ],
  );
}

// ---------------------------------------------------------------------------
// Inbound waiting event insert
// ---------------------------------------------------------------------------

async function insertWaitingEvent(cmiuuid: string, payload: TeleCmiWebhookPayload, eventAt: Date): Promise<void> {
  await getPool().query(
    `INSERT INTO cti_call_logs (cmiuuid, direction, status, from_number, to_number, raw_payload, event_at)
     VALUES ($1, 'inbound', 'waiting', $2, $3, $4, $5)
     ON CONFLICT (cmiuuid) DO NOTHING`,
    [
      cmiuuid,
      payload.from ?? null,
      payload.to ?? null,
      JSON.stringify(payload),
      eventAt,
    ],
  );
}

