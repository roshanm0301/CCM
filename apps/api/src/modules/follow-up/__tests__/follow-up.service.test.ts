// =============================================================================
// CCM API — Follow-Up Service Unit Tests
//
// Tests business rules by mocking CaseModel, PostgreSQL pool, follow-up
// repository, and audit repository. No real DB connection required.
//
// Covered scenarios:
//   - Role guard: only agent / ccm_agent may add follow-ups (dealer → 403)
//   - Case not found → 404
//   - Case already closed → 422
//   - Successful add — resolves agent display name, persists row, returns DTO
//   - Audit failure is non-fatal (does not bubble up)
//   - getFollowUpHistoryService — delegates to repository and maps DTOs
// Source: CCM_Phase6_Resolution_Activities.md § Wave 2 Track C
// =============================================================================

import { describe, it, expect, vi, beforeEach, type MockedFunction } from 'vitest';

// ---------------------------------------------------------------------------
// Mock PostgreSQL pool (used for display-name lookup)
// ---------------------------------------------------------------------------

const mockPoolQuery = vi.fn();

vi.mock('../../../shared/database/postgres', () => ({
  getPool: () => ({ query: mockPoolQuery }),
}));

// ---------------------------------------------------------------------------
// Mock CaseModel (MongoDB document lookup)
//
// vi.mock() is hoisted to the top of the file by Vitest, so any variables
// referenced directly in the factory must be declared with vi.hoisted()
// to avoid a temporal dead zone (TDZ) ReferenceError.
// ---------------------------------------------------------------------------

const { mockExec, mockLean, mockFindOne } = vi.hoisted(() => {
  const mockExec   = vi.fn();
  const mockLean   = vi.fn();
  const mockFindOne = vi.fn();
  return { mockExec, mockLean, mockFindOne };
});

vi.mock('../../../shared/models/case.model', () => ({
  CaseModel: { findOne: mockFindOne },
}));

// ---------------------------------------------------------------------------
// Mock follow-up repository
// ---------------------------------------------------------------------------

