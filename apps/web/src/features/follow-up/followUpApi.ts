/**
 * Follow Up API client.
 * Source: CCM_Phase6_Resolution_Activities.md § Follow Up Tab
 */

import { apiClient } from '@/shared/api/client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FollowUpDto {
  id: string;
  caseId: string;
  customerRemarks: string;
  agentRemarks: string;
  agentName: string;
  callRecordingLink: string | null;
  createdAt: string;
}

export interface AddFollowUpPayload {
  caseId: string;
  customerRemarks: string;
  agentRemarks: string;
  callRecordingLink?: string;
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
}

// ---------------------------------------------------------------------------
// API functions
// ---------------------------------------------------------------------------

/**
 * Add an immutable follow-up entry to a case.
 */
export async function addFollowUp(payload: AddFollowUpPayload): Promise<FollowUpDto> {
  const res = await apiClient.post<ApiResponse<FollowUpDto>>('/api/v1/follow-ups', payload);
  return res.data.data;
}

/**
 * Retrieve the full follow-up history for a case.
 */
export async function getFollowUpHistory(caseId: string): Promise<FollowUpDto[]> {
  const res = await apiClient.get<ApiResponse<FollowUpDto[]>>(
    `/api/v1/follow-ups?caseId=${encodeURIComponent(caseId)}`,
  );
  return res.data.data;
}
