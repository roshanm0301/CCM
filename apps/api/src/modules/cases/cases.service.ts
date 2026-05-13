// =============================================================================
// CCM API — Cases Service
//
// Business logic layer between controllers and repository.
// =============================================================================

import { Types } from 'mongoose';
import { InteractionChannel } from '@ccm/types';
import { AppError } from '../../shared/errors/AppError';
import {
  findCasesByCustomerRef,
  countOpenCases,
  findCaseById,
  findCaseByInteractionId,
  findDuplicateCase,
  createCase,
} from './cases.repository';
import type { CreateCaseInput } from './cases.validator';
import type { ICase } from '../../shared/models/case.model';
import { CaseModel } from '../../shared/models/case.model';
import { DealerModel } from '../../shared/models/dealer.model';
import { writeAuditEvent } from '../audit/audit.repository';
import { getPool } from '../../shared/database/postgres';
import {
  findCasesForDealer,
  type DealerCatalogFilters,
  type DealerCatalogItem,
} from './cases-dealer.repository';

// ---------------------------------------------------------------------------
// DTO shapes
// ---------------------------------------------------------------------------

export interface CaseHistoryItem {
  id: string;
  caseId: string;
  caseNature: string;
  caseStatus: string;
  activityStatus: string;
  registeredAt: string;
}

export interface CaseHistoryResponse {
  cases: CaseHistoryItem[];
  openCaseCount: number;
}

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  existingCase?: {
    caseId: string;
    caseNature: string;
    documentStatus: string;
    registeredAt: string;
  };
}

