// =============================================================================
// CCM API — Audit Repository
//
// Append-only writes to the interaction_events table.
// This module is a leaf — it calls only shared/database.
// Source: phase1-technical-blueprint.md § 4.2 Module Ownership Rules (audit)
//         data-model-outline.md § interaction_events
// =============================================================================

import { PoolClient } from 'pg';
import { getPool } from '../../shared/database/postgres';
import { logger } from '../../shared/logging/logger';

// All approved event names — Phase 1 (matches DB CHECK constraint)
// Source: migration 008 (Phase 1)
export type AuditEventName =
  // Phase 1 events
  | 'interaction_created'
  | 'search_started'
  | 'search_result_returned'
  | 'customer_selected'
  | 'vehicle_selected'
  | 'dealer_loaded'
  | 'customer_reselected'
  | 'disposition_saved'
  | 'interaction_closed'
  | 'interaction_marked_incomplete'
  | 'agent_status_changed'
  | 'case_created'
  // Phase 6 events
  | 'dealer_login'
  | 'resolution_activity_saved'
  | 'case_closed'
  | 'followup_added';

export interface WriteEventParams {
  interactionId: string | null; // null for agent_status_changed events
  eventName: AuditEventName;
  actorUserId: string;
  eventPayload?: Record<string, unknown>;
  correlationId?: string;
}

/**
 * Write a single audit event. Uses the provided pool client when supplied
 * (for transactional writes) or acquires one from the pool otherwise.
 */
export async function writeAuditEvent(
  params: WriteEventParams,
  client?: PoolClient,
): Promise<void> {
  const { interactionId, eventName, actorUserId, eventPayload, correlationId } = params;

  const sql = `
    INSERT INTO interaction_events
      (interaction_id, event_name, actor_user_id, event_payload_json, correlation_id)
    VALUES ($1, $2, $3, $4, $5)
  `;

  const values = [
    interactionId,
    eventName,
    actorUserId,
    eventPayload ? JSON.stringify(eventPayload) : null,
    correlationId ?? null,
  ];

  try {
    if (client) {
      await client.query(sql, values);
    } else {
      await getPool().query(sql, values);
    }
  } catch (err) {
    // Audit write failure must not block the main flow — log and continue
    logger.error('Audit event write failed', {
      module: 'audit.repository',
      eventName,
      interactionId,
      actorUserId,
      correlationId,
      message: err instanceof Error ? err.message : String(err),
    });
    // Re-throw so the caller can decide whether to surface it
    throw err;
  }
}
