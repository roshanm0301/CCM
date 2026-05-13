// =============================================================================
// CCM API — Interaction Service
//
// Business logic: state machine enforcement, concurrent interaction guard,
// wrapup validation, audit event emission.
// Source: phase1-technical-blueprint.md §5.6–5.11
//         CCM_Phase1_Agent_Interaction_Documentation.md §B2–B8, §C2–C9
// =============================================================================

import { AgentStatus } from '@ccm/types';
import { getPool } from '../../shared/database/postgres';
import { AppError } from '../../shared/errors/AppError';
import { logger } from '../../shared/logging/logger';
import { writeAuditEvent } from '../audit/audit.repository';
import {
  findInteractionById,
  findOpenInteractionForAgent,
  createInteraction,
  updateInteractionContext,
  transitionToWrapup,
  closeInteraction,
  markInteractionIncomplete,
  upsertWrapup,
  findWrapupByInteractionId,
  findEventsByInteractionId,
  findReferenceValue,
  listInteractions,
  deleteInteractionById,
  InteractionListItem,
  InteractionRow,
  WrapupRow,
  EventRow,
} from './interaction.repository';
import { findUserById } from '../auth/auth.repository';
import { getAgentStatusByUserId } from '../agent-status/agent-status.repository';
import { setSystemStatus } from '../agent-status/agent-status.service';
import type { UpdateContextInput, SaveWrapupInput } from './interaction.validator';

// ---------------------------------------------------------------------------
// Allowed state transitions (guard table)
// ---------------------------------------------------------------------------
const CONTEXT_ALLOWED_STATUSES = ['IDENTIFYING', 'CONTEXT_CONFIRMED'];
const WRAPUP_ALLOWED_STATUSES = ['IDENTIFYING', 'CONTEXT_CONFIRMED', 'WRAPUP'];

// ---------------------------------------------------------------------------
// Response shapes
// ---------------------------------------------------------------------------

export interface InteractionDetail {
  id: string;
  status: string;
  channel: string;
  mode: string;
  startedAt: string;
  endedAt: string | null;
  completionFlag: boolean | null;
  currentCustomerRef: string | null;
  currentVehicleRef: string | null;
  currentDealerRef: string | null;
  correlationId: string;
  /** Caller PSTN number — populated for inbound_call interactions only. */
  ctiFromNumber: string | null;
  /** Customer phone number — populated for CTI calls from caller ID; for manual interactions from customer master at context confirmation. */
  customerPhoneNumber: string | null;
  wrapup: WrapupDto | null;
  events: EventDto[];
}

export interface WrapupDto {
  id: string;
  contactReasonCode: string;
  identificationOutcomeCode: string;
  interactionDispositionCode: string;
  remarks: string | null;
  savedAt: string;
}

