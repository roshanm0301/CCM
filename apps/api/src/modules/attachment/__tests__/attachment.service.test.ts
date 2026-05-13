// =============================================================================
// CCM API — Attachment Service Unit Tests
//
// Tests business rules by mocking MongoDB (CaseAttachmentModel via repository),
// PostgreSQL pool (insertAttachmentRef), and the repository layer.
//
// Covered scenarios:
//   - 5 MB enforcement: base64 string length → sizeBytes computation
//   - sizeBytes passed to saveAttachmentDoc (unified computation)
//   - MongoDB → PG dual-write: success path returns DTO without base64Content
//   - PG failure → MongoDB compensation (deleteAttachmentDoc called)
//   - getAttachmentService: 404 on missing attachment; full DTO with base64Content
//   - getAttachmentMetadataService: list without base64Content
//   - ObjectId validation in findAttachmentDocById (via repository mock)
// Source: CCM_Phase6_Resolution_Activities.md § Wave 2 Track B
// =============================================================================

import { describe, it, expect, vi, beforeEach, type MockedFunction } from 'vitest';

// ---------------------------------------------------------------------------
// Mock attachment repository
// ---------------------------------------------------------------------------

vi.mock('../attachment.repository', () => ({
  saveAttachmentDoc:              vi.fn(),
  deleteAttachmentDoc:            vi.fn(),
  findAttachmentDocById:          vi.fn(),
  findAttachmentMetadataByCaseId: vi.fn(),
  insertAttachmentRef:            vi.fn(),
}));

// ---------------------------------------------------------------------------
// Imports AFTER mocks
// ---------------------------------------------------------------------------

import * as repo from '../attachment.repository';
import {
  uploadAttachmentService,
  getAttachmentService,
  getAttachmentMetadataService,
} from '../attachment.service';
import type { UploadAttachmentInput } from '../attachment.validator';

// ---------------------------------------------------------------------------
// Typed mock helpers
// ---------------------------------------------------------------------------

const mockSave      = repo.saveAttachmentDoc              as MockedFunction<typeof repo.saveAttachmentDoc>;
const mockDelete    = repo.deleteAttachmentDoc             as MockedFunction<typeof repo.deleteAttachmentDoc>;
const mockFindById  = repo.findAttachmentDocById           as MockedFunction<typeof repo.findAttachmentDocById>;
const mockFindByCaseId = repo.findAttachmentMetadataByCaseId as MockedFunction<typeof repo.findAttachmentMetadataByCaseId>;
const mockInsertRef = repo.insertAttachmentRef             as MockedFunction<typeof repo.insertAttachmentRef>;

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

// A base64 string that decodes to exactly 100 bytes
// 100 / 0.75 ≈ 134 chars — round up to nearest multiple of 4 = 136
const SMALL_BASE64 = 'A'.repeat(136);     // ~100 bytes — well within 5 MB

// ~5 MB base64 string: 5,242,880 bytes → Math.ceil(len * 0.75) = 5,242,880
// len = 5,242,880 / 0.75 = 6,990,506.67 → ceil = 6,990,508 chars
const FIVE_MB_BASE64 = 'A'.repeat(6_990_508);  // sizeBytes ≈ 5,242,881 — just over limit

// Just within 5 MB: Math.ceil(6_990_505 * 0.75) = 5,242,879
const UNDER_LIMIT_BASE64 = 'A'.repeat(6_990_505);

const VALID_OBJECT_ID = '507f1f77bcf86cd799439011';

const baseInput: UploadAttachmentInput = {
  caseId:        'ISR-001',
  stepNo:        1,
  filename:      'service-report.pdf',
  contentType:   'application/pdf',
  base64Content: SMALL_BASE64,
};