vi.mock('../follow-up.repository', () => ({
  addFollowUp: vi.fn(),
  getFollowUpHistory: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Mock audit repository
// ---------------------------------------------------------------------------

vi.mock('../../audit/audit.repository', () => ({
  writeAuditEvent: vi.fn().mockResolvedValue(undefined),
}));

// ---------------------------------------------------------------------------
// Imports AFTER mocks
// ---------------------------------------------------------------------------

import * as followUpRepo from '../follow-up.repository';
import { addFollowUpService, getFollowUpHistoryService } from '../follow-up.service';
import type { FollowUpRow } from '../follow-up.repository';
import type { AddFollowUpInput } from '../follow-up.validator';

// ---------------------------------------------------------------------------
// Typed mock helpers
// ---------------------------------------------------------------------------

const mockAddFollowUp      = followUpRepo.addFollowUp      as MockedFunction<typeof followUpRepo.addFollowUp>;
const mockGetHistory       = followUpRepo.getFollowUpHistory as MockedFunction<typeof followUpRepo.getFollowUpHistory>;

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const validInput: AddFollowUpInput = {
  caseId:            'ISR-001',
  customerRemarks:   'Customer called about service delay',
  agentRemarks:      'Escalated to workshop',
  callRecordingLink: undefined,
};

const mockCaseDoc = {
  caseId:     'ISR-001',
  caseStatus: 'Open' as const,
};

const mockFollowUpRow: FollowUpRow = {
  id:                  'fu-001',
  case_id:             'ISR-001',
  customer_remarks:    'Customer called about service delay',
  agent_remarks:       'Escalated to workshop',
  agent_name:          'Agent One',
  created_by_user_id:  'user-001',
  call_recording_link: null,
  created_at:          new Date('2026-01-01T10:00:00.000Z'),
};

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.resetAllMocks();

  // Default: case exists and is Open
  mockExec.mockResolvedValue(mockCaseDoc);
  mockLean.mockReturnValue({ exec: mockExec });
  mockFindOne.mockReturnValue({ lean: mockLean });

  // Default: display name resolves to 'Agent One'
  mockPoolQuery.mockResolvedValue({ rows: [{ display_name: 'Agent One' }] });

  // Default: follow-up insert succeeds
  mockAddFollowUp.mockResolvedValue(mockFollowUpRow);
});

// ===========================================================================
// addFollowUpService — role guard
// ===========================================================================

describe('addFollowUpService — role guard', () => {
  it('agent role → succeeds', async () => {
    const result = await addFollowUpService(validInput, 'user-001', ['agent'], 'test-corr-id');
    expect(result.id).toBe('fu-001');
    expect(mockAddFollowUp).toHaveBeenCalledTimes(1);
  });

  it('ccm_agent role → succeeds', async () => {
    const result = await addFollowUpService(validInput, 'user-001', ['ccm_agent'], 'test-corr-id');
    expect(result.id).toBe('fu-001');
  });

  it('dealer_service_advisor role (no agent role) → throws 403', async () => {
    await expect(
      addFollowUpService(validInput, 'dealer-001', ['dealer_service_advisor'], 'test-corr-id'),
    ).rejects.toMatchObject({ statusCode: 403 });

    expect(mockAddFollowUp).not.toHaveBeenCalled();
  });

  it('empty roles array → throws 403', async () => {
    await expect(
      addFollowUpService(validInput, 'user-001', [], 'test-corr-id'),
    ).rejects.toMatchObject({ statusCode: 403 });
  });
});

// ===========================================================================
// addFollowUpService — case validation
// ===========================================================================

describe('addFollowUpService — case validation', () => {
  it('case not found → throws 404', async () => {
    mockExec.mockResolvedValue(null);

    await expect(
      addFollowUpService(validInput, 'user-001', ['agent'], 'test-corr-id'),
    ).rejects.toMatchObject({ statusCode: 404 });

    expect(mockAddFollowUp).not.toHaveBeenCalled();
  });

  it('case status Closed – Verified → throws 422', async () => {
    mockExec.mockResolvedValue({ ...mockCaseDoc, caseStatus: 'Closed \u2013 Verified' });

    await expect(
      addFollowUpService(validInput, 'user-001', ['agent'], 'test-corr-id'),
    ).rejects.toMatchObject({ statusCode: 422, code: 'INVALID_STATUS_TRANSITION' });

    expect(mockAddFollowUp).not.toHaveBeenCalled();
  });

  it('case status Closed – Not Verified → throws 422', async () => {
    mockExec.mockResolvedValue({ ...mockCaseDoc, caseStatus: 'Closed \u2013 Not Verified' });

    await expect(
      addFollowUpService(validInput, 'user-001', ['agent'], 'test-corr-id'),
    ).rejects.toMatchObject({ statusCode: 422 });
  });

  it('case status Open → succeeds', async () => {
    mockExec.mockResolvedValue({ ...mockCaseDoc, caseStatus: 'Open' });

    const result = await addFollowUpService(validInput, 'user-001', ['agent'], 'test-corr-id');
    expect(result.caseId).toBe('ISR-001');
  });
});

// ===========================================================================
// addFollowUpService — happy path and DTO shape
// ===========================================================================

describe('addFollowUpService — happy path', () => {
  it('resolves agent display name from PG and passes to repository', async () => {
    mockPoolQuery.mockResolvedValue({ rows: [{ display_name: 'Senior Agent' }] });
    mockAddFollowUp.mockResolvedValue({ ...mockFollowUpRow, agent_name: 'Senior Agent' });

    const result = await addFollowUpService(validInput, 'user-001', ['agent'], 'test-corr-id');

    expect(mockAddFollowUp).toHaveBeenCalledWith(
      validInput,
      'user-001',
      'Senior Agent',
    );
    expect(result.agentName).toBe('Senior Agent');
  });

  it('user not in PG users table → falls back to "Unknown Agent"', async () => {
    mockPoolQuery.mockResolvedValue({ rows: [] }); // no rows
    mockAddFollowUp.mockResolvedValue({ ...mockFollowUpRow, agent_name: 'Unknown Agent' });

    await addFollowUpService(validInput, 'user-999', ['agent'], 'test-corr-id');

    expect(mockAddFollowUp).toHaveBeenCalledWith(
      validInput,
      'user-999',
      'Unknown Agent',
    );
  });

  it('returned DTO has createdAt as ISO string', async () => {
    const result = await addFollowUpService(validInput, 'user-001', ['agent'], 'test-corr-id');
    expect(typeof result.createdAt).toBe('string');
    expect(result.createdAt).toContain('2026-01-01');
  });

  it('callRecordingLink null is preserved in DTO', async () => {
    const result = await addFollowUpService(validInput, 'user-001', ['agent'], 'test-corr-id');
    expect(result.callRecordingLink).toBeNull();
  });

  it('callRecordingLink URL is preserved in DTO', async () => {
    const rowWithLink: FollowUpRow = {
      ...mockFollowUpRow,
      call_recording_link: 'https://recordings.example.com/rec-001.mp3',
    };
    mockAddFollowUp.mockResolvedValue(rowWithLink);

    const result = await addFollowUpService(
      { ...validInput, callRecordingLink: 'https://recordings.example.com/rec-001.mp3' },
      'user-001',
      ['agent'],
      'test-corr-id',
    );

    expect(result.callRecordingLink).toBe('https://recordings.example.com/rec-001.mp3');
  });
});

// ===========================================================================
// addFollowUpService — audit failure is non-fatal
// ===========================================================================

describe('addFollowUpService — audit non-fatal', () => {
  it('writeAuditEvent rejects → service still returns success', async () => {
    const { writeAuditEvent } = await import('../../audit/audit.repository');
    vi.mocked(writeAuditEvent).mockRejectedValueOnce(new Error('Audit DB down'));

    const result = await addFollowUpService(validInput, 'user-001', ['agent'], 'test-corr-id');
    expect(result.id).toBe('fu-001');
  });
});

// ===========================================================================
// getFollowUpHistoryService
// ===========================================================================

describe('getFollowUpHistoryService', () => {
  it('delegates to repository and maps rows to DTOs', async () => {
    const rows: FollowUpRow[] = [
      { ...mockFollowUpRow, id: 'fu-002', created_at: new Date('2026-01-02T10:00:00.000Z') },
      { ...mockFollowUpRow, id: 'fu-001', created_at: new Date('2026-01-01T10:00:00.000Z') },
    ];
    mockGetHistory.mockResolvedValue(rows);

    const result = await getFollowUpHistoryService('ISR-001');

    expect(mockGetHistory).toHaveBeenCalledWith('ISR-001');
    expect(result).toHaveLength(2);
    // Latest first — repository orders DESC; we just verify the order is preserved
    expect(result[0].id).toBe('fu-002');
    expect(result[1].id).toBe('fu-001');
  });

  it('no history → returns empty array', async () => {
    mockGetHistory.mockResolvedValue([]);

    const result = await getFollowUpHistoryService('ISR-999');
    expect(result).toHaveLength(0);
  });
});
