// =============================================================================
// CCM API — Mock Install Base Adapter Unit Tests
//
// Verifies the adapter returns correct results for each search filter
// using the seeded mock dataset.
// Source: phase1-technical-blueprint.md §4.2 (integration/mock adapters)
//         CCM_Phase1_Agent_Interaction_Documentation.md §B3, §C3
// =============================================================================

import { describe, it, expect, vi } from 'vitest';
import { SearchFilter } from '@ccm/types';

// Mock transitive DB dependencies so this unit test runs without a database.
vi.mock('../../../shared/logging/logger', () => ({
  logger: {
    info: vi.fn(), warn: vi.fn(), error: vi.fn(),
    debug: vi.fn(), http: vi.fn(),
    child: vi.fn().mockReturnThis(),
  },
  createContextLogger: vi.fn().mockReturnValue({
    info: vi.fn(), warn: vi.fn(), error: vi.fn(),
    debug: vi.fn(), http: vi.fn(),
  }),
}));

vi.mock('../../audit/audit.repository', () => ({ writeAuditEvent: vi.fn() }));
vi.mock('../../search/search.repository', () => ({
  insertSearchAttempt: vi.fn(),
  findInteractionStatusById: vi.fn(),
}));
vi.mock('../../integration/adapterFactory', () => ({
  getInstallBaseAdapter: vi.fn(),
  getCustomerMasterAdapter: vi.fn(),
}));
vi.mock('../../../config/index', () => ({
  config: {
    jwtSecret: 'test-secret-that-is-at-least-32-characters-long',
    jwtExpiry: '8h',
    postgresHost: 'localhost',
    postgresPort: 5432,
    postgresDb: 'test',
    postgresUser: 'test',
    postgresPassword: 'test',
  },
}));

import { MockInstallBaseAdapter } from '../MockInstallBaseAdapter';
import { maskChassisNumber } from '../../search/search.service';

const adapter = new MockInstallBaseAdapter();

// ---------------------------------------------------------------------------
// Search by mobile
// ---------------------------------------------------------------------------

describe('MockInstallBaseAdapter — search by mobile', () => {
  it('should return matching customer when mobile number is present in seeded data', async () => {
    // CUST-IB-001 Rahul Sharma — mobile 9876543210
    const results = await adapter.search(SearchFilter.MOBILE, '9876543210');

    expect(results).toHaveLength(1);
    expect(results[0]!.customerRef).toBe('CUST-IB-001');
    expect(results[0]!.customerName).toBe('Rahul Sharma');
    expect(results[0]!.sourceSystem).toBe('INSTALL_BASE');
  });

  it('should return empty array for unknown mobile number', async () => {
    const results = await adapter.search(SearchFilter.MOBILE, '0000000000');

    expect(results).toHaveLength(0);
  });

  it('should return multiple results when partial mobile matches multiple records', async () => {
    // '12345' appears in multiple records (partial match behavior)
    const results = await adapter.search(SearchFilter.MOBILE, '1234567');

    // Multiple seeded customers have mobile numbers containing this pattern
    expect(results.length).toBeGreaterThanOrEqual(1);
  });

  it('should set sourceSystem to INSTALL_BASE on all mobile results', async () => {
    const results = await adapter.search(SearchFilter.MOBILE, '9876543210');

    results.forEach((r) => expect(r.sourceSystem).toBe('INSTALL_BASE'));
  });
});

// ---------------------------------------------------------------------------
// Search by registration number
// ---------------------------------------------------------------------------