// Simulate a Mongoose document — _id is a plain object with toString()
const mockMongoDoc = {
  _id:              { toString: () => VALID_OBJECT_ID },
  caseId:           'ISR-001',
  stepNo:           1,
  originalFilename: 'service-report.pdf',
  contentType:      'application/pdf',
  sizeBytes:        100,
  base64Content:    SMALL_BASE64,
  uploadedByUserId: 'user-001',
  createdAt:        new Date('2026-01-01T10:00:00.000Z'),
};

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.resetAllMocks();
  mockSave.mockResolvedValue(mockMongoDoc as unknown as Awaited<ReturnType<typeof repo.saveAttachmentDoc>>);
  mockInsertRef.mockResolvedValue(undefined);
  mockDelete.mockResolvedValue(undefined);
});

// ===========================================================================
// uploadAttachmentService — 5 MB enforcement
// ===========================================================================

describe('uploadAttachmentService — 5 MB enforcement', () => {
  it('base64 string decoding to > 5 MB → throws 422 before any persistence', async () => {
    await expect(
      uploadAttachmentService({ ...baseInput, base64Content: FIVE_MB_BASE64 }, 'user-001', 'test-corr-001'),
    ).rejects.toMatchObject({ statusCode: 422, code: 'VALIDATION_ERROR' });

    expect(mockSave).not.toHaveBeenCalled();
    expect(mockInsertRef).not.toHaveBeenCalled();
  });

  it('base64 string decoding to exactly ≤ 5 MB → proceeds to persistence', async () => {
    await uploadAttachmentService({ ...baseInput, base64Content: UNDER_LIMIT_BASE64 }, 'user-001', 'test-corr-001');
    expect(mockSave).toHaveBeenCalledTimes(1);
  });

  it('small file → no size error', async () => {
    await expect(
      uploadAttachmentService(baseInput, 'user-001', 'test-corr-001'),
    ).resolves.toBeDefined();
  });
});

// ===========================================================================
// uploadAttachmentService — sizeBytes unified computation (HIGH-1)
// ===========================================================================

describe('uploadAttachmentService — sizeBytes passed to saveAttachmentDoc', () => {
  it('saveAttachmentDoc receives the computed sizeBytes, not recomputes it internally', async () => {
    await uploadAttachmentService(baseInput, 'user-001', 'test-corr-001');

    // sizeBytes = Math.ceil(136 * 0.75) = Math.ceil(102) = 102
    const expectedSizeBytes = Math.ceil(SMALL_BASE64.length * 0.75);
    expect(mockSave).toHaveBeenCalledWith(
      baseInput,
      'user-001',
      expectedSizeBytes,
    );
  });

  it('insertAttachmentRef receives the same sizeBytes value', async () => {
    await uploadAttachmentService(baseInput, 'user-001', 'test-corr-001');

    const expectedSizeBytes = Math.ceil(SMALL_BASE64.length * 0.75);
    expect(mockInsertRef).toHaveBeenCalledWith(
      VALID_OBJECT_ID,
      expect.objectContaining({ sizeBytes: expectedSizeBytes }),
      'user-001',
    );
  });
});

// ===========================================================================
// uploadAttachmentService — dual-write success path
// ===========================================================================

describe('uploadAttachmentService — happy path', () => {
  it('returns DTO without base64Content', async () => {
    const result = await uploadAttachmentService(baseInput, 'user-001', 'test-corr-001');

    expect(result.id).toBe(VALID_OBJECT_ID);
    expect(result.caseId).toBe('ISR-001');
    expect(result.stepNo).toBe(1);
    expect(result.originalFilename).toBe('service-report.pdf');
    expect(result.contentType).toBe('application/pdf');
    expect('base64Content' in result).toBe(false);
  });

  it('createdAt is an ISO string', async () => {
    const result = await uploadAttachmentService(baseInput, 'user-001', 'test-corr-001');
    expect(typeof result.createdAt).toBe('string');
    expect(result.createdAt).toContain('2026-01-01');
  });

  it('passes mongoId and caseId to insertAttachmentRef', async () => {
    await uploadAttachmentService(baseInput, 'user-001', 'test-corr-001');

    expect(mockInsertRef).toHaveBeenCalledWith(
      VALID_OBJECT_ID,
      expect.objectContaining({ caseId: 'ISR-001', stepNo: 1, filename: 'service-report.pdf' }),
      'user-001',
    );
  });
});

