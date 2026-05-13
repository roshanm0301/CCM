// =============================================================================
// CCM API — Case Category Service
//
// Business logic for case category and subcategory management.
// Source: CCM_Phase3_CaseCategory_Master.md
// =============================================================================

import mongoose from 'mongoose';
import { AppError } from '../../shared/errors/AppError';
import { getPool } from '../../shared/database/postgres';
import type { CreateCategoryInput, UpdateCategoryInput, CreateSubcategoryInput, UpdateSubcategoryInput } from './case-category.validator';
import {
  findAllCategories,
  findCategoryById,
  findCategoryByCode,
  findCategoryByDisplayName,
  createCategory,
  updateCategory,
  findSubcategoriesByCategoryId,
  findSubcategoryById,
  findSubcategoryByCode,
  findSubcategoryByDisplayNameInCategory,
  createSubcategory,
  updateSubcategory,
  cascadeInactivateSubcategories,
  cascadeReactivateSubcategories,
  findReferenceValuesByType,
  type CategoryRow,
  type SubcategoryRow,
  type ReferenceValueRow,
} from './case-category.repository';

// ---------------------------------------------------------------------------
// Response shapes
// ---------------------------------------------------------------------------

export interface CategoryDto {
  id: string;
  code: string;
  displayName: string;
  definition: string;
  departments: string[];
  caseNatures: string[];
  productTypes: string[];
  isActive: boolean;
  subcategoryCount?: number;
  subcategories?: SubcategoryDto[];
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SubcategoryDto {
  id: string;
  categoryId: string;
  code: string;
  displayName: string;
  definition: string;
  isActive: boolean;
  inactivatedByCascade: boolean;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toCategoryDto(row: CategoryRow): CategoryDto {
  return {
    id: row.id,
    code: row.code,
    displayName: row.displayName,
    definition: row.definition,
    departments: row.departments,
    caseNatures: row.caseNatures,
    productTypes: row.productTypes,
    isActive: row.isActive,
    subcategoryCount: row.subcategoryCount,
    createdBy: row.createdBy,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toSubcategoryDto(row: SubcategoryRow): SubcategoryDto {
  return {
    id: row.id,
    categoryId: row.categoryId,
    code: row.code,
    displayName: row.displayName,
    definition: row.definition,
    isActive: row.isActive,
    inactivatedByCascade: row.inactivatedByCascade,
    createdBy: row.createdBy,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Category services
// ---------------------------------------------------------------------------

/** Return all categories with subcategory count. */
export async function listCategoriesService(): Promise<CategoryDto[]> {
  const rows = await findAllCategories();
  return rows.map(toCategoryDto);
}

/** Return a single category with its subcategories. */
export async function getCategoryService(id: string): Promise<CategoryDto & { subcategories: SubcategoryDto[] }> {
  const category = await findCategoryById(id);
  if (!category) {
    throw AppError.notFound('Case Category', id);
  }
  const subcategoryRows = await findSubcategoriesByCategoryId(id);
  return {
    ...toCategoryDto(category),
    subcategories: subcategoryRows.map(toSubcategoryDto),
  };
}

/** Create a new case category. */
export async function createCategoryService(
  input: CreateCategoryInput,
  userId: string,
): Promise<CategoryDto> {
  const uppercasedCode = input.code.toUpperCase();
  const normalizedInput = { ...input, code: uppercasedCode };

  // Uniqueness: code
  const existingByCode = await findCategoryByCode(uppercasedCode);
  if (existingByCode) {
    throw AppError.conflict(`A Case Category with code '${uppercasedCode}' already exists`);
  }

  // Uniqueness: display name (case-insensitive)
  const existingByName = await findCategoryByDisplayName(normalizedInput.displayName);
  if (existingByName) {
    throw AppError.conflict(`A Case Category with display name '${normalizedInput.displayName}' already exists`);
  }

  const row = await createCategory(normalizedInput, userId);
  return toCategoryDto(row);
}

/** Update an existing case category; handle cascade on is_active changes. */
export async function updateCategoryService(
  id: string,
  input: UpdateCategoryInput,
  _userId: string,
): Promise<CategoryDto> {
  const existing = await findCategoryById(id);
  if (!existing) {
    throw AppError.notFound('Case Category', id);
  }

  const uppercasedCode = input.code !== undefined ? input.code.toUpperCase() : undefined;
  const normalizedInput = { ...input, code: uppercasedCode };

  // Uniqueness: code (excluding self)
  if (uppercasedCode !== undefined && uppercasedCode !== existing.code) {
    const conflict = await findCategoryByCode(uppercasedCode);
    if (conflict) {
      throw AppError.conflict(`A Case Category with code '${uppercasedCode}' already exists`);
    }
  }

  // Uniqueness: display name (excluding self, case-insensitive)
  if (
    normalizedInput.displayName !== undefined &&
    normalizedInput.displayName.toLowerCase() !== existing.displayName.toLowerCase()
  ) {
    const conflict = await findCategoryByDisplayName(normalizedInput.displayName, id);
    if (conflict) {
      throw AppError.conflict(`A Case Category with display name '${normalizedInput.displayName}' already exists`);
    }
  }

  // Cascade inactivation / reactivation — wrapped in a MongoDB session transaction
  // so that the subcategory update and the parent category update commit atomically.
  if (normalizedInput.isActive !== undefined && normalizedInput.isActive !== existing.isActive) {
    let session;
    try {
      session = await mongoose.startSession();
    } catch (err) {
      // MongoDB session start failed (e.g. replica set unavailable).
      // Re-throw as a service error so the caller receives a clean 500.
      throw err;
    }
    try {
      let updated: CategoryRow;
      await session.withTransaction(async () => {
        if (!normalizedInput.isActive) {
          // Category is being inactivated — cascade to active subcategories
          await cascadeInactivateSubcategories(id, session);
        } else {
          // Category is being reactivated — reactivate cascade-inactivated subcategories
          await cascadeReactivateSubcategories(id, session);
        }
        updated = await updateCategory(id, normalizedInput, session);
      });
      return toCategoryDto(updated!);
    } finally {
      await session.endSession();
    }
  }

  const updated = await updateCategory(id, normalizedInput);
  return toCategoryDto(updated);
}

// ---------------------------------------------------------------------------
// Subcategory services
// ---------------------------------------------------------------------------

/** Create a new subcategory under the given category. */
export async function createSubcategoryService(
  categoryId: string,
  input: CreateSubcategoryInput,
  userId: string,
): Promise<SubcategoryDto> {
  // Verify parent exists
  const category = await findCategoryById(categoryId);
  if (!category) {
    throw AppError.notFound('Case Category', categoryId);
  }

  const uppercasedCode = input.code.toUpperCase();
  const normalizedInput = { ...input, code: uppercasedCode };

  // Global code uniqueness
  const existingByCode = await findSubcategoryByCode(uppercasedCode);
  if (existingByCode) {
    throw AppError.conflict(`A Case Subcategory with code '${uppercasedCode}' already exists`);
  }

  // Display name unique within parent (case-insensitive)
  const existingByName = await findSubcategoryByDisplayNameInCategory(
    normalizedInput.displayName,
    categoryId,
  );
  if (existingByName) {
    throw AppError.conflict(
      `A Case Subcategory with display name '${normalizedInput.displayName}' already exists in this category`,
    );
  }

  const row = await createSubcategory(categoryId, normalizedInput, userId);
  return toSubcategoryDto(row);
}

/** Update an existing subcategory. */
export async function updateSubcategoryService(
  categoryId: string,
  subcategoryId: string,
  input: UpdateSubcategoryInput,
  _userId: string,
): Promise<SubcategoryDto> {
  // Verify parent exists
  const category = await findCategoryById(categoryId);
  if (!category) {
    throw AppError.notFound('Case Category', categoryId);
  }

  // Find the subcategory directly by ID (O(1) — avoids loading all siblings)
  const existing = await findSubcategoryById(subcategoryId);
  // Verify ownership: the subcategory must belong to the given category
  if (!existing || existing.categoryId !== categoryId) {
    throw AppError.notFound('Case Subcategory', subcategoryId);
  }

  // Guard: cannot manually reactivate a subcategory whose parent is inactive
  if (input.isActive === true && !category.isActive) {
    throw AppError.conflict(
      'Cannot activate a subcategory while its parent Case Category is inactive. Activate the parent category first.',
    );
  }

  const uppercasedCode = input.code !== undefined ? input.code.toUpperCase() : undefined;
  const normalizedInput = { ...input, code: uppercasedCode };

  // Global code uniqueness (excluding self)
  if (uppercasedCode !== undefined && uppercasedCode !== existing.code) {
    const conflict = await findSubcategoryByCode(uppercasedCode, subcategoryId);
    if (conflict) {
      throw AppError.conflict(`A Case Subcategory with code '${uppercasedCode}' already exists`);
    }
  }

  // Display name uniqueness within parent (excluding self, case-insensitive)
  if (
    normalizedInput.displayName !== undefined &&
    normalizedInput.displayName.toLowerCase() !== existing.displayName.toLowerCase()
  ) {
    const conflict = await findSubcategoryByDisplayNameInCategory(
      normalizedInput.displayName,
      categoryId,
      subcategoryId,
    );
    if (conflict) {
      throw AppError.conflict(
        `A Case Subcategory with display name '${normalizedInput.displayName}' already exists in this category`,
      );
    }
  }

  const updated = await updateSubcategory(subcategoryId, normalizedInput);
  return toSubcategoryDto(updated);
}

// ---------------------------------------------------------------------------
// Lookup services — reference master data for form dropdowns
// ---------------------------------------------------------------------------

/** Return all active departments, ordered by sortOrder. */
export async function listDepartmentsService(): Promise<ReferenceValueRow[]> {
  return findReferenceValuesByType('department');
}

/** Return all active case natures, ordered by sortOrder. */
export async function listCaseNaturesService(): Promise<ReferenceValueRow[]> {
  return findReferenceValuesByType('case_nature');
}

/** Return all active priorities, ordered by sortOrder. */
export async function listPrioritiesService(): Promise<ReferenceValueRow[]> {
  return findReferenceValuesByType('priority');
}

/**
 * Fix 12: Product types from PostgreSQL reference_values — no longer hardcoded.
 * Shared source of truth with the Activity Template product-types lookup.
 */
export async function listProductTypesService(): Promise<ReferenceValueRow[]> {
  const result = await getPool().query<{ code: string; label: string }>(
    `SELECT code, label
       FROM reference_values
      WHERE reference_type = 'product_type'
        AND is_active = TRUE
      ORDER BY sort_order ASC`,
  );
  return result.rows;
}
