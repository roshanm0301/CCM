// =============================================================================
// CCM API — Activity Master Service Unit Tests
//
// Tests business logic by mocking the repository layer entirely.
// Source: CCM_Phase5_ActivityFlowConfiguration.md § Feature 1
// =============================================================================

import { describe, it, expect, vi, beforeEach, type MockedFunction } from 'vitest';

// ---------------------------------------------------------------------------
// Mock the repository before importing the service
// ---------------------------------------------------------------------------

vi.mock('../activity-master.repository', () => ({
  findAllActivities: vi.fn(),
  findActiveActivities: vi.fn(),
  findActivityById: vi.fn(),
  findActivityByCode: vi.fn(),
  createActivity: vi.fn(),
  updateActivity: vi.fn(),
}));

import * as repo from '../activity-master.repository';
import type { ActivityMasterRow } from '../activity-master.repository';
import {
  listActivitiesService,
  listActiveActivitiesService,
  createActivityService,
  updateActivityService,
} from '../activity-master.service';

// ---------------------------------------------------------------------------
// Typed mock helpers
// ---------------------------------------------------------------------------

const mockFindAllActivities     = repo.findAllActivities     as MockedFunction<typeof repo.findAllActivities>;
const mockFindActiveActivities  = repo.findActiveActivities  as MockedFunction<typeof repo.findActiveActivities>;
const mockFindActivityById      = repo.findActivityById      as MockedFunction<typeof repo.findActivityById>;
const mockFindActivityByCode    = repo.findActivityByCode    as MockedFunction<typeof repo.findActivityByCode>;
const mockCreateActivity        = repo.createActivity        as MockedFunction<typeof repo.createActivity>;
const mockUpdateActivity        = repo.updateActivity        as MockedFunction<typeof repo.updateActivity>;

// ---------------------------------------------------------------------------
// Fixture
// ---------------------------------------------------------------------------

const mockActivityRow: ActivityMasterRow = {
  id:          '507f1f77bcf86cd799439011',
  code:        'CALL_LOG',
  displayName: 'Call Logging',
  description: 'Log an inbound call',
  isActive:    true,
  createdBy:   'user-001',
  updatedBy:   'user-001',
  createdAt:   new Date('2026-03-25'),
  updatedAt:   new Date('2026-03-25'),
};

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.resetAllMocks();
});

// ---------------------------------------------------------------------------
// listActivitiesService
// ---------------------------------------------------------------------------

describe('listActivitiesService', () => {
  it('calls findAllActivities and maps rows to DTOs', async () => {
    mockFindAllActivities.mockResolvedValue([mockActivityRow]);

    const result = await listActivitiesService();

    expect(mockFindAllActivities).toHaveBeenCalledTimes(1);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('507f1f77bcf86cd799439011');
    expect(result[0].code).toBe('CALL_LOG');
    expect(result[0].displayName).toBe('Call Logging');
    // Dates must be ISO strings in the DTO
    expect(typeof result[0].createdAt).toBe('string');
    expect(typeof result[0].updatedAt).toBe('string');
  });

  it('returns empty array when no activities exist', async () => {
    mockFindAllActivities.mockResolvedValue([]);
    const result = await listActivitiesService();
    expect(result).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// listActiveActivitiesService
// ---------------------------------------------------------------------------

describe('listActiveActivitiesService', () => {
  it('calls findActiveActivities (not findAllActivities)', async () => {
    mockFindActiveActivities.mockResolvedValue([mockActivityRow]);

    const result = await listActiveActivitiesService();

    expect(mockFindActiveActivities).toHaveBeenCalledTimes(1);
    expect(mockFindAllActivities).not.toHaveBeenCalled();
    expect(result).toHaveLength(1);
    expect(result[0].isActive).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// createActivityService
// ---------------------------------------------------------------------------

describe('createActivityService', () => {
  it('happy path: creates activity and returns DTO including updatedBy', async () => {
    mockFindActivityByCode.mockResolvedValue(null);
    mockCreateActivity.mockResolvedValue({ ...mockActivityRow, updatedBy: 'user-abc' });

    const result = await createActivityService(
      { code: 'CALL_LOG', displayName: 'Call Logging', description: 'desc', isActive: true },
      'user-abc',
    );

    expect(mockFindActivityByCode).toHaveBeenCalledWith('CALL_LOG');
    expect(mockCreateActivity).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'CALL_LOG', displayName: 'Call Logging' }),
      'user-abc',
    );
    expect(result.code).toBe('CALL_LOG');
    expect(result.updatedBy).toBe('user-abc');
  });

  it('code conflict → throws AppError with statusCode 409', async () => {
    mockFindActivityByCode.mockResolvedValue(mockActivityRow);

    await expect(
      createActivityService(
        { code: 'CALL_LOG', displayName: 'Duplicate', description: '', isActive: true },
        'user-abc',
      ),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: 'CONFLICT',
    });

    expect(mockCreateActivity).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// updateActivityService
// ---------------------------------------------------------------------------

describe('updateActivityService', () => {
  it('happy path: updates activity and returns DTO', async () => {
    mockFindActivityById.mockResolvedValue(mockActivityRow);
    mockFindActivityByCode.mockResolvedValue(null);
    mockUpdateActivity.mockResolvedValue({ ...mockActivityRow, displayName: 'Updated Name', updatedBy: 'user-xyz' });

    const result = await updateActivityService(
      '507f1f77bcf86cd799439011',
      { displayName: 'Updated Name' },
      'user-xyz',
    );

    expect(mockUpdateActivity).toHaveBeenCalledWith(
      '507f1f77bcf86cd799439011',
      expect.objectContaining({ displayName: 'Updated Name' }),
      'user-xyz',
    );
    expect(result.displayName).toBe('Updated Name');
  });

  it('not found → throws AppError with statusCode 404', async () => {
    mockFindActivityById.mockResolvedValue(null);

    await expect(
      updateActivityService('507f1f77bcf86cd799439011', { displayName: 'X' }, 'user-abc'),
    ).rejects.toMatchObject({
      statusCode: 404,
      code: 'NOT_FOUND',
    });

    expect(mockUpdateActivity).not.toHaveBeenCalled();
  });

  it('code conflict on update (excluding self) → throws AppError 409', async () => {
    mockFindActivityById.mockResolvedValue(mockActivityRow);
    // findActivityByCode returns a DIFFERENT activity with same code
    mockFindActivityByCode.mockResolvedValue({
      ...mockActivityRow,
      id: '507f1f77bcf86cd799439099',
    });

    await expect(
      updateActivityService('507f1f77bcf86cd799439011', { code: 'CALL_LOG' }, 'user-abc'),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: 'CONFLICT',
    });

    expect(mockFindActivityByCode).toHaveBeenCalledWith('CALL_LOG', '507f1f77bcf86cd799439011');
    expect(mockUpdateActivity).not.toHaveBeenCalled();
  });

  it('userId (updatedBy) is passed through to repository', async () => {
    mockFindActivityById.mockResolvedValue(mockActivityRow);
    mockFindActivityByCode.mockResolvedValue(null);
    mockUpdateActivity.mockResolvedValue({ ...mockActivityRow, updatedBy: 'audit-user' });

    await updateActivityService(
      '507f1f77bcf86cd799439011',
      { isActive: false },
      'audit-user',
    );

    expect(mockUpdateActivity).toHaveBeenCalledWith(
      '507f1f77bcf86cd799439011',
      expect.any(Object),
      'audit-user',
    );
  });
});
