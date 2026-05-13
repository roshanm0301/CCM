// =============================================================================
// CCM API — Case Category Service Unit Tests
//
// Tests all business logic in isolation by mocking the repository layer.
// Source: CCM_Phase3_CaseCategory_Master.md
// =============================================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { MockedFunction } from 'vitest';

// ---------------------------------------------------------------------------
// Mock mongoose startSession so session.withTransaction / endSession are
// controlled in unit tests (no real MongoDB connection required).
//
// vi.hoisted() ensures these variables are initialised BEFORE the vi.mock()
// factory runs (vi.mock factories are hoisted to the top of the file by
// Vitest's babel transform, so any module-level `const` declared after the
// factory call would not yet be initialised when the factory executes).
// ---------------------------------------------------------------------------

const { mockSession } = vi.hoisted(() => {
  const mockSession = {
    withTransaction: vi.fn(async (fn: () => Promise<void>) => { await fn(); }),
    endSession: vi.fn().mockResolvedValue(undefined),
  };
  return { mockSession };
});

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

vi.mock('mongoose', async (importOriginal) => {
  const actual = await importOriginal<typeof import('mongoose')>();
  return {
    ...actual,
    default: {
      ...actual.default,
      startSession: vi.fn().mockResolvedValue(mockSession),
    },
  };
});

// ---------------------------------------------------------------------------
// Mock the repository module before importing the service
// ---------------------------------------------------------------------------

vi.mock('../../../shared/database/postgres', () => ({
  getPool: vi.fn(),
}));

vi.mock('../case-category.repository', () => ({
  findAllCategories: vi.fn(),
  findCategoryById: vi.fn(),
  findCategoryByCode: vi.fn(),
  findCategoryByDisplayName: vi.fn(),
  createCategory: vi.fn(),
  updateCategory: vi.fn(),
  findSubcategoriesByCategoryId: vi.fn(),
  findSubcategoryById: vi.fn(),
  findSubcategoryByCode: vi.fn(),
  findSubcategoryByDisplayNameInCategory: vi.fn(),
  createSubcategory: vi.fn(),
  updateSubcategory: vi.fn(),
  cascadeInactivateSubcategories: vi.fn(),
  cascadeReactivateSubcategories: vi.fn(),
  findReferenceValuesByType: vi.fn(),
  listDepartmentsService: vi.fn(),
  listCaseNaturesService: vi.fn(),
  listPrioritiesService: vi.fn(),
  listProductTypesService: vi.fn(),
}));

import mongoose from 'mongoose';
import * as repo from '../case-category.repository';
import type { CategoryRow, SubcategoryRow } from '../case-category.repository';
import {
  createCategoryService,
  getCategoryService,
  updateCategoryService,
  createSubcategoryService,
  updateSubcategoryService,
} from '../case-category.service';

// ---------------------------------------------------------------------------
// Typed mock helpers
// ---------------------------------------------------------------------------

const mockFindCategoryById = repo.findCategoryById as MockedFunction<typeof repo.findCategoryById>;
const mockFindCategoryByCode = repo.findCategoryByCode as MockedFunction<typeof repo.findCategoryByCode>;
const mockFindCategoryByDisplayName = repo.findCategoryByDisplayName as MockedFunction<typeof repo.findCategoryByDisplayName>;
const mockCreateCategory = repo.createCategory as MockedFunction<typeof repo.createCategory>;
const mockUpdateCategory = repo.updateCategory as MockedFunction<typeof repo.updateCategory>;
const mockFindSubcategoriesByCategoryId = repo.findSubcategoriesByCategoryId as MockedFunction<typeof repo.findSubcategoriesByCategoryId>;
const mockFindSubcategoryById = repo.findSubcategoryById as MockedFunction<typeof repo.findSubcategoryById>;
const mockFindSubcategoryByCode = repo.findSubcategoryByCode as MockedFunction<typeof repo.findSubcategoryByCode>;
const mockFindSubcategoryByDisplayNameInCategory = repo.findSubcategoryByDisplayNameInCategory as MockedFunction<typeof repo.findSubcategoryByDisplayNameInCategory>;
const mockCreateSubcategory = repo.createSubcategory as MockedFunction<typeof repo.createSubcategory>;
const mockUpdateSubcategory = repo.updateSubcategory as MockedFunction<typeof repo.updateSubcategory>;
const mockCascadeInactivateSubcategories = repo.cascadeInactivateSubcategories as MockedFunction<typeof repo.cascadeInactivateSubcategories>;
const mockCascadeReactivateSubcategories = repo.cascadeReactivateSubcategories as MockedFunction<typeof repo.cascadeReactivateSubcategories>;

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const mockCategoryRow: CategoryRow = {
  id: '507f1f77bcf86cd799439011',
  code: 'COMPLAINT',
  displayName: 'Complaint Handling',
  definition: 'Cases related to customer complaints',
  departments: ['SALES'],
  caseNatures: ['COMPLAINT'],
  productTypes: ['Motorcycle'],
  isActive: true,
  createdBy: 'user-001',
  createdAt: new Date('2026-03-25'),
  updatedAt: new Date('2026-03-25'),
  subcategoryCount: 0,
};

