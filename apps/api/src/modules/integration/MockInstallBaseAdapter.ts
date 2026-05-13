// =============================================================================
// CCM API — Mock Install Base Adapter
//
// Returns seeded Bajaj vehicle / customer data for Phase 1 development.
// Chassis numbers stored in full here — masking is applied at the context layer.
// Source: phase1-technical-blueprint.md § 4.2 (integration/mock adapters)
// =============================================================================

import { ProductType, SearchFilter } from '@ccm/types';
import type { ISearchAdapter, SearchResultItem } from './ISearchAdapter';
import { logger } from '../../shared/logging/logger';

interface MockRecord {
  customerRef: string;
  customerName: string;
  primaryMobile: string;
  email: string | null;
  vehicles: Array<{
    vehicleRef: string;
    registrationNumber: string;
    modelName: string;
    variant: string;
    chassisNumber: string;
    dealerRef: string | null;
    productType: ProductType;
  }>;
}

// ---------------------------------------------------------------------------
// Seeded mock data — 10 realistic Bajaj vehicles / customers
// ---------------------------------------------------------------------------
const MOCK_RECORDS: MockRecord[] = [
  {
    customerRef: 'CUST-IB-001',
    customerName: 'Rahul Sharma',
    primaryMobile: '9876543210',
    email: 'rahul.sharma@email.com',
    vehicles: [
      {
        vehicleRef: 'VEH-IB-001',
        registrationNumber: 'MH12AB1234',
        modelName: 'Bajaj Pulsar NS200',
        variant: 'NS200 FI',
        chassisNumber: 'MD2A11EZ9MCA00001',
        dealerRef: 'DLR-001',
        productType: ProductType.MOTORCYCLE,
      },
    ],
  },
  {
    customerRef: 'CUST-IB-002',
    customerName: 'Priya Patel',
    primaryMobile: '8765432109',
    email: 'priya.patel@gmail.com',
    vehicles: [
      {
        vehicleRef: 'VEH-IB-002',
        registrationNumber: 'GJ01CD5678',
        modelName: 'Bajaj Dominar 400',
        variant: 'Dominar 400 TS',
        chassisNumber: 'MD2A55BZ1NCA00002',
        dealerRef: 'DLR-002',
        productType: ProductType.MOTORCYCLE,
      },
    ],
  },
  {
    customerRef: 'CUST-IB-003',
    customerName: 'Amit Kumar',
    primaryMobile: '7654321098',
    email: null,
    vehicles: [
      {
        vehicleRef: 'VEH-IB-003',
        registrationNumber: 'DL4CAF9876',
        modelName: 'Bajaj Avenger Street 160',
        variant: 'Street 160',
        chassisNumber: 'MD2A16AZ8LCA00003',
        dealerRef: 'DLR-003',
        productType: ProductType.MOTORCYCLE,
      },
      {
        vehicleRef: 'VEH-IB-004',
        registrationNumber: 'DL5CAG1122',
        modelName: 'Bajaj Platina 110',
        variant: 'Platina 110 H-Gear',
        chassisNumber: 'MD2A11BZ3MCA00004',
        dealerRef: 'DLR-003',
        productType: ProductType.MOTORCYCLE,
      },
    ],
  },
  {
    customerRef: 'CUST-IB-004',
    customerName: 'Sunita Reddy',
    primaryMobile: '6543210987',
    email: 'sunita.reddy@yahoo.com',
    vehicles: [
      {
        vehicleRef: 'VEH-IB-005',
        registrationNumber: 'AP28TG3344',
        modelName: 'Bajaj CT100',
        variant: 'CT100 B',
        chassisNumber: 'MD2A10BZ9LCA00005',
        dealerRef: 'DLR-004',
        productType: ProductType.MOTORCYCLE,
      },
    ],
  },
  {
    customerRef: 'CUST-IB-005',
    customerName: 'Vikram Singh',
    primaryMobile: '9988776655',
    email: 'vikram.singh@outlook.com',
    vehicles: [
      {
        vehicleRef: 'VEH-IB-006',
        registrationNumber: 'RJ14UC7890',
        modelName: 'Bajaj Pulsar 150',
        variant: 'Pulsar 150 Twin Disc',
        chassisNumber: 'MD2A15EZ2NCA00006',
        dealerRef: 'DLR-005',
        productType: ProductType.MOTORCYCLE,
      },
    ],
  },
  {
    customerRef: 'CUST-IB-006',
    customerName: 'Ekta Sire',
    primaryMobile: '8087570780',
    email: 'ektas@excellonsoft.com',
    vehicles: [
      {
        vehicleRef: 'VEH-IB-007',
        registrationNumber: 'KA53MN4455',
        modelName: 'Bajaj Pulsar RS200',
        variant: 'RS200 FI ABS',
        chassisNumber: 'MD2A20EZ7MCA00007',
        dealerRef: 'DLR-002',
        productType: ProductType.PROBIKING,     // high-performance sports segment
      },
    ],
  },
  {
    customerRef: 'CUST-IB-007',
    customerName: 'Roshan',
    primaryMobile: '8554982643',
    email: 'roshanm@excellonsoft.com',
    vehicles: [
      {
        vehicleRef: 'VEH-IB-008',
        registrationNumber: 'KL07AS6677',
        modelName: 'Bajaj Dominar 250',
        variant: 'Dominar 250 ABS',
        chassisNumber: 'MD2A25BZ4NCA00008',
        dealerRef: 'DLR-006',
        productType: ProductType.MOTORCYCLE,
      },
    ],
  },
  {
    customerRef: 'CUST-IB-008',
    customerName: 'Kavitha Balachandran',
    primaryMobile: '9123456780',
    email: 'kavitha.b@techmail.com',
    vehicles: [
      {
        vehicleRef: 'VEH-IB-009',
        registrationNumber: 'TN22BG8899',
        modelName: 'Bajaj Avenger Cruise 220',
        variant: 'Cruise 220',
        chassisNumber: 'MD2A22AZ5MCA00009',
        dealerRef: 'DLR-007',
        productType: ProductType.MOTORCYCLE,
      },
    ],
  },
  {
    customerRef: 'CUST-IB-009',
    customerName: 'Suresh Yadav',
    primaryMobile: '8012345678',
    email: null,
    vehicles: [
      {
        vehicleRef: 'VEH-IB-010',
        registrationNumber: 'UP32GH0011',
        modelName: 'Bajaj CT125X',
        variant: 'CT125X Drum',
        chassisNumber: 'MD2A12BZ6NCA00010',
        dealerRef: 'DLR-008',
        productType: ProductType.MOTORCYCLE,
      },
    ],
  },
  {
    customerRef: 'CUST-IB-010',
    customerName: 'Mahabaleshwar',
    primaryMobile: '8618546060',
    email: 'anjali.mehta@business.in',
    vehicles: [
      {
        vehicleRef: 'VEH-IB-011',
        registrationNumber: 'MH43JK2233',
        modelName: 'Bajaj Pulsar N160',
        variant: 'N160 Single Disc',
        chassisNumber: 'MD2A16GZ3NCA00011',
        dealerRef: 'DLR-001',
        productType: ProductType.MOTORCYCLE,
      },
    ],
  },
];

