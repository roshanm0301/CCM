// =============================================================================
// CCM API — Mock Customer Master Adapter
//
// Returns seeded customer data as a fallback when Install Base returns nothing.
// Source: phase1-technical-blueprint.md § 4.2 (integration/mock adapters)
// =============================================================================

import { SearchFilter } from '@ccm/types';
import type { ISearchAdapter, SearchResultItem } from './ISearchAdapter';
import { logger } from '../../shared/logging/logger';

interface MockCustomer {
  customerRef: string;
  customerName: string;
  primaryMobile: string;
  email: string | null;
}

// ---------------------------------------------------------------------------
// Seeded mock data — 10 customers (no vehicle data in Customer Master)
// ---------------------------------------------------------------------------
const MOCK_CUSTOMERS: MockCustomer[] = [
  {
    customerRef: 'CUST-CM-001',
    customerName: 'Rajesh Gupta',
    primaryMobile: '9001234567',
    email: 'rajesh.gupta@email.com',
  },
  {
    customerRef: 'CUST-CM-002',
    customerName: 'Pooja Verma',
    primaryMobile: '8901234567',
    email: 'pooja.verma@gmail.com',
  },
  {
    customerRef: 'CUST-CM-003',
    customerName: 'Manish Tiwari',
    primaryMobile: '7801234567',
    email: null,
  },
  {
    customerRef: 'CUST-CM-004',
    customerName: 'Nisha Agarwal',
    primaryMobile: '6701234567',
    email: 'nisha.agarwal@yahoo.com',
  },
  {
    customerRef: 'CUST-CM-005',
    customerName: 'Sanjay Bhatt',
    primaryMobile: '9601234567',
    email: 'sanjay.bhatt@outlook.com',
  },
  {
    customerRef: 'CUST-CM-006',
    customerName: 'Rekha Pillai',
    primaryMobile: '8501234567',
    email: 'rekha.pillai@rediffmail.com',
  },
  {
    customerRef: 'CUST-CM-007',
    customerName: 'Arjun Desai',
    primaryMobile: '7401234567',
    email: 'arjun.desai@protonmail.com',
  },
  {
    customerRef: 'CUST-CM-008',
    customerName: 'Latha Krishnan',
    primaryMobile: '9301234567',
    email: 'latha.krishnan@techmail.in',
  },
  {
    customerRef: 'CUST-CM-009',
    customerName: 'Harish Chandra',
    primaryMobile: '8201234567',
    email: null,
  },
  {
    customerRef: 'CUST-CM-010',
    customerName: 'Smita Kulkarni',
    primaryMobile: '7101234567',
    email: 'smita.kulkarni@business.in',
  },
];

export class MockCustomerMasterAdapter implements ISearchAdapter {
  async search(filter: SearchFilter, value: string): Promise<SearchResultItem[]> {
    logger.debug('MockCustomerMasterAdapter.search', {
      module: 'integration.MockCustomerMasterAdapter',
      filter,
      value,
    });

    const normalizedValue = value.trim().toLowerCase();

    const matches = MOCK_CUSTOMERS.filter((customer) => {
      switch (filter) {
        case SearchFilter.MOBILE:
          return customer.primaryMobile.includes(normalizedValue);

        case SearchFilter.CUSTOMER_NAME:
          return customer.customerName.toLowerCase().includes(normalizedValue);

        case SearchFilter.EMAIL:
          return (
            customer.email !== null && customer.email.toLowerCase().includes(normalizedValue)
          );

        case SearchFilter.REGISTRATION_NUMBER:
          // Customer Master does not index by registration number
          return false;

        default:
          return false;
      }
    });

    return matches.map((customer) => ({
      customerRef: customer.customerRef,
      customerName: customer.customerName,
      primaryMobile: customer.primaryMobile,
      email: customer.email,
      vehicles: [], // Customer Master has no vehicle data
      sourceSystem: 'CUSTOMER_MASTER' as const,
    }));
  }
}

// Export for use by context adapter
export { MOCK_CUSTOMERS };
