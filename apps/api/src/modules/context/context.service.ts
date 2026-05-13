// =============================================================================
// CCM API — Context Service
//
// Retrieves and returns customer, vehicle, dealer context from mock adapters.
// Writes context snapshots for traceability.
// Chassis masking applied here (service layer, not adapter layer).
//
// Source: phase1-technical-blueprint.md §5.13–5.15
//         CCM_Phase1_Agent_Interaction_Documentation.md §C6, §D6
// =============================================================================

import { logger } from '../../shared/logging/logger';
import {
  getCustomerContext,
  getVehicleContext,
  getDealerContext,
  CustomerContextData,
  VehicleContextData,
  DealerRecord,
  ContextNotFound,
} from '../integration/MockContextAdapter';
import { insertContextSnapshot } from './context.repository';
import { DealerModel } from '../../shared/models/dealer.model';
import { maskChassisNumber } from '../search/search.service';

// ---------------------------------------------------------------------------
// Customer Context
// ---------------------------------------------------------------------------

export interface CustomerContextResponse {
  found: boolean;
  customerRef?: string;
  contactName?: string;
  primaryMobile?: string;
  secondaryMobile?: string | null;
  emailId?: string | null;
  address?: string | null;
  sourceSystem?: string;
}

export async function getCustomerContextService(
  ref: string,
  interactionId: string | undefined,
  userId: string,
  correlationId: string,
): Promise<CustomerContextResponse> {
  const data = getCustomerContext(ref);

  if (!data.found) {
    logger.info('Customer context not found', {
      module: 'context.service',
      correlationId,
      ref,
    });
    return { found: false };
  }

  const result = data as CustomerContextData;

  // Write snapshot if we have an interactionId (best-effort)
  if (interactionId) {
    try {
      await insertContextSnapshot({
        interactionId,
        snapshotType: 'customer',
        sourceSystem: result.sourceSystem,
        sourceReference: ref,
        snapshotJson: {
          customerRef: result.customerRef,
          contactName: result.contactName,
          primaryMobile: result.primaryMobile,
          emailId: result.emailId,
        },
      });
    } catch (snapshotErr) {
      logger.error('Failed to write customer context snapshot', {
        module: 'context.service',
        correlationId,
        ref,
        message: snapshotErr instanceof Error ? snapshotErr.message : String(snapshotErr),
      });
    }
  }

  return {
    found: true,
    customerRef: result.customerRef,
    contactName: result.contactName,
    primaryMobile: result.primaryMobile,
    secondaryMobile: result.secondaryMobile,
    emailId: result.emailId,
    address: result.address,
    sourceSystem: result.sourceSystem,
  };
}

// ---------------------------------------------------------------------------
// Vehicle Context
// ---------------------------------------------------------------------------

export interface VehicleContextResponse {
  found: boolean;
  vehicleRef?: string;
  productType?: string;
  modelName?: string;
  variant?: string;
  registrationNumber?: string;
  chassisNumberMasked?: string;
  soldOnDate?: string | null;
  lastServiceDate?: string | null;
  dealerRef?: string | null;
  sourceSystem?: string;
}

