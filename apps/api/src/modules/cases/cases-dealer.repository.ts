// =============================================================================
// CCM API — Cases Dealer Repository
//
// MongoDB queries scoped to a specific dealer, with enrichment from PostgreSQL
// (case_activity_state) and in-memory mock adapters (customer context).
//
// CRITICAL SECURITY: dealerRef is ALWAYS sourced from req.user (set by the
// authenticate middleware from the JWT payload) via the service layer.
// It is NEVER read from query parameters or the request body.
//
// Source: CCM_Phase6_Resolution_Activities.md — Dealer Catalog View
// =============================================================================

import mongoose, { Types } from 'mongoose';
import { CaseModel } from '../../shared/models/case.model';
import { getPool } from '../../shared/database/postgres';
import { getCustomerContext } from '../integration/MockContextAdapter';
import type { IActivityTemplate } from '../activity-template/activity-template.repository';

// ---------------------------------------------------------------------------
// Lazy model accessors
// Models are registered at application startup — accessed here by name to
// avoid circular imports.
// ---------------------------------------------------------------------------

function getCategoryModel() {
  return mongoose.models['CaseCategory'] as mongoose.Model<{ _id: Types.ObjectId; displayName: string }>;
}

function getSubcategoryModel() {
  return mongoose.models['CaseSubcategory'] as mongoose.Model<{ _id: Types.ObjectId; displayName: string }>;
}

function getTemplateModel() {
  return mongoose.models['ActivityTemplate'] as mongoose.Model<IActivityTemplate>;
}

// ---------------------------------------------------------------------------
// Filter / result shapes
// ---------------------------------------------------------------------------

export interface DealerCatalogFilters {
  caseStatus?:     string[];
  caseNature?:     string;
  productType?:    string;
  department?:     string[];   // multi-select
  activityStatus?: string;
  caseCategory?:   string[];   // display names, multi-select
  caseSubcategory?: string[];  // display names, multi-select
  dateFrom?:       string;     // ISO date string
  dateTo?:         string;     // ISO date string
}

export interface DealerCatalogItem {
  id:                  string;
  caseId:              string;
  caseNature:          string;
  department:          string;
  caseCategoryName:    string;
  caseSubcategoryName: string;
  customerName:        string;
  customerMobile:      string;
  currentAssignedRole: string;
  caseStatus:          string;
  activityStatus:      string;
  registeredAt:        string;
  customerRef:         string;
  dealerRef:           string;
}

export interface DealerCatalogResult {
  items: DealerCatalogItem[];
  total: number;
}

// ---------------------------------------------------------------------------
// Repository function
// ---------------------------------------------------------------------------

/**
 * Find all cases for a dealer with optional filtering, sorted by registeredAt
 * descending (latest first), with pagination.
 *
 * @param dealerRef - ALWAYS from req.user.externalRef — never from query params.
 */