export class MockInstallBaseAdapter implements ISearchAdapter {
  async search(filter: SearchFilter, value: string): Promise<SearchResultItem[]> {
    logger.debug('MockInstallBaseAdapter.search', {
      module: 'integration.MockInstallBaseAdapter',
      filter,
      value,
    });

    const normalizedValue = value.trim().toLowerCase();

    const matches = MOCK_RECORDS.filter((record) => {
      switch (filter) {
        case SearchFilter.MOBILE:
          return record.primaryMobile.includes(normalizedValue);

        case SearchFilter.REGISTRATION_NUMBER: {
          const upperValue = normalizedValue.toUpperCase();
          return record.vehicles.some((v) =>
            v.registrationNumber.toUpperCase().includes(upperValue),
          );
        }

        case SearchFilter.CUSTOMER_NAME:
          return record.customerName.toLowerCase().includes(normalizedValue);

        case SearchFilter.EMAIL:
          return record.email !== null && record.email.toLowerCase().includes(normalizedValue);

        default:
          return false;
      }
    });

    return matches.map((record) => ({
      customerRef: record.customerRef,
      customerName: record.customerName,
      primaryMobile: record.primaryMobile,
      email: record.email,
      vehicles: record.vehicles.map((v) => ({
        vehicleRef: v.vehicleRef,
        registrationNumber: v.registrationNumber,
        modelName: v.modelName,
        variant: v.variant,
        chassisNumber: v.chassisNumber,
        dealerRef: v.dealerRef,
      })),
      sourceSystem: 'INSTALL_BASE' as const,
    }));
  }
}

// Export seeded data for use by the context adapter
export { MOCK_RECORDS };
