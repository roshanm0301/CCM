/**
 * Case Category API client.
 * Source: CCM_Phase3_CaseCategory_Master.md
 */

import { apiClient } from '@/shared/api/client';

// ---------------------------------------------------------------------------
// Types
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

export interface CreateCategoryPayload {
  code: string;
  displayName: string;
  definition: string;
  departments: string[];
  caseNatures: string[];
  productTypes: string[];
  isActive?: boolean;
}

export interface UpdateCategoryPayload extends Partial<CreateCategoryPayload> {
  isActive?: boolean;
}

export interface CreateSubcategoryPayload {
  code: string;
  displayName: string;
  definition: string;
  isActive?: boolean;
}

export interface UpdateSubcategoryPayload extends Partial<CreateSubcategoryPayload> {
  isActive?: boolean;
}

export interface LookupValue {
  code: string;
  label?: string;
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
}

// ---------------------------------------------------------------------------
// Category API
// ---------------------------------------------------------------------------

export async function fetchCategories(): Promise<CategoryDto[]> {
  const res = await apiClient.get<ApiResponse<CategoryDto[]>>('/api/v1/case-categories');
  return res.data.data;
}

export async function fetchCategory(id: string): Promise<CategoryDto> {
  const res = await apiClient.get<ApiResponse<CategoryDto>>(`/api/v1/case-categories/${id}`);
  return res.data.data;
}

export async function createCategory(payload: CreateCategoryPayload): Promise<CategoryDto> {
  const res = await apiClient.post<ApiResponse<CategoryDto>>('/api/v1/case-categories', payload);
  return res.data.data;
}

export async function updateCategory(
  id: string,
  payload: UpdateCategoryPayload,
): Promise<CategoryDto> {
  const res = await apiClient.patch<ApiResponse<CategoryDto>>(
    `/api/v1/case-categories/${id}`,
    payload,
  );
  return res.data.data;
}

// ---------------------------------------------------------------------------
// Subcategory API
// ---------------------------------------------------------------------------

export async function createSubcategory(
  categoryId: string,
  payload: CreateSubcategoryPayload,
): Promise<SubcategoryDto> {
  const res = await apiClient.post<ApiResponse<SubcategoryDto>>(
    `/api/v1/case-categories/${categoryId}/subcategories`,
    payload,
  );
  return res.data.data;
}

export async function updateSubcategory(
  categoryId: string,
  id: string,
  payload: UpdateSubcategoryPayload,
): Promise<SubcategoryDto> {
  const res = await apiClient.patch<ApiResponse<SubcategoryDto>>(
    `/api/v1/case-categories/${categoryId}/subcategories/${id}`,
    payload,
  );
  return res.data.data;
}

// ---------------------------------------------------------------------------
// Lookup API
// ---------------------------------------------------------------------------

export async function fetchDepartments(): Promise<LookupValue[]> {
  const res = await apiClient.get<ApiResponse<LookupValue[]>>(
    '/api/v1/case-categories/lookups/departments',
  );
  return res.data.data;
}

export async function fetchCaseNatures(): Promise<LookupValue[]> {
  const res = await apiClient.get<ApiResponse<LookupValue[]>>(
    '/api/v1/case-categories/lookups/case-natures',
  );
  return res.data.data;
}

export async function fetchProductTypes(): Promise<LookupValue[]> {
  const res = await apiClient.get<ApiResponse<LookupValue[]>>(
    '/api/v1/case-categories/lookups/product-types',
  );
  return res.data.data;
}

export async function fetchPriorities(): Promise<LookupValue[]> {
  const res = await apiClient.get<ApiResponse<LookupValue[]>>(
    '/api/v1/case-categories/lookups/priorities',
  );
  return res.data.data;
}
