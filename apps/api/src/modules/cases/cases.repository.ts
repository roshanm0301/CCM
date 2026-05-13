// =============================================================================
// CCM API — Cases Repository (MongoDB / Mongoose)
//
// All Mongoose operations for cases.
// =============================================================================

import { Types } from 'mongoose';
import { CaseModel, ICase } from '../../shared/models/case.model';
import { nextSequence } from '../../shared/models/counter.model';
import { AppError } from '../../shared/errors/AppError';
import type { CreateCaseInput } from './cases.validator';

// ---------------------------------------------------------------------------
// ID generation
// ---------------------------------------------------------------------------

/** Generate next ISR-XXX case ID using atomic counter. */
export async function generateCaseId(): Promise<string> {
  const seq = await nextSequence('case_id');
  return `ISR-${String(seq).padStart(3, '0')}`;
}

// ---------------------------------------------------------------------------
// Read queries
// ---------------------------------------------------------------------------

/** Find all cases for a customer, sorted latest-first. */
export async function findCasesByCustomerRef(customerRef: string): Promise<ICase[]> {
  return CaseModel.find({ customerRef })
    .sort({ registeredAt: -1 })
    .lean() as unknown as ICase[];
}

/** Count open/pending cases for a customer. */
export async function countOpenCases(customerRef: string): Promise<number> {
  return CaseModel.countDocuments({
    customerRef,
    caseStatus: { $in: ['Open', 'Pending Verification'] },
  });
}

/** Find a single case by its MongoDB ObjectId (string form). */
export async function findCaseById(id: string): Promise<ICase | null> {
  if (!Types.ObjectId.isValid(id)) return null;
  return CaseModel.findById(id).lean() as unknown as ICase | null;
}

/** Find case by interactionId (1-per-interaction enforcement). */
export async function findCaseByInteractionId(interactionId: string): Promise<ICase | null> {
  return CaseModel.findOne({ interactionId }).lean() as unknown as ICase | null;
}

/** Check for a duplicate open/pending case with the same key fields. */
export async function findDuplicateCase(params: {
  customerRef: string;
  vehicleRef: string | null;
  caseNature: string;
  department: string;
  caseCategoryId: string;
  caseSubcategoryId: string;
}): Promise<ICase | null> {
  const filter: Record<string, unknown> = {
    customerRef:  params.customerRef,
    caseNature:   params.caseNature,
    department:   params.department,
    caseCategoryId:    new Types.ObjectId(params.caseCategoryId),
    caseSubcategoryId: new Types.ObjectId(params.caseSubcategoryId),
    caseStatus:   { $in: ['Open', 'Pending Verification'] },
  };

  if (params.vehicleRef !== null && params.vehicleRef !== undefined) {
    filter['vehicleRef'] = params.vehicleRef;
  } else {
    filter['vehicleRef'] = null;
  }

  return CaseModel.findOne(filter).lean() as unknown as ICase | null;
}

// ---------------------------------------------------------------------------
// Write operations
// ---------------------------------------------------------------------------

/** Create a new case. Enforces 1-case-per-interaction rule. */
export async function createCase(input: CreateCaseInput, userId: string): Promise<ICase> {
  // 1 case per interaction enforcement
  const existing = await CaseModel.findOne({ interactionId: input.interactionId });
  if (existing) {
    throw AppError.conflict('A case has already been registered for this interaction');
  }

  const caseId = await generateCaseId();

  let doc: ICase;
  try {
    doc = await CaseModel.create({
      caseId,
      interactionId:     input.interactionId,
      customerRef:       input.customerRef,
      vehicleRef:        input.vehicleRef ?? null,
      dealerRef:         input.dealerRef,
      caseNature:        input.caseNature,
      department:        input.department,
      priority:          input.priority ?? null,
      productType:       input.productType,
      productTypeSource: input.productTypeSource,
      caseCategoryId:    new Types.ObjectId(input.caseCategoryId),
      caseSubcategoryId: new Types.ObjectId(input.caseSubcategoryId),
      customerRemarks:   input.customerRemarks,
      agentRemarks:      input.agentRemarks,
      caseStatus:        'Open',
      activityStatus:    'Fresh',
      createdBy:         userId,
      registeredAt:      new Date(),
    });
  } catch (err: unknown) {
    // MongoDB duplicate key on interactionId unique index
    if (
      err instanceof Error &&
      'code' in err &&
      (err as { code: unknown }).code === 11000
    ) {
      throw AppError.conflict('A case has already been registered for this interaction');
    }
    throw err;
  }

  return doc;
}
