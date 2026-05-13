// =============================================================================
// CCM API — Search Service
//
// Orchestrates Install Base (primary) → Customer Master (fallback) search.
// Source: phase1-technical-blueprint.md §5.12
//         CCM_Phase1_Agent_Interaction_Documentation.md §B3, §C3, §D3
// =============================================================================

import { InteractionStatus, SearchFilter } from '@ccm/types';
import { AppError } from '../../shared/errors/AppError';
import { logger } from '../../shared/logging/logger';
import { writeAuditEvent } from '../audit/audit.repository';
import { getInstallBaseAdapter, getCustomerMasterAdapter } from '../integration/adapterFactory';
import type { SearchResultItem } from '../integration/ISearchAdapter';
import { insertSearchAttempt, findInteractionStatusById } from './search.repository';
import { normalizeSearchValue } from './search.validator';

// Masking: expose first 3 + last 4 chars, rest replaced with *
export function maskChassisNumber(chassis: string): string {
  if (!chassis || chassis.length <= 7) return '****';
  const prefix = chassis.substring(0, 3);
  const suffix = chassis.substring(chassis.length - 4);
  const maskLen = chassis.length - 7;
  return `${prefix}${'*'.repeat(maskLen)}${suffix}`;
}

export interface SearchResultVehicleDto {
  vehicleRef: string;
  registrationNumber: string;
  modelName: string;
  variant: string;
  chassisNumberMasked: string;
  dealerRef: string | null;
}

export interface SearchResultItemDto {
  customerRef: string;
  customerName: string;
  primaryMobile: string;
  email: string | null;
  vehicles: SearchResultVehicleDto[];
  sourceSystem: 'INSTALL_BASE' | 'CUSTOMER_MASTER';
}

export interface SearchServiceResult {
  interactionId: string;
  searchAttemptId: string;
  filter: SearchFilter;
  normalizedValue: string;
  results: SearchResultItemDto[];
  resultCount: number;
  primarySourceUsed: 'INSTALL_BASE' | 'CUSTOMER_MASTER' | 'NONE';
  fallbackSourceUsed: boolean;
  outcomeStatus: string;
}

function toResultDto(item: SearchResultItem): SearchResultItemDto {
  return {
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
  };
}

export async function searchService(
  interactionId: string,
  filter: SearchFilter,
  rawValue: string,
  userId: string,
  correlationId: string,
): Promise<SearchServiceResult> {
  // Validate interaction exists and belongs to agent
  const interaction = await findInteractionStatusById(interactionId);
  if (!interaction) throw AppError.notFound('Interaction', interactionId);
  if (interaction.started_by_user_id !== userId) {
    throw AppError.forbidden('You do not have access to this interaction');
  }
  const SEARCHABLE_STATUSES = [InteractionStatus.IDENTIFYING, InteractionStatus.CONTEXT_CONFIRMED];
  if (!SEARCHABLE_STATUSES.includes(interaction.status as InteractionStatus)) {
    throw new AppError(
      'INVALID_STATUS_TRANSITION',
      `Cannot search when interaction is in ${interaction.status} status`,
      422,
    );
  }

  // Normalize search value (throws 422 on validation failure)
  const normalizedValue = normalizeSearchValue(filter, rawValue);

  // Write search_started event
  try {
    await writeAuditEvent({
      interactionId,
      eventName: 'search_started',
      actorUserId: userId,
      eventPayload: { filter, normalizedValue },
      correlationId,
    });
  } catch (auditErr) {
    logger.error('Failed to write search_started event', {
      module: 'search.service',
      correlationId,
      message: auditErr instanceof Error ? auditErr.message : String(auditErr),
    });
  }

  let results: SearchResultItem[] = [];
  let primarySourceUsed: 'INSTALL_BASE' | 'CUSTOMER_MASTER' | 'NONE' = 'NONE';
  let fallbackSourceUsed = false;
  let outcomeStatus = 'no_results';

  try {
    // Step 1: Search Install Base
    const ibResults = await getInstallBaseAdapter().search(filter, normalizedValue);

    if (ibResults.length > 0) {
      results = ibResults;
      primarySourceUsed = 'INSTALL_BASE';
    } else {
      // Step 2: Fall back to Customer Master (only when IB returns nothing)
      // Registration number is exclusive to Install Base
      if (filter !== SearchFilter.REGISTRATION_NUMBER) {
        const cmResults = await getCustomerMasterAdapter().search(filter, normalizedValue);
        if (cmResults.length > 0) {
          results = cmResults;
          primarySourceUsed = 'CUSTOMER_MASTER';
          fallbackSourceUsed = true;
        }
      } else {
        primarySourceUsed = 'INSTALL_BASE'; // IB was queried, just no results
      }
    }

    outcomeStatus = results.length > 0 ? 'results_found' : 'no_results';
  } catch (adapterErr) {
    logger.error('Search adapter error', {
      module: 'search.service',
      correlationId,
      filter,
      message: adapterErr instanceof Error ? adapterErr.message : String(adapterErr),
    });
    outcomeStatus = 'error';
    // Return empty results rather than 500-ing the client
  }

  // Write search_attempts row
  let searchAttemptId = '';
  try {
    const attempt = await insertSearchAttempt({
      interactionId,
      searchFilterCode: filter,
      rawValue,
      normalizedValue,
      attemptedByUserId: userId,
      resultCount: results.length,
      primarySourceUsed,
      fallbackSourceUsed,
      outcomeStatus,
    });
    searchAttemptId = attempt.id;
  } catch (dbErr) {
    logger.error('Failed to write search_attempts row', {
      module: 'search.service',
      correlationId,
      message: dbErr instanceof Error ? dbErr.message : String(dbErr),
    });
  }

  // Write search_result_returned event
  try {
    await writeAuditEvent({
      interactionId,
      eventName: 'search_result_returned',
      actorUserId: userId,
      eventPayload: {
        resultCount: results.length,
        outcomeStatus,
        primarySourceUsed,
        fallbackSourceUsed,
      },
      correlationId,
    });
  } catch (auditErr) {
    logger.error('Failed to write search_result_returned event', {
      module: 'search.service',
      correlationId,
      message: auditErr instanceof Error ? auditErr.message : String(auditErr),
    });
  }

  logger.info('Search completed', {
    module: 'search.service',
    correlationId,
    interactionId,
    filter,
    resultCount: results.length,
    outcomeStatus,
  });

  return {
    interactionId,
    searchAttemptId,
    filter,
    normalizedValue,
    results: results.map(toResultDto),
    resultCount: results.length,
    primarySourceUsed,
    fallbackSourceUsed,
    outcomeStatus,
  };
}
