// =============================================================================
// CCM API — Mock Context Adapter
//
// Returns full customer, vehicle, and dealer context by reference.
// Source: phase1-technical-blueprint.md §5.13–5.15
// =============================================================================

import { ProductType } from '@ccm/types';
import { MOCK_RECORDS } from './MockInstallBaseAdapter';
import { MOCK_CUSTOMERS } from './MockCustomerMasterAdapter';

// ---------------------------------------------------------------------------
// Dealer seed data
// ---------------------------------------------------------------------------
export interface DealerRecord {
  dealerRef: string;
  dealerName: string;
  dealerCode: string;
  branchName: string | null;
  asc: string | null;
  city: string | null;
  address: string | null;
  pinCode: string | null;
  dealerType: string | null;
  isActive: boolean;
  sourceSystem: string;
}

const MOCK_DEALERS: DealerRecord[] = [
  {
    dealerRef: 'DLR-001',
    dealerName: 'Sharma Bajaj Motors',
    dealerCode: 'MH-SBM-001',
    branchName: 'Pune Main Branch',
    asc: 'Sharma Auto Service Centre',
    city: 'Pune',
    address: '45, Shivaji Nagar, Pune',
    pinCode: '411005',
    dealerType: 'Dealer',
    isActive: true,
    sourceSystem: 'IDMS',
  },
  {
    dealerRef: 'DLR-002',
    dealerName: 'Gujarat Bajaj Pvt Ltd',
    dealerCode: 'GJ-GBP-002',
    branchName: 'Ahmedabad Central',
    asc: 'Gujarat Auto Service',
    city: 'Ahmedabad',
    address: '12, CG Road, Ahmedabad',
    pinCode: '380009',
    dealerType: 'Dealer',
    isActive: true,
    sourceSystem: 'IDMS',
  },
  {
    dealerRef: 'DLR-003',
    dealerName: 'Capital Bajaj Delhi',
    dealerCode: 'DL-CBD-003',
    branchName: 'South Delhi',
    asc: 'Capital Auto Works',
    city: 'New Delhi',
    address: 'B-12, Lajpat Nagar, New Delhi',
    pinCode: '110024',
    dealerType: 'Dealer',
    isActive: true,
    sourceSystem: 'IDMS',
  },
  {
    dealerRef: 'DLR-004',
    dealerName: 'Reddy Bajaj Automobiles',
    dealerCode: 'AP-RBA-004',
    branchName: 'Hyderabad East',
    asc: 'Reddy Auto Service',
    city: 'Hyderabad',
    address: '78, Secunderabad, Hyderabad',
    pinCode: '500003',
    dealerType: 'Dealer',
    isActive: true,
    sourceSystem: 'IDMS',
  },
  {
    dealerRef: 'DLR-005',
    dealerName: 'Rajputana Bajaj',
    dealerCode: 'RJ-RJB-005',
    branchName: 'Jaipur Main',
    asc: 'Rajputana Auto Workshop',
    city: 'Jaipur',
    address: '23, MI Road, Jaipur',
    pinCode: '302001',
    dealerType: 'Dealer',
    isActive: true,
    sourceSystem: 'IDMS',
  },
  {
    dealerRef: 'DLR-006',
    dealerName: 'Kerala Bajaj Centre',
    dealerCode: 'KL-KBC-006',
    branchName: 'Kochi',
    asc: 'Kerala Auto Service',
    city: 'Kochi',
    address: '5, MG Road, Ernakulam, Kochi',
    pinCode: '682035',
    dealerType: 'Dealer',
    isActive: true,
    sourceSystem: 'IDMS',
  },
  {
    dealerRef: 'DLR-007',
    dealerName: 'TN Bajaj Dealers',
    dealerCode: 'TN-TBD-007',
    branchName: 'Chennai West',
    asc: 'TN Auto Service Centre',
    city: 'Chennai',
    address: '90, Anna Nagar, Chennai',
    pinCode: '600040',
    dealerType: 'Dealer',
    isActive: true,
    sourceSystem: 'IDMS',
  },
  {
    dealerRef: 'DLR-008',
    dealerName: 'UP Bajaj Showroom',
    dealerCode: 'UP-UBS-008',
    branchName: 'Lucknow Main',
    asc: 'UP Auto Workshop',
    city: 'Lucknow',
    address: '34, Hazratganj, Lucknow',
    pinCode: '226001',
    dealerType: 'Dealer',
    isActive: true,
    sourceSystem: 'IDMS',
  },
];

// ---------------------------------------------------------------------------
// Customer context lookup
// ---------------------------------------------------------------------------
export interface CustomerContextData {
  found: true;
  customerRef: string;
  contactName: string;
  primaryMobile: string;
  secondaryMobile: string | null;
  emailId: string | null;
  address: string | null;
  sourceSystem: string;
}

export interface ContextNotFound {
  found: false;
}