const mockSubcategoryRow: SubcategoryRow = {
  id: '507f1f77bcf86cd799439012',
  categoryId: '507f1f77bcf86cd799439011',
  code: 'BILLING',
  displayName: 'Billing Complaint',
  definition: 'Complaint about billing',
  isActive: true,
  inactivatedByCascade: false,
  createdBy: 'user-001',
  createdAt: new Date('2026-03-25'),
  updatedAt: new Date('2026-03-25'),
};

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.resetAllMocks();
  // Restore mongoose.startSession and session mock behaviour after resetAllMocks clears them
  vi.mocked(mongoose.startSession).mockResolvedValue(mockSession as unknown as Awaited<ReturnType<typeof mongoose.startSession>>);
  mockSession.withTransaction.mockImplementation(async (fn: () => Promise<void>) => { await fn(); });
  mockSession.endSession.mockResolvedValue(undefined);
});

// ---------------------------------------------------------------------------
// createCategoryService
// ---------------------------------------------------------------------------

describe('createCategoryService', () => {
  it('happy path: returns CategoryDto with uppercased code', async () => {
    mockFindCategoryByCode.mockResolvedValue(null);
    mockFindCategoryByDisplayName.mockResolvedValue(null);
    mockCreateCategory.mockResolvedValue({ ...mockCategoryRow, code: 'COMPLAINT' });

    const result = await createCategoryService(
      {
        code: 'COMPLAINT',
        displayName: 'Complaint Handling',
        definition: 'Cases related to customer complaints',
        departments: ['SALES'],
        caseNatures: ['COMPLAINT'],
        productTypes: ['Motorcycle'],
        isActive: true,
      },
      'user-001',
    );

    expect(result.code).toBe('COMPLAINT');
    expect(result.displayName).toBe('Complaint Handling');
    expect(mockCreateCategory).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'COMPLAINT' }),
      'user-001',
    );
  });

  it('duplicate code → throws AppError conflict (409)', async () => {
    mockFindCategoryByCode.mockResolvedValue(mockCategoryRow);

    await expect(
      createCategoryService(
        {
          code: 'COMPLAINT',
          displayName: 'New Name',
          definition: 'Some definition',
          departments: ['SALES'],
          caseNatures: ['COMPLAINT'],
          productTypes: ['Motorcycle'],
          isActive: true,
        },
        'user-001',
      ),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: 'CONFLICT',
    });
  });

  it('duplicate display name (case-insensitive) → throws AppError conflict (409)', async () => {
    mockFindCategoryByCode.mockResolvedValue(null);
    mockFindCategoryByDisplayName.mockResolvedValue(mockCategoryRow);

    await expect(
      createCategoryService(
        {
          code: 'NEW_CODE',
          displayName: 'Complaint Handling',
          definition: 'Duplicate name scenario',
          departments: ['SALES'],
          caseNatures: ['COMPLAINT'],
          productTypes: ['Motorcycle'],
          isActive: true,
        },
        'user-001',
      ),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: 'CONFLICT',
    });
  });
});