// ===========================================================================
// uploadAttachmentService — PG failure compensation (HIGH-3)
// ===========================================================================

describe('uploadAttachmentService — MongoDB compensation on PG failure', () => {
  it('PG write fails → deleteAttachmentDoc called with mongoId, then error re-thrown', async () => {
    const pgError = new Error('PG connection lost');
    mockInsertRef.mockRejectedValue(pgError);

    await expect(
      uploadAttachmentService(baseInput, 'user-001', 'test-corr-001'),
    ).rejects.toThrow('PG connection lost');

    expect(mockDelete).toHaveBeenCalledWith(VALID_OBJECT_ID);
  });

  it('PG write fails + compensation fails → original PG error is still thrown', async () => {
    mockInsertRef.mockRejectedValue(new Error('PG down'));
    mockDelete.mockRejectedValue(new Error('Mongo also down'));

    await expect(
      uploadAttachmentService(baseInput, 'user-001', 'test-corr-001'),
    ).rejects.toThrow('PG down');
  });

  it('PG write succeeds → deleteAttachmentDoc never called', async () => {
    await uploadAttachmentService(baseInput, 'user-001', 'test-corr-001');
    expect(mockDelete).not.toHaveBeenCalled();
  });
});

// ===========================================================================
// getAttachmentService
// ===========================================================================

describe('getAttachmentService', () => {
  it('valid id, document exists → returns DTO WITH base64Content', async () => {
    mockFindById.mockResolvedValue(mockMongoDoc as unknown as Awaited<ReturnType<typeof repo.findAttachmentDocById>>);

    const result = await getAttachmentService(VALID_OBJECT_ID);

    expect(result.id).toBe(VALID_OBJECT_ID);
    expect(result.base64Content).toBe(SMALL_BASE64);
  });

  it('document not found → throws 404', async () => {
    mockFindById.mockResolvedValue(null);

    await expect(
      getAttachmentService(VALID_OBJECT_ID),
    ).rejects.toMatchObject({ statusCode: 404, code: 'NOT_FOUND' });
  });

  it('ObjectId validation: invalid id → repository returns null → throws 404', async () => {
    mockFindById.mockResolvedValue(null); // repository returns null for invalid ids

    await expect(
      getAttachmentService('not-an-objectid'),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

// ===========================================================================
// getAttachmentMetadataService
// ===========================================================================

describe('getAttachmentMetadataService', () => {
  const metadataRow = {
    id:               VALID_OBJECT_ID,
    stepNo:           1,
    originalFilename: 'service-report.pdf',
    contentType:      'application/pdf',
    sizeBytes:        100,
    createdAt:        new Date('2026-01-01T10:00:00.000Z'),
  };

  it('returns list of DTOs without base64Content', async () => {
    mockFindByCaseId.mockResolvedValue([metadataRow]);

    const result = await getAttachmentMetadataService('ISR-001');

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(VALID_OBJECT_ID);
    expect(result[0].caseId).toBe('ISR-001');
    expect('base64Content' in result[0]).toBe(false);
  });

  it('no attachments → returns empty array', async () => {
    mockFindByCaseId.mockResolvedValue([]);
    const result = await getAttachmentMetadataService('ISR-999');
    expect(result).toHaveLength(0);
  });

  it('createdAt in metadata items is ISO string', async () => {
    mockFindByCaseId.mockResolvedValue([metadataRow]);
    const result = await getAttachmentMetadataService('ISR-001');
    expect(typeof result[0].createdAt).toBe('string');
  });
});