export function getCustomerContext(ref: string): CustomerContextData | ContextNotFound {
  // Check Install Base records
  const ibRecord = MOCK_RECORDS.find((r) => r.customerRef === ref);
  if (ibRecord) {
    return {
      found: true,
      customerRef: ibRecord.customerRef,
      contactName: ibRecord.customerName,
      primaryMobile: ibRecord.primaryMobile,
      secondaryMobile: null,
      emailId: ibRecord.email,
      address: generateAddress(ibRecord.customerRef),
      sourceSystem: 'INSTALL_BASE',
    };
  }

  // Check Customer Master records
  const cmRecord = MOCK_CUSTOMERS.find((c) => c.customerRef === ref);
  if (cmRecord) {
    return {
      found: true,
      customerRef: cmRecord.customerRef,
      contactName: cmRecord.customerName,
      primaryMobile: cmRecord.primaryMobile,
      secondaryMobile: null,
      emailId: cmRecord.email,
      address: null,
      sourceSystem: 'CUSTOMER_MASTER',
    };
  }

  return { found: false };
}

// ---------------------------------------------------------------------------
// Vehicle context lookup
// ---------------------------------------------------------------------------
export interface VehicleContextData {
  found: true;
  vehicleRef: string;
  productType: ProductType;
  modelName: string;
  variant: string;
  registrationNumber: string;
  chassisNumber: string; // raw — masking applied at service layer
  soldOnDate: string | null;
  lastServiceDate: string | null;
  dealerRef: string | null;
  sourceSystem: string;
}

export function getVehicleContext(ref: string): VehicleContextData | ContextNotFound {
  for (const record of MOCK_RECORDS) {
    const vehicle = record.vehicles.find((v) => v.vehicleRef === ref);
    if (vehicle) {
      return {
        found: true,
        vehicleRef: vehicle.vehicleRef,
        productType: vehicle.productType,
        modelName: vehicle.modelName,
        variant: vehicle.variant,
        registrationNumber: vehicle.registrationNumber,
        chassisNumber: vehicle.chassisNumber,
        soldOnDate: generateSoldOnDate(vehicle.vehicleRef),
        lastServiceDate: generateLastServiceDate(vehicle.vehicleRef),
        dealerRef: vehicle.dealerRef,
        sourceSystem: 'INSTALL_BASE',
      };
    }
  }
  return { found: false };
}

// ---------------------------------------------------------------------------
// Dealer context lookup
// ---------------------------------------------------------------------------
export function getDealerContext(ref: string): (DealerRecord & { found: true }) | ContextNotFound {
  const dealer = MOCK_DEALERS.find((d) => d.dealerRef === ref);
  if (dealer) {
    return { found: true, ...dealer };
  }
  return { found: false };
}

// ---------------------------------------------------------------------------
// Helper: deterministic but realistic date values per record
// ---------------------------------------------------------------------------
function generateSoldOnDate(vehicleRef: string): string | null {
  const dateMap: Record<string, string> = {
    'VEH-IB-001': '2022-03-15',
    'VEH-IB-002': '2021-11-20',
    'VEH-IB-003': '2020-07-08',
    'VEH-IB-004': '2023-01-25',
    'VEH-IB-005': '2019-09-14',
    'VEH-IB-006': '2022-06-30',
    'VEH-IB-007': '2021-04-17',
    'VEH-IB-008': '2023-08-11',
    'VEH-IB-009': '2020-12-05',
    'VEH-IB-010': '2022-02-28',
    'VEH-IB-011': '2023-10-19',
  };
  return dateMap[vehicleRef] ?? null;
}

function generateLastServiceDate(vehicleRef: string): string | null {
  const dateMap: Record<string, string> = {
    'VEH-IB-001': '2025-12-10',
    'VEH-IB-002': '2025-09-22',
    'VEH-IB-003': '2025-11-03',
    'VEH-IB-004': '2026-01-15',
    'VEH-IB-005': '2025-08-27',
    'VEH-IB-006': '2025-10-14',
    'VEH-IB-007': '2025-07-31',
    'VEH-IB-008': '2026-02-08',
    'VEH-IB-009': '2025-06-19',
    'VEH-IB-010': '2025-11-29',
    'VEH-IB-011': '2026-01-04',
  };
  return dateMap[vehicleRef] ?? null;
}

function generateAddress(customerRef: string): string | null {
  const addressMap: Record<string, string> = {
    'CUST-IB-001': 'Flat 202, Sunrise Apartments, Baner, Pune - 411045',
    'CUST-IB-002': '14, Navrangpura, Ahmedabad - 380009',
    'CUST-IB-003': 'House 7, Block B, Dwarka Sector 12, New Delhi - 110078',
    'CUST-IB-004': '45, Jubilee Hills, Hyderabad - 500033',
    'CUST-IB-005': '22, Tonk Road, Jaipur - 302018',
    'CUST-IB-006': '8, Koramangala 5th Block, Bengaluru - 560095',
    'CUST-IB-007': '33, Thrippunithura, Ernakulam - 682301',
    'CUST-IB-008': '12, T Nagar, Chennai - 600017',
    'CUST-IB-009': '67, Gomti Nagar, Lucknow - 226010',
    'CUST-IB-010': 'Plot 9, Viman Nagar, Pune - 411014',
  };
  return addressMap[customerRef] ?? null;
}