export interface CaseDto {
  id: string;
  caseId: string;
  interactionId: string;
  customerRef: string;
  vehicleRef: string | null;
  dealerRef: string;
  caseNature: string;
  department: string;
  priority: string | null;
  productType: string;
  productTypeSource: string;
  caseCategoryId: string;
  caseSubcategoryId: string;
  customerRemarks: string;
  agentRemarks: string;
  caseStatus: string;
  activityStatus: string;
  registeredAt: string;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Mapper
// ---------------------------------------------------------------------------

function toDto(doc: ICase): CaseDto {
  return {
    id:                (doc._id as Types.ObjectId).toString(),
    caseId:            doc.caseId,
    interactionId:     doc.interactionId,
    customerRef:       doc.customerRef,
    vehicleRef:        doc.vehicleRef ?? null,
    dealerRef:         doc.dealerRef?.toString() ?? '',
    caseNature:        doc.caseNature,
    department:        doc.department,
    priority:          doc.priority ?? null,
    productType:       doc.productType,
    productTypeSource: doc.productTypeSource,
    caseCategoryId:    doc.caseCategoryId.toString(),
    caseSubcategoryId: doc.caseSubcategoryId.toString(),
    customerRemarks:   doc.customerRemarks,
    agentRemarks:      doc.agentRemarks,
    caseStatus:        doc.caseStatus,
    activityStatus:    doc.activityStatus,
    registeredAt:      doc.registeredAt instanceof Date
      ? doc.registeredAt.toISOString()
      : new Date(doc.registeredAt).toISOString(),
    createdAt:         doc.createdAt instanceof Date
      ? doc.createdAt.toISOString()
      : new Date(doc.createdAt).toISOString(),
    updatedAt:         doc.updatedAt instanceof Date
      ? doc.updatedAt.toISOString()
      : new Date(doc.updatedAt).toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Service functions
// ---------------------------------------------------------------------------

/** Retrieve full case history for a customer, plus open case count. */
export async function getCaseHistoryService(customerRef: string): Promise<CaseHistoryResponse> {
  const [cases, openCaseCount] = await Promise.all([
    findCasesByCustomerRef(customerRef),
    countOpenCases(customerRef),
  ]);

  const items: CaseHistoryItem[] = cases.map((c) => ({
    id:             (c._id as Types.ObjectId).toString(),
    caseId:         c.caseId,
    caseNature:     c.caseNature,
    caseStatus:     c.caseStatus,
    activityStatus: c.activityStatus,
    registeredAt:   c.registeredAt instanceof Date
      ? c.registeredAt.toISOString()
      : new Date(c.registeredAt).toISOString(),
  }));

  return { cases: items, openCaseCount };
}

/** Check whether a duplicate open/pending case exists for the given parameters. */
export async function duplicateCheckService(params: {
  customerRef: string;
  vehicleRef?: string;
  caseNature: string;
  department: string;
  caseCategoryId: string;
  caseSubcategoryId: string;
}): Promise<DuplicateCheckResult> {
  const duplicate = await findDuplicateCase({
    customerRef:       params.customerRef,
    vehicleRef:        params.vehicleRef ?? null,
    caseNature:        params.caseNature,
    department:        params.department,
    caseCategoryId:    params.caseCategoryId,
    caseSubcategoryId: params.caseSubcategoryId,
  });

  if (!duplicate) {
    return { isDuplicate: false };
  }

  return {
    isDuplicate: true,
    existingCase: {
      caseId:         duplicate.caseId,
      caseNature:     duplicate.caseNature,
      documentStatus: duplicate.caseStatus,
      registeredAt:   duplicate.registeredAt instanceof Date
        ? duplicate.registeredAt.toISOString()
        : new Date(duplicate.registeredAt).toISOString(),
    },
  };
}

/** Create a new case and return the DTO. */
export async function createCaseService(input: CreateCaseInput, userId: string): Promise<CaseDto> {
  const doc = await createCase(input, userId);
  // Fire-and-forget audit write — case creation succeeds regardless of audit DB state.
  // writeAuditEvent already logs the error internally; we swallow here so a PostgreSQL
  // blip does not surface as a 500 on a successfully persisted case.
  try {
    await writeAuditEvent({
      interactionId: input.interactionId,
      eventName: 'case_created',
      actorUserId: userId,
      eventPayload: {
        caseId: doc.caseId,
        caseNature: doc.caseNature,
        caseCategoryId: doc.caseCategoryId?.toString(),
        caseSubcategoryId: doc.caseSubcategoryId?.toString(),
      },
    });
  } catch {
    // Audit write failure is non-fatal — error already logged in audit.repository
  }
  return toDto(doc);
}

/** Get a case by its MongoDB ObjectId. Throws 404 if not found. */
export async function getCaseByIdService(id: string): Promise<CaseDto> {
  const doc = await findCaseById(id);
  if (!doc) {
    throw AppError.notFound('Case', id);
  }
  return toDto(doc);
}

/** Get a case by interactionId. Returns null if not found. */
export async function getCaseByInteractionIdService(interactionId: string): Promise<CaseDto | null> {
  const doc = await findCaseByInteractionId(interactionId);
  if (!doc) return null;
  return toDto(doc);
}

// ---------------------------------------------------------------------------
// Phase 6 — Case detail (combined MongoDB + PostgreSQL activity state)
// ---------------------------------------------------------------------------

export interface CaseDetailDto extends CaseDto {
  currentStepNo: number | null;
  currentStepTemplateId: string | null;
  activityStateVersion: number | null;
  interactionChannel: InteractionChannel | null;
}

/**
 * GET /api/v1/cases/detail?caseId=ISR-xxx
 *
 * Looks up the case document by the human-readable caseId field (not _id),
 * then fetches the current resolution-activity state from PostgreSQL and
 * merges both into a single DTO.
 */
export async function getCaseDetailService(caseId: string): Promise<CaseDetailDto> {
  // 1. Find case by caseId field (not MongoDB _id)
  const doc = await CaseModel.findOne({ caseId }).lean();
  if (!doc) throw AppError.notFound('Case', caseId);

  // 2. Fetch activity state and interaction channel concurrently from PostgreSQL.
  //    The channel query is skipped (null) when no interactionId is present.
  const pool = getPool();

  const channelQueryPromise = doc.interactionId
    ? pool.query<{ channel: string }>(
        'SELECT channel FROM interactions WHERE id = $1 LIMIT 1',
        [doc.interactionId],
      )
    : Promise.resolve({ rows: [] as { channel: string }[] });

  const [stateResult, rawChannelResult] = await Promise.all([
    pool.query<{
      current_step_no: number;
      template_id: string;
      version: number;
    }>(
      'SELECT current_step_no, template_id, version FROM case_activity_state WHERE case_id = $1',
      [caseId],
    ),
    channelQueryPromise.catch(() => ({ rows: [] as { channel: string }[] })),
  ]);

  const state = stateResult.rows[0] ?? null;
  const rawChannel = rawChannelResult.rows[0]?.channel ?? null;
  const interactionChannel: InteractionChannel | null = rawChannel
    ? (rawChannel as InteractionChannel)
    : null;

  // 3. Resolve dealer display name from the Dealer collection.
  //    doc.dealerRef stores a human-readable dealer code string (e.g. "DLR-001").
  //    Look up the Dealer document by dealerCode; fall back to the raw string
  //    if the document is not found.
  //    When dealerRef is null/undefined we skip the query entirely.
  let resolvedDealerRef = '';
  if (doc.dealerRef) {
    const dealer = await DealerModel.findOne({ dealerCode: doc.dealerRef }).lean();
    resolvedDealerRef = dealer?.dealerCode ?? doc.dealerRef.toString();
  }

  // 4. Combine and return — lean doc _id is a plain ObjectId; cast explicitly.
  const typedDoc = doc as unknown as ICase & { _id: Types.ObjectId };
  return {
    ...toDto(typedDoc),
    dealerRef:               resolvedDealerRef,
    currentStepNo:           state?.current_step_no ?? null,
    currentStepTemplateId:   state?.template_id ?? null,
    activityStateVersion:    state?.version ?? null,
    interactionChannel,
  };
}

// ---------------------------------------------------------------------------
// Phase 6 — Dealer catalog
// ---------------------------------------------------------------------------

export interface DealerCatalogServiceResult {
  items: DealerCatalogItem[];
  total: number;
  page: number;
  pageSize: number;
}

/**
 * Return a paginated, filtered list of cases belonging to the given dealer.
 *
 * @param dealerRef - MUST come from req.user (external_user_ref) — never from
 *                    query parameters.
 */
export async function getDealerCatalogService(
  dealerRef: string,
  filters: DealerCatalogFilters,
  page: number,
  pageSize: number,
): Promise<DealerCatalogServiceResult> {
  const result = await findCasesForDealer(dealerRef, filters, page, pageSize);
  return { ...result, page, pageSize };
}

// Re-export types consumed by the controller layer so it has a single import point.
export type { DealerCatalogFilters, DealerCatalogItem };
