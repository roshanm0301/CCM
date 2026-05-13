/**
 * Activity Master API client.
 * Source: CCM_Phase5_ActivityFlowConfiguration.md § Feature 1
 */

import { apiClient } from '@/shared/api/client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ActivityMasterDto {
  id: string;
  code: string;
  displayName: string;
  description: string;
  isActive: boolean;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateActivityPayload {
  code: string;
  displayName: string;
  description?: string;
  isActive?: boolean;
}

export interface UpdateActivityPayload {
  code?: string;
  displayName?: string;
  description?: string;
  isActive?: boolean;
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
}

// ---------------------------------------------------------------------------
// API functions
// ---------------------------------------------------------------------------

export async function fetchActivities(): Promise<ActivityMasterDto[]> {
  const res = await apiClient.get<ApiResponse<ActivityMasterDto[]>>('/api/v1/activity-master');
  return res.data.data;
}

export async function fetchActiveActivities(): Promise<ActivityMasterDto[]> {
  const res = await apiClient.get<ApiResponse<ActivityMasterDto[]>>('/api/v1/activity-master/active');
  return res.data.data;
}

export async function createActivity(payload: CreateActivityPayload): Promise<ActivityMasterDto> {
  const res = await apiClient.post<ApiResponse<ActivityMasterDto>>('/api/v1/activity-master', payload);
  return res.data.data;
}

export async function updateActivity(id: string, payload: UpdateActivityPayload): Promise<ActivityMasterDto> {
  const res = await apiClient.patch<ApiResponse<ActivityMasterDto>>(
    `/api/v1/activity-master/${id}`,
    payload,
  );
  return res.data.data;
}