export async function getVehicleContextService(
  ref: string,
  interactionId: string | undefined,
  userId: string,
  correlationId: string,
): Promise<VehicleContextResponse> {
  const data = getVehicleContext(ref);

  if (!data.found) {
    logger.info('Vehicle context not found', {
      module: 'context.service',
      correlationId,
      ref,
    });
    return { found: false };
  }

  const result = data as VehicleContextData;

  // Apply chassis masking
  const chassisNumberMasked = maskChassisNumber(result.chassisNumber);

  // Write snapshot (best-effort, no raw chassis stored)
  if (interactionId) {
    try {
      await insertContextSnapshot({
        interactionId,
        snapshotType: 'vehicle',
        sourceSystem: result.sourceSystem,
        sourceReference: ref,
        snapshotJson: {
          vehicleRef: result.vehicleRef,
          productType: result.productType,
          modelName: result.modelName,
          variant: result.variant,
          registrationNumber: result.registrationNumber,
          chassisNumberMasked, // masked only — raw chassis never stored
          soldOnDate: result.soldOnDate,
          lastServiceDate: result.lastServiceDate,
          dealerRef: result.dealerRef,
        },
      });
    } catch (snapshotErr) {
      logger.error('Failed to write vehicle context snapshot', {
        module: 'context.service',
        correlationId,
        ref,
        message: snapshotErr instanceof Error ? snapshotErr.message : String(snapshotErr),
      });
    }
  }

  return {
    found: true,
    vehicleRef: result.vehicleRef,
    productType: result.productType,
    modelName: result.modelName,
    variant: result.variant,
    registrationNumber: result.registrationNumber,
    chassisNumberMasked,
    soldOnDate: result.soldOnDate,
    lastServiceDate: result.lastServiceDate,
    dealerRef: result.dealerRef,
    sourceSystem: result.sourceSystem,
  };
}

// ---------------------------------------------------------------------------
// Dealer Context
// ---------------------------------------------------------------------------

export interface DealerContextResponse {
  found: boolean;
  dealerRef?: string;
  dealerName?: string;
  dealerCode?: string;
  branchName?: string | null;
  asc?: string | null;
  city?: string | null;
  address?: string | null;
  pinCode?: string | null;
  dealerType?: string | null;
  isActive?: boolean;
  sourceSystem?: string;
}

export async function getDealerContextService(
  ref: string,
  interactionId: string | undefined,
  userId: string,
  correlationId: string,
): Promise<DealerContextResponse> {
  let data = getDealerContext(ref);

  // If the mock adapter doesn't have this ref, fall back to MongoDB dealers
  // collection (which uses dealerCode as the semantic identifier).
  if (!data.found) {
    const dbDealer = await DealerModel.findOne({ dealerCode: ref }).lean();
    if (dbDealer) {
      const record: DealerRecord & { found: true } = {
        found: true,
        dealerRef: dbDealer.dealerCode,
        dealerName: dbDealer.dealerName,
        dealerCode: dbDealer.dealerCode,
        branchName: dbDealer.branchName ?? null,
        asc: null,
        city: dbDealer.city ?? null,
        address: dbDealer.address ?? null,
        pinCode: dbDealer.pinCode ?? null,
        dealerType: 'Dealer',
        isActive: dbDealer.isActive ?? true,
        sourceSystem: 'IDMS',
      };
      data = record;
    }
  }

  if (!data.found) {
    logger.info('Dealer context not found', {
      module: 'context.service',
      correlationId,
      ref,
    });
    return { found: false };
  }

  const result = data;

  // Write snapshot (best-effort)
  if (interactionId) {
    try {
      await insertContextSnapshot({
        interactionId,
        snapshotType: 'dealer',
        sourceSystem: result.sourceSystem,
        sourceReference: ref,
        snapshotJson: {
          dealerRef: result.dealerRef,
          dealerName: result.dealerName,
          dealerCode: result.dealerCode,
          city: result.city,
          isActive: result.isActive,
        },
      });
    } catch (snapshotErr) {
      logger.error('Failed to write dealer context snapshot', {
        module: 'context.service',
        correlationId,
        ref,
        message: snapshotErr instanceof Error ? snapshotErr.message : String(snapshotErr),
      });
    }
  }

  return {
    found: true,
    dealerRef: result.dealerRef,
    dealerName: result.dealerName,
    dealerCode: result.dealerCode,
    branchName: result.branchName,
    asc: result.asc,
    city: result.city,
    address: result.address,
    pinCode: result.pinCode,
    dealerType: result.dealerType,
    isActive: result.isActive,
    sourceSystem: result.sourceSystem,
  };
}