export interface EventDto {
  id: string;
  eventName: string;
  eventAt: string;
  actorUserId: string;
  payload: Record<string, unknown> | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toWrapupDto(row: WrapupRow): WrapupDto {
  return {
    id: row.id,
    contactReasonCode: row.contact_reason_code,
    identificationOutcomeCode: row.identification_outcome_code,
    interactionDispositionCode: row.interaction_disposition_code,
    remarks: row.remarks,
    savedAt: row.saved_at.toISOString(),
  };
}

function toEventDto(row: EventRow): EventDto {
  return {
    id: row.id,
    eventName: row.event_name,
    eventAt: row.event_at.toISOString(),
    actorUserId: row.actor_user_id,
    payload: row.event_payload_json,
  };
}

function assertOwnership(interaction: InteractionRow, userId: string, correlationId: string): void {
  if (interaction.started_by_user_id !== userId) {
    logger.warn('Interaction ownership check failed', {
      module: 'interaction.service',
      correlationId,
      interactionId: interaction.id,
      ownerId: interaction.started_by_user_id,
      requestingUserId: userId,
    });
    throw AppError.forbidden('You do not have access to this interaction');
  }
}

// ---------------------------------------------------------------------------
// Create Interaction
// ---------------------------------------------------------------------------

export async function createInteractionService(
  userId: string,
  correlationId: string,
): Promise<{ interactionId: string; status: string; channel: string; mode: string; startedAt: string }> {
  // Concurrent interaction guard (outside the transaction — read-only check)
  const existing = await findOpenInteractionForAgent(userId);
  if (existing) {
    throw new AppError(
      'INTERACTION_ALREADY_ACTIVE',
      'You already have an open interaction.',
      409,
      { existingInteractionId: existing.id },
    );
  }

  // Acquire a client so that the interaction row and the audit event are written
  // atomically. If the process crashes between insert and audit write the entire
  // transaction rolls back — no silent audit gap.
  const pool = getPool();
  const client = await pool.connect();
  let interaction: Awaited<ReturnType<typeof createInteraction>>;

  try {
    await client.query('BEGIN');

    interaction = await createInteraction(userId, correlationId, client);

    await writeAuditEvent(
      {
        interactionId: interaction.id,
        eventName: 'interaction_created',
        actorUserId: userId,
        eventPayload: {
          status: 'IDENTIFYING',
          channel: interaction.channel,
          mode: interaction.mode,
        },
        correlationId,
      },
      client,
    );

    await client.query('COMMIT');
  } catch (err: unknown) {
    await client.query('ROLLBACK');
    // PostgreSQL exclusion_violation (23P01): a concurrent request inserted an
    // open interaction for the same agent between our guard check and INSERT.
    // Note: cast to { code?: string } — NodeJS.ErrnoException is the wrong type
    // for a pg driver error; pg errors carry a string 'code' property directly.
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

  logger.info('Interaction created', {
    module: 'interaction.service',
    correlationId,
    interactionId: interaction.id,
    userId,
  });

  return {
    interactionId: interaction.id,
    status: interaction.status,
    channel: interaction.channel,
    mode: interaction.mode,
    startedAt: interaction.started_at.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Get Interaction Detail
// ---------------------------------------------------------------------------

export async function getInteractionService(
  id: string,
  userId: string,
  correlationId: string,
): Promise<InteractionDetail> {
  const interaction = await findInteractionById(id);
  if (!interaction) {
    throw AppError.notFound('Interaction', id);
  }
  assertOwnership(interaction, userId, correlationId);

  const [wrapup, events] = await Promise.all([
    findWrapupByInteractionId(id),
    findEventsByInteractionId(id),
  ]);

  return {
    id: interaction.id,
    status: interaction.status,
    channel: interaction.channel,
    mode: interaction.mode,
    startedAt: interaction.started_at.toISOString(),
    endedAt: interaction.ended_at?.toISOString() ?? null,
    completionFlag: interaction.completion_flag,
    currentCustomerRef: interaction.current_customer_ref,
    currentVehicleRef: interaction.current_vehicle_ref,
    currentDealerRef: interaction.current_dealer_ref,
    correlationId: interaction.correlation_id,
    ctiFromNumber: interaction.cti_from_number ?? null,
    customerPhoneNumber: interaction.customer_phone_number ?? null,
    wrapup: wrapup ? toWrapupDto(wrapup) : null,
    events: events.map(toEventDto),
  };
}

// ---------------------------------------------------------------------------
// Update Context
// ---------------------------------------------------------------------------

export async function updateInteractionContextService(
  id: string,
  userId: string,
  input: UpdateContextInput,
  correlationId: string,
): Promise<{
  interactionId: string;
  status: string;
  currentCustomerRef: string;
  currentVehicleRef: string | null;
  currentDealerRef: string | null;
  updatedAt: string;
}> {
  const interaction = await findInteractionById(id);
  if (!interaction) throw AppError.notFound('Interaction', id);
  assertOwnership(interaction, userId, correlationId);

  if (!CONTEXT_ALLOWED_STATUSES.includes(interaction.status)) {
    throw new AppError(
      'INVALID_STATUS_TRANSITION',
      `Cannot update context when interaction is in ${interaction.status} status`,
      422,
    );
  }

  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const updated = await updateInteractionContext(
      id,
      input.customerRef,
      input.vehicleRef ?? null,
      input.dealerRef ?? null,
      input.customerPhoneNumber ?? null,
      client,
    );

    // Write audit events
    if (input.isReselection) {
      await writeAuditEvent(
        {
          interactionId: id,
          eventName: 'customer_reselected',
          actorUserId: userId,
          eventPayload: {
            customerRef: input.customerRef,
            vehicleRef: input.vehicleRef,
            dealerRef: input.dealerRef,
          },
          correlationId,
        },
        client,
      );
    } else {
      await writeAuditEvent(
        {
          interactionId: id,
          eventName: 'customer_selected',
          actorUserId: userId,
          eventPayload: { customerRef: input.customerRef },
          correlationId,
        },
        client,
      );

      if (input.vehicleRef) {
        await writeAuditEvent(
          {
            interactionId: id,
            eventName: 'vehicle_selected',
            actorUserId: userId,
            eventPayload: { vehicleRef: input.vehicleRef },
            correlationId,
          },
          client,
        );
      }

      if (input.dealerRef) {
        await writeAuditEvent(
          {
            interactionId: id,
            eventName: 'dealer_loaded',
            actorUserId: userId,
            eventPayload: { dealerRef: input.dealerRef },
            correlationId,
          },
          client,
        );
      }
    }

    await client.query('COMMIT');

    logger.info('Interaction context updated', {
      module: 'interaction.service',
      correlationId,
      interactionId: id,
      isReselection: input.isReselection,
    });

    return {
      interactionId: updated.id,
      status: updated.status,
      currentCustomerRef: updated.current_customer_ref!,
      currentVehicleRef: updated.current_vehicle_ref,
      currentDealerRef: updated.current_dealer_ref,
      updatedAt: updated.updated_at.toISOString(),
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ---------------------------------------------------------------------------
// Save Wrapup
// ---------------------------------------------------------------------------

export async function saveWrapupService(
  id: string,
  userId: string,
  input: SaveWrapupInput,
  correlationId: string,
): Promise<{ interactionId: string; status: string; wrapup: WrapupDto }> {
  const interaction = await findInteractionById(id);
  if (!interaction) throw AppError.notFound('Interaction', id);
  assertOwnership(interaction, userId, correlationId);

  if (!WRAPUP_ALLOWED_STATUSES.includes(interaction.status)) {
    throw new AppError(
      'INVALID_STATUS_TRANSITION',
      `Cannot save wrap-up when interaction is in ${interaction.status} status`,
      422,
    );
  }

  // Validate reference values
  const [contactReason, identificationOutcome, disposition] = await Promise.all([
    findReferenceValue('contact_reason', input.contactReasonCode),
    findReferenceValue('identification_outcome', input.identificationOutcomeCode),
    findReferenceValue('interaction_disposition', input.interactionDispositionCode),
  ]);

  if (!contactReason) {
    throw new AppError('VALIDATION_ERROR', `Invalid contact reason code: ${input.contactReasonCode}`, 422);
  }
  if (!identificationOutcome) {
    throw new AppError(
      'VALIDATION_ERROR',
      `Invalid identification outcome code: ${input.identificationOutcomeCode}`,
      422,
    );
  }
  if (!disposition) {
    throw new AppError(
      'VALIDATION_ERROR',
      `Invalid interaction disposition code: ${input.interactionDispositionCode}`,
      422,
    );
  }

  // Check if remarks are required for this disposition
  const remarksRequired = (disposition.metadata as Record<string, unknown> | null)?.['remarksRequired'] === true;
  if (remarksRequired && (!input.remarks || input.remarks.trim().length === 0)) {
    throw new AppError(
      'VALIDATION_ERROR',
      'Enter remarks for the selected disposition.',
      422,
    );
  }

  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Transition to WRAPUP if not already
    if (interaction.status !== 'WRAPUP') {
      await transitionToWrapup(id, client);
    }

    // Upsert wrapup record
    const wrapupRow = await upsertWrapup(
      id,
      input.contactReasonCode,
      input.identificationOutcomeCode,
      input.interactionDispositionCode,
      input.remarks ?? null,
      userId,
      client,
    );

    // Write disposition_saved event
    await writeAuditEvent(
      {
        interactionId: id,
        eventName: 'disposition_saved',
        actorUserId: userId,
        eventPayload: {
          contactReasonCode: input.contactReasonCode,
          identificationOutcomeCode: input.identificationOutcomeCode,
          interactionDispositionCode: input.interactionDispositionCode,
          hasRemarks: Boolean(input.remarks && input.remarks.trim().length > 0),
        },
        correlationId,
      },
      client,
    );

    await client.query('COMMIT');

    logger.info('Wrapup saved', {
      module: 'interaction.service',
      correlationId,
      interactionId: id,
    });

    return {
      interactionId: id,
      status: 'WRAPUP',
      wrapup: toWrapupDto(wrapupRow),
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ---------------------------------------------------------------------------
// Close Interaction
// ---------------------------------------------------------------------------

export async function closeInteractionService(
  id: string,
  userId: string,
  correlationId: string,
): Promise<{ interactionId: string; status: string; endedAt: string; completionFlag: boolean }> {
  const interaction = await findInteractionById(id);
  if (!interaction) throw AppError.notFound('Interaction', id);
  assertOwnership(interaction, userId, correlationId);

  if (interaction.status !== 'WRAPUP') {
    throw new AppError(
      'INVALID_STATUS_TRANSITION',
      'Interaction must be in WRAPUP status to close. Complete wrap-up before closing the interaction.',
      422,
    );
  }

  // Verify wrapup exists
  const wrapup = await findWrapupByInteractionId(id);
  if (!wrapup) {
    throw new AppError('VALIDATION_ERROR', 'Complete wrap-up before closing the interaction.', 422);
  }

  // Close endpoint is for productive outcomes — INCOMPLETE_INTERACTION goes through /incomplete
  if (wrapup.interaction_disposition_code === 'incomplete_interaction') {
    throw new AppError(
      'VALIDATION_ERROR',
      'Use the incomplete endpoint to mark this interaction as incomplete.',
      422,
    );
  }

  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const closed = await closeInteraction(id, client);

    await writeAuditEvent(
      {
        interactionId: id,
        eventName: 'interaction_closed',
        actorUserId: userId,
        eventPayload: { endedAt: closed.ended_at?.toISOString() },
        correlationId,
      },
      client,
    );

    await client.query('COMMIT');

    logger.info('Interaction closed', {
      module: 'interaction.service',
      correlationId,
      interactionId: id,
    });

    // Phase 1.5 CTI: auto-reset agent to ready_for_calls after wrapup close (CTI mode only)
    // Note: markIncompleteService has the same CTI auto-reset block — keep both in sync.
    // This runs OUTSIDE the transaction so a status-reset failure never rolls back the close.
    if (closed.started_by_user_id) {
      try {
        const agentUser = await findUserById(closed.started_by_user_id);
        if (agentUser?.session_mode === 'cti') {
          const agentStatus = await getAgentStatusByUserId(closed.started_by_user_id);
          if (agentStatus?.status_code === AgentStatus.WRAP_UP) {
            await setSystemStatus(
              closed.started_by_user_id,
              AgentStatus.READY_FOR_CALLS,
              correlationId,
            );
          }
        }
      } catch (resetErr) {
        logger.error('CTI auto-reset to ready_for_calls failed after close', {
          module: 'interaction.service',
          correlationId,
          interactionId: id,
          message: resetErr instanceof Error ? resetErr.message : String(resetErr),
        });
        // Non-fatal: the interaction is already closed — do not re-throw
      }
    }

    return {
      interactionId: closed.id,
      status: closed.status,
      endedAt: closed.ended_at!.toISOString(),
      completionFlag: true,
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ---------------------------------------------------------------------------
// Mark Incomplete
// ---------------------------------------------------------------------------

export async function markIncompleteService(
  id: string,
  userId: string,
  correlationId: string,
): Promise<{ interactionId: string; status: string; endedAt: string; completionFlag: boolean }> {
  const interaction = await findInteractionById(id);
  if (!interaction) throw AppError.notFound('Interaction', id);
  assertOwnership(interaction, userId, correlationId);

  if (interaction.status !== 'WRAPUP') {
    throw new AppError(
      'INVALID_STATUS_TRANSITION',
      'Interaction must be in WRAPUP status to mark as incomplete.',
      422,
    );
  }

  const wrapup = await findWrapupByInteractionId(id);
  if (!wrapup) {
    throw new AppError('VALIDATION_ERROR', 'Complete wrap-up before marking interaction as incomplete.', 422);
  }

  // Must have INCOMPLETE_INTERACTION as disposition
  if (wrapup.interaction_disposition_code !== 'incomplete_interaction') {
    throw new AppError(
      'VALIDATION_ERROR',
      'Select Incomplete Interaction as the disposition to use this endpoint.',
      422,
    );
  }

  // Remarks must be present.
  // Primary enforcement: saveWrapupService reads remarksRequired from the
  // incomplete_interaction metadata row (seeded TRUE) and rejects a save without
  // remarks. This check is defense-in-depth — it guards against direct DB writes
  // or seed data being incorrect.
  if (!wrapup.remarks || wrapup.remarks.trim().length === 0) {
    throw new AppError('VALIDATION_ERROR', 'Enter remarks for incomplete interaction.', 422);
  }

  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const incomplete = await markInteractionIncomplete(id, client);

    await writeAuditEvent(
      {
        interactionId: id,
        eventName: 'interaction_marked_incomplete',
        actorUserId: userId,
        eventPayload: { endedAt: incomplete.ended_at?.toISOString() },
        correlationId,
      },
      client,
    );

    await client.query('COMMIT');

    logger.info('Interaction marked incomplete', {
      module: 'interaction.service',
      correlationId,
      interactionId: id,
    });

    // Phase 1.5 CTI: auto-reset agent to ready_for_calls after interaction marked incomplete (CTI mode only).
    // This runs OUTSIDE the transaction so a status-reset failure never rolls back the incomplete mark.
    // Note: closeInteractionService has the same CTI auto-reset block — keep both in sync.
    if (incomplete.started_by_user_id) {
      try {
        const agentUser = await findUserById(incomplete.started_by_user_id);
        if (agentUser?.session_mode === 'cti') {
          const agentStatus = await getAgentStatusByUserId(incomplete.started_by_user_id);
          if (agentStatus?.status_code === AgentStatus.WRAP_UP) {
            await setSystemStatus(
              incomplete.started_by_user_id,
              AgentStatus.READY_FOR_CALLS,
              correlationId,
            );
          }
        }
      } catch (resetErr) {
        logger.error('CTI auto-reset to ready_for_calls failed after incomplete', {
          module: 'interaction.service',
          correlationId,
          interactionId: id,
          message: resetErr instanceof Error ? resetErr.message : String(resetErr),
        });
        // Non-fatal: the interaction is already marked incomplete — do not re-throw
      }
    }

    return {
      interactionId: incomplete.id,
      status: incomplete.status,
      endedAt: incomplete.ended_at!.toISOString(),
      completionFlag: false,
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ---------------------------------------------------------------------------
// List Interactions (Phase 1.5)
// ---------------------------------------------------------------------------

export interface InteractionListResult {
  items: Array<{
    interactionId: string;
    channel: string;
    status: string;
    startedAt: string;
    endedAt: string | null;
    agentName: string;
    customerName: string | null;
    customerRef: string | null;
    customerPhoneNumber: string | null;
  }>;
  total: number;
  page: number;
  pageSize: number;
}

/**
 * List interactions with optional status filter, free-text search, and pagination.
 *
 * Query param status values are mapped as follows:
 *   COMPLETE   → DB value 'CLOSED'
 *   INCOMPLETE → DB value 'INCOMPLETE'
 *   undefined  → no filter (all terminal statuses)
 *
 * search performs case-insensitive match on agent name or customer name.
 */
export async function listInteractionsService(params: {
  status?: 'INCOMPLETE' | 'COMPLETE';
  search?: string;
  page: number;
  pageSize: number;
}): Promise<InteractionListResult> {
  const { page, pageSize } = params;
  const offset = (page - 1) * pageSize;

  // Map client-facing status to DB value
  let dbStatus: 'CLOSED' | 'INCOMPLETE' | undefined;
  if (params.status === 'COMPLETE') {
    dbStatus = 'CLOSED';
  } else if (params.status === 'INCOMPLETE') {
    dbStatus = 'INCOMPLETE';
  }

  const { rows, total } = await listInteractions({
    status: dbStatus,
    search: params.search,
    limit: pageSize,
    offset,
  });

  return {
    items: rows.map((row: InteractionListItem) => ({
      interactionId: row.id,
      channel: row.channel,
      // Re-map CLOSED → COMPLETE for client-facing display
      status: row.status === 'CLOSED' ? 'COMPLETE' : row.status,
      startedAt: row.started_at instanceof Date ? row.started_at.toISOString() : String(row.started_at),
      endedAt: row.ended_at instanceof Date ? row.ended_at.toISOString() : (row.ended_at ? String(row.ended_at) : null),
      agentName: row.agent_name,
      customerName: row.customer_name,
      customerRef: row.customer_ref,
      customerPhoneNumber: row.customer_phone_number ?? null,
    })),
    total,
    page,
    pageSize,
  };
}

/** Permanently delete an interaction and all its cascade children. */
export async function deleteInteractionService(
  id: string,
  correlationId: string,
): Promise<void> {
  const found = await deleteInteractionById(id);
  if (!found) {
    throw AppError.notFound('Interaction', id);
  }
  logger.info('Interaction deleted', {
    module: 'interaction.service',
    correlationId,
    interactionId: id,
  });
}
