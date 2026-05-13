/**
 * Attachment API client.
 * Source: CCM_Phase6_Resolution_Activities.md § File Attachments
 */

import { apiClient, type ApiResponse } from '@/shared/api/client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AttachmentDto {
  id: string;
  caseId: string;
  stepNo: number;
  originalFilename: string;
  contentType: string;
  sizeBytes: number;
  createdAt: string;
  /** Only present on getAttachment (single-item fetch). */
  base64Content?: string;
}

export interface UploadAttachmentPayload {
  caseId: string;
  stepNo: number;
  filename: string;
  contentType: string;
  base64Content: string;
}

// ---------------------------------------------------------------------------
// API functions
// ---------------------------------------------------------------------------

/**
 * Upload a file attachment for a resolution activity step.
 * Returns the stored metadata without base64Content.
 */
export async function uploadAttachment(
  payload: UploadAttachmentPayload,
): Promise<Omit<AttachmentDto, 'base64Content'>> {
  const res = await apiClient.post<ApiResponse<Omit<AttachmentDto, 'base64Content'>>>(
    '/api/v1/attachments',
    payload,
    { timeout: 120_000 }, // 2-minute timeout for base64 file uploads
  );
  return res.data.data;
}

/**
 * Fetch a single attachment by ID, including its base64-encoded file content.
 */
export async function getAttachment(id: string): Promise<AttachmentDto> {
  const res = await apiClient.get<ApiResponse<AttachmentDto>>(
    `/api/v1/attachments/${encodeURIComponent(id)}`,
  );
  return res.data.data;
}

/**
 * Fetch all attachments for a case (metadata only, no base64Content).
 */
export async function getAttachmentsByCaseId(
  caseId: string,
): Promise<Omit<AttachmentDto, 'base64Content'>[]> {
  const res = await apiClient.get<ApiResponse<Omit<AttachmentDto, 'base64Content'>[]>>(
    `/api/v1/attachments?caseId=${encodeURIComponent(caseId)}`,
  );
  return res.data.data;
}