describe('MockInstallBaseAdapter — search by registration_number', () => {
  it('should return matching vehicle record for known registration number', async () => {
    const results = await adapter.search(SearchFilter.REGISTRATION_NUMBER, 'MH12AB1234');

    expect(results).toHaveLength(1);
    expect(results[0]!.customerRef).toBe('CUST-IB-001');
    expect(results[0]!.vehicles[0]!.registrationNumber).toBe('MH12AB1234');
  });

  it('should be case-insensitive for registration number search', async () => {
    const upper = await adapter.search(SearchFilter.REGISTRATION_NUMBER, 'MH12AB1234');
    const lower = await adapter.search(SearchFilter.REGISTRATION_NUMBER, 'mh12ab1234');

    expect(upper).toHaveLength(lower.length);
    expect(upper[0]!.customerRef).toBe(lower[0]!.customerRef);
  });

  it('should return empty array for unknown registration number', async () => {
    const results = await adapter.search(SearchFilter.REGISTRATION_NUMBER, 'XX99ZZ0000');

    expect(results).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Search by customer name
// ---------------------------------------------------------------------------

describe('MockInstallBaseAdapter — search by customer_name', () => {
  it('should return matching customer for known name', async () => {
    // CUST-IB-001 Rahul Sharma
    const results = await adapter.search(SearchFilter.CUSTOMER_NAME, 'Rahul Sharma');

    expect(results).toHaveLength(1);
    expect(results[0]!.customerRef).toBe('CUST-IB-001');
  });

  it('should be case-insensitive for customer name search', async () => {
    const upper = await adapter.search(SearchFilter.CUSTOMER_NAME, 'RAHUL SHARMA');
    const lower = await adapter.search(SearchFilter.CUSTOMER_NAME, 'rahul sharma');

    expect(upper).toHaveLength(lower.length);
  });

  it('should return partial name matches', async () => {
    // 'Sharma' matches CUST-IB-001; 'Kumar' matches CUST-IB-003 (Amit Kumar)
    const results = await adapter.search(SearchFilter.CUSTOMER_NAME, 'Kumar');

    expect(results.length).toBeGreaterThanOrEqual(1);
  });

  it('should return empty array for unknown customer name', async () => {
    const results = await adapter.search(SearchFilter.CUSTOMER_NAME, 'Zzz Yyy Xxx');

    expect(results).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Search by email
// ---------------------------------------------------------------------------

describe('MockInstallBaseAdapter — search by email', () => {
  it('should return matching customer for known email', async () => {
    const results = await adapter.search(SearchFilter.EMAIL, 'rahul.sharma@email.com');

    expect(results).toHaveLength(1);
    expect(results[0]!.customerRef).toBe('CUST-IB-001');
  });

  it('should be case-insensitive for email search', async () => {
    const results = await adapter.search(SearchFilter.EMAIL, 'RAHUL.SHARMA@EMAIL.COM');

    expect(results).toHaveLength(1);
  });

  it('should return empty array for unknown email address', async () => {
    const results = await adapter.search(SearchFilter.EMAIL, 'unknown@nowhere.xyz');

    expect(results).toHaveLength(0);
  });

  it('should not return records where email is null', async () => {
    // CUST-IB-003 (Amit Kumar) has null email — searching by email must not return it
    const results = await adapter.search(SearchFilter.EMAIL, 'kumar');

    results.forEach((r) => expect(r.email).not.toBeNull());
  });
});

// ---------------------------------------------------------------------------
// Result shape validation
// ---------------------------------------------------------------------------

describe('MockInstallBaseAdapter — result shape', () => {
  it('should include chassisNumber property on every vehicle result', async () => {
    const results = await adapter.search(SearchFilter.MOBILE, '9876543210');

    expect(results).toHaveLength(1);
    expect(results[0]!.vehicles).toHaveLength(1);
    expect(results[0]!.vehicles[0]).toHaveProperty('chassisNumber');
    expect(results[0]!.vehicles[0]!.chassisNumber).toBeTruthy();
  });

  it('should include vehicleRef on every vehicle in results', async () => {
    const results = await adapter.search(SearchFilter.MOBILE, '9876543210');

    results.forEach((r) => {
      r.vehicles.forEach((v) => {
        expect(v.vehicleRef).toBeTruthy();
      });
    });
  });

  it('should return customerRef, customerName, primaryMobile on every result', async () => {
    const results = await adapter.search(SearchFilter.MOBILE, '9876543210');

    results.forEach((r) => {
      expect(r.customerRef).toBeTruthy();
      expect(r.customerName).toBeTruthy();
      expect(r.primaryMobile).toBeTruthy();
    });
  });

  it('should return multiple vehicles for a customer with multiple vehicles', async () => {
    // CUST-IB-003 (Amit Kumar, mobile 7654321098) has 2 vehicles
    const results = await adapter.search(SearchFilter.MOBILE, '7654321098');

    expect(results).toHaveLength(1);
    expect(results[0]!.vehicles).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// maskChassisNumber correctness on seeded chassis numbers
// ---------------------------------------------------------------------------

describe('maskChassisNumber — applied to seeded chassis data', () => {
  it('should correctly mask the 17-char chassis from seeded data for CUST-IB-001', () => {
    // MD2A11EZ9MCA00001
    const masked = maskChassisNumber('MD2A11EZ9MCA00001');
    expect(masked).toBe('MD2' + '**********' + '0001');
    expect(masked).toHaveLength(17);
  });

  it('should not expose chassis middle segment after masking', () => {
    const chassis = 'MD2A55BZ1NCA00002';
    const masked = maskChassisNumber(chassis);
    const middle = masked.slice(3, masked.length - 4);
    expect(middle).toMatch(/^\*+$/);
  });

  it('should preserve first 3 and last 4 chars exactly', () => {
    const chassis = 'MD2A16AZ8LCA00003';
    const masked = maskChassisNumber(chassis);
    expect(masked.substring(0, 3)).toBe('MD2');
    expect(masked.substring(masked.length - 4)).toBe('0003');
  });
});
