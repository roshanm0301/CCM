/**
 * Activity Template API client.
 * Source: CCM_Phase5_ActivityFlowConfiguration.md § Features 3–7
 */

import { apiClient } from '@/shared/api/client';
import type { ActivityMasterDto } from '@/features/activity-master/activityMasterApi';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface OutcomeDto {
  outcomeName: string;
  outcomeType: 'MoveForward' | 'Loop' | 'Close';
  nextStepNo: number | null;
  roleOverride: string | null;
  requiresOtpVerification: boolean;
}

export interface StepDto {
  stepNo: number;
  activityId: string;
  assignedRole: string;
  slaValue: number | null;
  slaUnit: 'Hours' | 'Days' | null;
  weightPercentage: number;
  isMandatory: boolean;
  isStartStep: boolean;
  outcomes: OutcomeDto[];
}

export interface ActivityTemplateSummaryDto {
  id: string;
  templateName: string;
  appliesTo: string;
  department: string;
  productType: string;
  isActive: boolean;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ActivityTemplateFullDto extends ActivityTemplateSummaryDto {
  steps: StepDto[];
}

export interface CreateTemplatePayload {
  templateName: string;
  appliesTo: string;
  department: string;
  productType: string;
  isActive?: boolean;
  steps: StepDto[];
}

export interface LookupValue {
  code: string;
  label: string;
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
}

// ---------------------------------------------------------------------------
// Template API
// ---------------------------------------------------------------------------

export async function fetchTemplates(): Promise<ActivityTemplateSummaryDto[]> {
  const res = await apiClient.get<ApiResponse<ActivityTemplateSummaryDto[]>>('/api/v1/activity-templates');
  return res.data.data;
}

export async function fetchTemplate(id: string): Promise<ActivityTemplateFullDto> {
  const res = await apiClient.get<ApiResponse<ActivityTemplateFullDto>>(`/api/v1/activity-templates/${id}`);
  return res.data.data;
}

export async function createTemplate(payload: CreateTemplatePayload): Promise<ActivityTemplateFullDto> {
  const res = await apiClient.post<ApiResponse<ActivityTemplateFullDto>>(
    '/api/v1/activity-templates',
    payload,
  );
  return res.data.data;
}

export async function updateTemplate(
  id: string,
  payload: CreateTemplatePayload,
): Promise<ActivityTemplateFullDto> {
  const res = await apiClient.patch<ApiResponse<ActivityTemplateFullDto>>(
    `/api/v1/activity-templates/${id}`,
    payload,
  );
  return res.data.data;
}

// ---------------------------------------------------------------------------
// Lookup API
// ---------------------------------------------------------------------------

export async function fetchTemplateDepartments(): Promise<LookupValue[]> {
  const res = await apiClient.get<ApiResponse<LookupValue[]>>('/api/v1/activity-templates/lookups/departments');
  return res.data.data;
}

export async function fetchTemplateProductTypes(): Promise<LookupValue[]> {
  const res = await apiClient.get<ApiResponse<LookupValue[]>>('/api/v1/activity-templates/lookups/product-types');
  return res.data.data;
}

export async function fetchTemplateAppliesTo(): Promise<LookupValue[]> {
  const res = await apiClient.get<ApiResponse<LookupValue[]>>('/api/v1/activity-templates/lookups/applies-to');
  return res.data.data;
}

export async function fetchTemplateRoles(): Promise<LookupValue[]> {
  const res = await apiClient.get<ApiResponse<LookupValue[]>>('/api/v1/activity-templates/lookups/roles');
  return res.data.data;
}

export { fetchActiveActivities } from '@/features/activity-master/activityMasterApi';
export type { ActivityMasterDto };