export async function findCasesForDealer(
  dealerRef: string,
  filters: DealerCatalogFilters,
  page: number,
  pageSize: number,
): Promise<DealerCatalogResult> {
  // Hard filter — non-negotiable: scope every query to this dealer only.
  const query: Record<string, unknown> = { dealerRef };

  // Optional simple filters
  if (filters.caseStatus && filters.caseStatus.length > 0) {
    query['caseStatus'] = { $in: filters.caseStatus };
  }
  if (filters.caseNature) {
    query['caseNature'] = filters.caseNature;
  }
  if (filters.productType) {
    query['productType'] = filters.productType;
  }
  if (filters.department && filters.department.length > 0) {
    query['department'] = { $in: filters.department };
  }
  if (filters.activityStatus) {
    query['activityStatus'] = filters.activityStatus;
  }

  // Resolve caseCategory display names → ObjectIds
  if (filters.caseCategory && filters.caseCategory.length > 0) {
    const catDocs = await getCategoryModel()
      .find({ displayName: { $in: filters.caseCategory } })
      .select('_id')
      .lean();
    const catIds = catDocs.map((c) => c._id);
    // If no category matched the filter names, force an empty result set.
    query['caseCategoryId'] = { $in: catIds.length > 0 ? catIds : [new Types.ObjectId()] };
  }

  // Resolve caseSubcategory display names → ObjectIds
  if (filters.caseSubcategory && filters.caseSubcategory.length > 0) {
    const subDocs = await getSubcategoryModel()
      .find({ displayName: { $in: filters.caseSubcategory } })
      .select('_id')
      .lean();
    const subIds = subDocs.map((s) => s._id);
    query['caseSubcategoryId'] = { $in: subIds.length > 0 ? subIds : [new Types.ObjectId()] };
  }

  // Date range on registeredAt
  if (filters.dateFrom || filters.dateTo) {
    const dateFilter: Record<string, Date> = {};
    if (filters.dateFrom) {
      dateFilter['$gte'] = new Date(filters.dateFrom);
    }
    if (filters.dateTo) {
      // Include the entire "to" day by advancing to end of day
      const to = new Date(filters.dateTo);
      to.setHours(23, 59, 59, 999);
      dateFilter['$lte'] = to;
    }
    query['registeredAt'] = dateFilter;
  }

  // Run count and paginated list in parallel
  const [total, docs] = await Promise.all([
    CaseModel.countDocuments(query),
    CaseModel.find(query)
      .sort({ registeredAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean(),
  ]);

  if (docs.length === 0) {
    return { items: [], total };
  }

  // ── Batch enrichment ────────────────────────────────────────────────────────
  // Each enrichment stage is independently isolated. A failure in any stage
  // degrades that field to empty string — core case data (id, status, dates)
  // is always returned.

  // 1. Category / subcategory display names
  const categoryNameMap    = new Map<string, string>();
  const subcategoryNameMap = new Map<string, string>();
  try {
    const categoryIds    = [...new Set(docs.map((d) => d.caseCategoryId?.toString()).filter(Boolean))];
    const subcategoryIds = [...new Set(docs.map((d) => d.caseSubcategoryId?.toString()).filter(Boolean))];

    const [catDocs, subDocs] = await Promise.all([
      categoryIds.length > 0
        ? getCategoryModel().find({ _id: { $in: categoryIds } }).select('_id displayName').lean()
        : [],
      subcategoryIds.length > 0
        ? getSubcategoryModel().find({ _id: { $in: subcategoryIds } }).select('_id displayName').lean()
        : [],
    ]);

    for (const c of catDocs) {
      categoryNameMap.set((c._id as Types.ObjectId).toString(), (c as { displayName: string }).displayName);
    }
    for (const s of subDocs) {
      subcategoryNameMap.set((s._id as Types.ObjectId).toString(), (s as { displayName: string }).displayName);
    }
  } catch (err) {
    console.warn('[DealerCatalog] Category enrichment failed — degrading to empty strings', err);
  }

  // 2. Customer name + mobile (in-memory mock adapter — synchronous per call)
  const customerMap = new Map<string, { name: string; mobile: string }>();
  try {
    const uniqueCustomerRefs = [...new Set(docs.map((d) => d.customerRef))];
    for (const ref of uniqueCustomerRefs) {
      const ctx = getCustomerContext(ref);
      if (ctx.found) {
        customerMap.set(ref, { name: ctx.contactName, mobile: ctx.primaryMobile });
      }
    }
  } catch (err) {
    console.warn('[DealerCatalog] Customer context enrichment failed — degrading to empty strings', err);
  }

  // 3. Current assigned role from PostgreSQL case_activity_state + activity templates
  const templateStepsMap = new Map<string, Array<{ stepNo: number; assignedRole: string }>>();
  const stateMap         = new Map<string, { templateId: string; stepNo: number }>();
  try {
    const caseIds = docs.map((d) => d.caseId);

    const stateResult = await getPool().query<{
      case_id: string;
      template_id: string;
      current_step_no: number;
    }>(
      'SELECT case_id, template_id, current_step_no FROM case_activity_state WHERE case_id = ANY($1)',
      [caseIds],
    );

    for (const row of stateResult.rows) {
      stateMap.set(row.case_id, { templateId: row.template_id, stepNo: row.current_step_no });
    }

    const uniqueTemplateIds = [...new Set(stateResult.rows.map((r) => r.template_id))];
    const templateDocs = uniqueTemplateIds.length > 0
      ? await getTemplateModel()
          .find({ _id: { $in: uniqueTemplateIds } })
          .select('_id steps')
          .lean()
      : [];

    for (const t of templateDocs) {
      const templateId = (t._id as Types.ObjectId).toString();
      const steps = (t.steps as Array<{ stepNo: number; assignedRole: string }>)
        .map((s) => ({ stepNo: s.stepNo, assignedRole: s.assignedRole }));
      templateStepsMap.set(templateId, steps);
    }
  } catch (err) {
    console.warn('[DealerCatalog] Activity state enrichment failed — degrading assigned role to empty string', err);
  }

  function resolveAssignedRole(caseId: string): string {
    const state = stateMap.get(caseId);
    if (!state) return '';
    const steps = templateStepsMap.get(state.templateId);
    if (!steps) return '';
    return steps.find((s) => s.stepNo === state.stepNo)?.assignedRole ?? '';
  }

  // ── Map to output items ──────────────────────────────────────────────────────

  const items: DealerCatalogItem[] = docs.map((doc) => {
    const catId  = doc.caseCategoryId?.toString() ?? '';
    const subId  = doc.caseSubcategoryId?.toString() ?? '';
    const cust   = customerMap.get(doc.customerRef);

    return {
      id:                  (doc._id as Types.ObjectId).toString(),
      caseId:              doc.caseId,
      caseNature:          doc.caseNature,
      department:          doc.department,
      caseCategoryName:    categoryNameMap.get(catId) ?? '',
      caseSubcategoryName: subcategoryNameMap.get(subId) ?? '',
      customerName:        cust?.name    ?? '',
      customerMobile:      cust?.mobile  ?? '',
      currentAssignedRole: resolveAssignedRole(doc.caseId),
      caseStatus:          doc.caseStatus,
      activityStatus:      doc.activityStatus,
      registeredAt:        doc.registeredAt instanceof Date
        ? doc.registeredAt.toISOString()
        : new Date(doc.registeredAt).toISOString(),
      customerRef:         doc.customerRef,
      dealerRef:           doc.dealerRef ?? '',
    };
  });

  return { items, total };
}
