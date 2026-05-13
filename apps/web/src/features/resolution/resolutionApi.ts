/**
 * Resolution Activities API client.
 * Source: CCM_Phase6_Resolution_Activities.md § Resolution Tab
 */

import { apiClient, type ApiResponse } from '@/shared/api/client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface OutcomeDto {
  outcomeName: string;
  outcomeType: 'Loop' | 'MoveForward' | 'Close';
  nextStepNo: number | null;
  roleOverride: string | null;
}

export interface CurrentActivityDto {
  activityId: string;
  stepNo: number;
  assignedRole: string;
  isMandatory: boolean;
  slaValue: number | null;
  slaUnit: string | null;
  outcomes: OutcomeDto[];
}

export interface ResolutionActivityDto {
  id: string;
  caseId: string;
  templateId: string;
  stepNo: number;
  activityId: string;
  outcomeName: string;
  outcomeType: string;
  performedRole: string;
  performedByUserId: string;
  remarks: string;
  attachmentIds: string[];
  createdAt: string;
}

export interface ResolutionTabDto {
  caseId: string;
  templateId: string;
  currentStepNo: number;
  caseStatus: string;
  activityStatus: string;
  version: number;
  currentActivity: CurrentActivityDto;
  history: ResolutionActivityDto[];
}

export interface SaveActivityPayload {
  caseId: string;
  templateId: string;
  stepNo: number;
  activityId: string;
  outcomeName: string;
  outcomeType: string;
  remarks: string;
  attachmentId?: string;
  version: number;
}

export interface SaveActivityResult {
  savedActivity: ResolutionActivityDto;
  updatedState: {
    currentStepNo: number;
    caseStatus: string;
    activityStatus: string;
    version: number;
  };
  caseClosed: boolean;
}

// ---------------------------------------------------------------------------
// API functions
// ---------------------------------------------------------------------------

/**
 * Load the resolution tab state for a case, resolving the matching activity
 * template from caseNature, department, and productType.
 */
export async function loadResolutionTab(
  caseId: string,
  caseNature: string,
  department: string,
  productType: string,
): Promise<ResolutionTabDto> {
  const query = new URLSearchParams({ caseId, caseNature, department, productType });
  const res = await apiClient.get<ApiResponse<ResolutionTabDto>>(
    `/api/v1/resolution-activities?${query.toString()}`,
  );
  return res.data.data;
}

/**
 * Submit a resolution activity step and advance the case workflow.
 */
export async function saveResolutionActivity(
  payload: SaveActivityPayload,
): Promise<SaveActivityResult> {
  const res = await apiClient.post<ApiResponse<SaveActivityResult>>(
    '/api/v1/resolution-activities',
    payload,
  );
  return res.data.data;
}

/**
 * Retrieve the full resolution activity history for a case.
 */
export async function getResolutionHistory(
  caseId: string,
): Promise<ResolutionActivityDto[]> {
  const query = new URLSearchParams({ caseId });
  const res = await apiClient.get<ApiResponse<ResolutionActivityDto[]>>(
    `/api/v1/resolution-activities/history?${query.toString()}`,
  );
  return res.data.data;
}