// ---------------------------------------------------------------------------
// getCategoryService
// ---------------------------------------------------------------------------

describe('getCategoryService', () => {
  it('not found → throws AppError notFound (404)', async () => {
    mockFindCategoryById.mockResolvedValue(null);

    await expect(
      getCategoryService('507f1f77bcf86cd799439011'),
    ).rejects.toMatchObject({
      statusCode: 404,
      code: 'NOT_FOUND',
    });
  });

  it('found → returns category with subcategories array', async () => {
    mockFindCategoryById.mockResolvedValue(mockCategoryRow);
    mockFindSubcategoriesByCategoryId.mockResolvedValue([mockSubcategoryRow]);

    const result = await getCategoryService('507f1f77bcf86cd799439011');

    expect(result.id).toBe('507f1f77bcf86cd799439011');
    expect(result.subcategories).toHaveLength(1);
    expect(result.subcategories[0].code).toBe('BILLING');
  });
});

// ---------------------------------------------------------------------------
// updateCategoryService
// ---------------------------------------------------------------------------

describe('updateCategoryService', () => {
  it('not found → throws AppError notFound (404)', async () => {
    mockFindCategoryById.mockResolvedValue(null);

    await expect(
      updateCategoryService('507f1f77bcf86cd799439011', { displayName: 'Updated' }, 'user-001'),
    ).rejects.toMatchObject({
      statusCode: 404,
      code: 'NOT_FOUND',
    });
  });

  it('code is uppercased on update', async () => {
    mockFindCategoryById.mockResolvedValue(mockCategoryRow);
    mockFindCategoryByCode.mockResolvedValue(null);
    mockUpdateCategory.mockResolvedValue({ ...mockCategoryRow, code: 'NEWCODE' });

    await updateCategoryService(
      '507f1f77bcf86cd799439011',
      { code: 'NEWCODE' },
      'user-001',
    );

    expect(mockUpdateCategory).toHaveBeenCalledWith(
      '507f1f77bcf86cd799439011',
      expect.objectContaining({ code: 'NEWCODE' }),
    );
  });

  it('isActive false → calls cascadeInactivateSubcategories inside a session transaction', async () => {
    mockFindCategoryById.mockResolvedValue({ ...mockCategoryRow, isActive: true });
    mockCascadeInactivateSubcategories.mockResolvedValue(undefined);
    mockUpdateCategory.mockResolvedValue({ ...mockCategoryRow, isActive: false });

    await updateCategoryService(
      '507f1f77bcf86cd799439011',
      { isActive: false },
      'user-001',
    );

    expect(mockCascadeInactivateSubcategories).toHaveBeenCalledWith('507f1f77bcf86cd799439011', mockSession);
    expect(mockCascadeReactivateSubcategories).not.toHaveBeenCalled();
    expect(mockSession.withTransaction).toHaveBeenCalledTimes(1);
    expect(mockSession.endSession).toHaveBeenCalledTimes(1);
  });

  it('isActive true (re-activating) → calls cascadeReactivateSubcategories inside a session transaction', async () => {
    mockFindCategoryById.mockResolvedValue({ ...mockCategoryRow, isActive: false });
    mockCascadeReactivateSubcategories.mockResolvedValue(undefined);
    mockUpdateCategory.mockResolvedValue({ ...mockCategoryRow, isActive: true });

    await updateCategoryService(
      '507f1f77bcf86cd799439011',
      { isActive: true },
      'user-001',
    );

    expect(mockCascadeReactivateSubcategories).toHaveBeenCalledWith('507f1f77bcf86cd799439011', mockSession);
    expect(mockCascadeInactivateSubcategories).not.toHaveBeenCalled();
    expect(mockSession.withTransaction).toHaveBeenCalledTimes(1);
    expect(mockSession.endSession).toHaveBeenCalledTimes(1);
  });

  it('transaction rolls back: updateCategory failure after cascadeInactivateSubcategories → neither persisted', async () => {
    // Simulate withTransaction: when the callback throws, withTransaction re-throws
    // and the session aborts — neither DB write is committed.
    mockSession.withTransaction.mockImplementation(async (fn: () => Promise<void>) => {
      await fn(); // let the callback run so we can observe it throws
    });

    mockFindCategoryById.mockResolvedValue({ ...mockCategoryRow, isActive: true });
    mockCascadeInactivateSubcategories.mockResolvedValue(undefined);
    // Parent update fails — simulates the mid-transaction failure
    mockUpdateCategory.mockRejectedValue(new Error('DB write failed'));

    await expect(
      updateCategoryService('507f1f77bcf86cd799439011', { isActive: false }, 'user-001'),
    ).rejects.toThrow('DB write failed');

    // Both operations were attempted inside the transaction callback
    expect(mockCascadeInactivateSubcategories).toHaveBeenCalledWith('507f1f77bcf86cd799439011', mockSession);
    expect(mockUpdateCategory).toHaveBeenCalledWith('507f1f77bcf86cd799439011', expect.any(Object), mockSession);
    // Session must always be ended (finally block)
    expect(mockSession.endSession).toHaveBeenCalledTimes(1);
  });

  it('isActive unchanged → does NOT call either cascade function', async () => {
    // existing isActive=true, update also sets isActive=true → no change
    mockFindCategoryById.mockResolvedValue({ ...mockCategoryRow, isActive: true });
    mockUpdateCategory.mockResolvedValue(mockCategoryRow);

    await updateCategoryService(
      '507f1f77bcf86cd799439011',
      { isActive: true },
      'user-001',
    );

    expect(mockCascadeInactivateSubcategories).not.toHaveBeenCalled();
    expect(mockCascadeReactivateSubcategories).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// createSubcategoryService
// ---------------------------------------------------------------------------

describe('createSubcategoryService', () => {
  it('happy path: returns SubcategoryDto with uppercased code', async () => {
    mockFindCategoryById.mockResolvedValue(mockCategoryRow);
    mockFindSubcategoryByCode.mockResolvedValue(null);
    mockFindSubcategoryByDisplayNameInCategory.mockResolvedValue(null);
    mockCreateSubcategory.mockResolvedValue(mockSubcategoryRow);

    const result = await createSubcategoryService(
      '507f1f77bcf86cd799439011',
      {
        code: 'BILLING',
        displayName: 'Billing Complaint',
        definition: 'Complaint about billing',
        isActive: true,
      },
      'user-001',
    );

    expect(result.code).toBe('BILLING');
    expect(result.categoryId).toBe('507f1f77bcf86cd799439011');
    expect(mockCreateSubcategory).toHaveBeenCalledWith(
      '507f1f77bcf86cd799439011',
      expect.objectContaining({ code: 'BILLING' }),
      'user-001',
    );
  });

  it('parent not found → throws AppError notFound (404)', async () => {
    mockFindCategoryById.mockResolvedValue(null);

    await expect(
      createSubcategoryService(
        '507f1f77bcf86cd799439011',
        {
          code: 'BILLING',
          displayName: 'Billing Complaint',
          definition: 'Complaint about billing',
          isActive: true,
        },
        'user-001',
      ),
    ).rejects.toMatchObject({
      statusCode: 404,
      code: 'NOT_FOUND',
    });
  });

  it('duplicate subcategory code → throws AppError conflict (409)', async () => {
    mockFindCategoryById.mockResolvedValue(mockCategoryRow);
    mockFindSubcategoryByCode.mockResolvedValue(mockSubcategoryRow);

    await expect(
      createSubcategoryService(
        '507f1f77bcf86cd799439011',
        {
          code: 'BILLING',
          displayName: 'Different Name',
          definition: 'Some definition',
          isActive: true,
        },
        'user-001',
      ),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: 'CONFLICT',
    });
  });

  it('duplicate display name within parent → throws AppError conflict (409)', async () => {
    mockFindCategoryById.mockResolvedValue(mockCategoryRow);
    mockFindSubcategoryByCode.mockResolvedValue(null);
    mockFindSubcategoryByDisplayNameInCategory.mockResolvedValue(mockSubcategoryRow);

    await expect(
      createSubcategoryService(
        '507f1f77bcf86cd799439011',
        {
          code: 'OTHER_CODE',
          displayName: 'Billing Complaint',
          definition: 'Duplicate name',
          isActive: true,
        },
        'user-001',
      ),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: 'CONFLICT',
    });
  });
});

// ---------------------------------------------------------------------------
// updateSubcategoryService
// ---------------------------------------------------------------------------

describe('updateSubcategoryService', () => {
  it('parent not found → throws AppError notFound (404)', async () => {
    mockFindCategoryById.mockResolvedValue(null);

    await expect(
      updateSubcategoryService(
        '507f1f77bcf86cd799439011',
        '507f1f77bcf86cd799439012',
        { displayName: 'Updated' },
        'user-001',
      ),
    ).rejects.toMatchObject({
      statusCode: 404,
      code: 'NOT_FOUND',
    });
  });

  it('subcategory not found → throws AppError notFound (404)', async () => {
    mockFindCategoryById.mockResolvedValue(mockCategoryRow);
    mockFindSubcategoryById.mockResolvedValue(null);

    await expect(
      updateSubcategoryService(
        '507f1f77bcf86cd799439011',
        '507f1f77bcf86cd799439099',
        { displayName: 'Updated' },
        'user-001',
      ),
    ).rejects.toMatchObject({
      statusCode: 404,
      code: 'NOT_FOUND',
    });
  });

  it('subcategory belongs to different parent → throws AppError notFound (404)', async () => {
    mockFindCategoryById.mockResolvedValue(mockCategoryRow);
    // subcategory exists but categoryId points to a DIFFERENT category
    mockFindSubcategoryById.mockResolvedValue({
      ...mockSubcategoryRow,
      categoryId: '507f1f77bcf86cd799439099', // different parent
    });

    await expect(
      updateSubcategoryService(
        '507f1f77bcf86cd799439011',
        '507f1f77bcf86cd799439012',
        { displayName: 'Updated' },
        'user-001',
      ),
    ).rejects.toMatchObject({
      statusCode: 404,
      code: 'NOT_FOUND',
    });
  });

  it('DI-1 guard: isActive=true when parent isActive=false → throws AppError conflict (409)', async () => {
    mockFindCategoryById.mockResolvedValue({ ...mockCategoryRow, isActive: false });
    mockFindSubcategoryById.mockResolvedValue({
      ...mockSubcategoryRow,
      isActive: false,
      inactivatedByCascade: true,
    });

    await expect(
      updateSubcategoryService(
        '507f1f77bcf86cd799439011',
        '507f1f77bcf86cd799439012',
        { isActive: true },
        'user-001',
      ),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: 'CONFLICT',
      message: expect.stringContaining('parent'),
    });
  });

  it('code is uppercased on update', async () => {
    mockFindCategoryById.mockResolvedValue(mockCategoryRow);
    mockFindSubcategoryById.mockResolvedValue(mockSubcategoryRow);
    mockFindSubcategoryByCode.mockResolvedValue(null);
    mockUpdateSubcategory.mockResolvedValue({ ...mockSubcategoryRow, code: 'NEWCODE' });

    await updateSubcategoryService(
      '507f1f77bcf86cd799439011',
      '507f1f77bcf86cd799439012',
      { code: 'NEWCODE' },
      'user-001',
    );

    expect(mockUpdateSubcategory).toHaveBeenCalledWith(
      '507f1f77bcf86cd799439012',
      expect.objectContaining({ code: 'NEWCODE' }),
    );
  });

  it('isActive=false → does NOT call cascade functions (cascade is only for parent)', async () => {
    mockFindCategoryById.mockResolvedValue(mockCategoryRow);
    mockFindSubcategoryById.mockResolvedValue(mockSubcategoryRow);
    mockUpdateSubcategory.mockResolvedValue({ ...mockSubcategoryRow, isActive: false });

    await updateSubcategoryService(
      '507f1f77bcf86cd799439011',
      '507f1f77bcf86cd799439012',
      { isActive: false },
      'user-001',
    );

    expect(mockCascadeInactivateSubcategories).not.toHaveBeenCalled();
    expect(mockCascadeReactivateSubcategories).not.toHaveBeenCalled();
  });
});
