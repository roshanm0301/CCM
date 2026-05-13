/**
 * Cases API client.
 * Source: CCM Phase 4 Case Creation Workspace spec.
 */

import { apiClient } from '@/shared/api/client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CaseHistoryItem {
  id: string;
  caseId: string;
  caseNature: string;
  caseStatus: string;
  activityStatus: string;
  registeredAt: string;
}

export interface CaseHistoryResponse {
  cases: CaseHistoryItem[];
  openCaseCount: number;
}

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  existingCase?: {
    caseId: string;
    caseNature: string;
    documentStatus: string;
    registeredAt: string;
  };
}

export interface DealerItem {
  id: string;
  dealerCode: string;
  dealerName: string;
  branchCode: string;
  branchName: string;
  contactNumber: string;
  address: string;
  state: string;
  city: string;
  pinCode: string;
  isActive: boolean;
  productTypes: string[];
}

export interface DealerSearchResponse {
  dealers: DealerItem[];
  hasActiveDealer: boolean;
}

export interface CreateCasePayload {
  interactionId: string;
  customerRef: string;
  vehicleRef?: string | null;
  caseNature: string;
  department: string;
  priority?: string | null;
  productType: string;
  productTypeSource: 'Derived' | 'Manually Selected';
  caseCategoryId: string;
  caseSubcategoryId: string;
  customerRemarks: string;
  agentRemarks: string;
  dealerRef: string;
}

export interface CaseDto {
  id: string;
  caseId: string;
  interactionId: string;
  customerRef: string;
  vehicleRef: string | null;
  dealerRef: string;
  caseNature: string;
  department: string;
  priority: string | null;
  productType: string;
  productTypeSource: string;
  caseCategoryId: string;
  caseSubcategoryId: string;
  customerRemarks: string;
  agentRemarks: string;
  caseStatus: string;
  activityStatus: string;
  registeredAt: string;
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
}

// ---------------------------------------------------------------------------
// API functions
// ---------------------------------------------------------------------------

export async function fetchCaseHistory(customerRef: string): Promise<CaseHistoryResponse> {
  const res = await apiClient.get<ApiResponse<CaseHistoryResponse>>(
    `/api/v1/cases/history?customerRef=${encodeURIComponent(customerRef)}`,
  );
  return res.data.data;
}

export async function checkDuplicate(params: {
  customerRef: string;
  vehicleRef?: string | null;
  caseNature: string;
  department: string;
  caseCategoryId: string;
  caseSubcategoryId: string;
}): Promise<DuplicateCheckResult> {
  const query = new URLSearchParams({
    customerRef: params.customerRef,
    caseNature: params.caseNature,
    department: params.department,
    caseCategoryId: params.caseCategoryId,
    caseSubcategoryId: params.caseSubcategoryId,
  });
  if (params.vehicleRef) query.set('vehicleRef', params.vehicleRef);
  const res = await apiClient.get<ApiResponse<DuplicateCheckResult>>(
    `/api/v1/cases/duplicate-check?${query.toString()}`,
  );
  return res.data.data;
}

export async function createCase(payload: CreateCasePayload): Promise<CaseDto> {
  const res = await apiClient.post<ApiResponse<CaseDto>>('/api/v1/cases', payload);
  return res.data.data;
}

export async function getCaseById(id: string): Promise<CaseDto> {
  const res = await apiClient.get<ApiResponse<CaseDto>>(`/api/v1/cases/${id}`);
  return res.data.data;
}

export async function getCaseByInteractionId(interactionId: string): Promise<CaseDto | null> {
  const res = await apiClient.get<ApiResponse<CaseDto | null>>(
    `/api/v1/cases/interaction/${interactionId}`,
  );
  return res.data.data;
}

export async function searchDealers(params: {
  productType: string;
  search?: string;
  state?: string;
  city?: string;
  pinCode?: string;
}): Promise<DealerSearchResponse> {
  const query = new URLSearchParams({ productType: params.productType });
  if (params.search) query.set('search', params.search);
  if (params.state) query.set('state', params.state);
  if (params.city) query.set('city', params.city);
  if (params.pinCode) query.set('pinCode', params.pinCode);
  const res = await apiClient.get<ApiResponse<DealerSearchResponse>>(
    `/api/v1/dealers?${query.toString()}`,
  );
  return res.data.data;
}

// ---------------------------------------------------------------------------
// Phase 6 additions
// ---------------------------------------------------------------------------

export interface CaseDetailDto extends CaseDto {
  currentStepNo: number | null;
  currentStepTemplateId: string | null;
  activityStateVersion: number | null;
  interactionChannel: 'inbound_call' | 'manual' | null;
}

/**
 * Fetch full case detail including current activity-state fields.
 * Source: CCM_Phase6_Resolution_Activities.md § Post-Case-Registration Screen
 */
export async function getCaseDetail(caseId: string): Promise<CaseDetailDto> {
  const res = await apiClient.get<ApiResponse<CaseDetailDto>>(
    `/api/v1/cases/detail?caseId=${encodeURIComponent(caseId)}`,
  );
  return res.data.data;
}
