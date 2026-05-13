// =============================================================================
// CCM API — Attachment Validator
//
// Zod schema for upload attachment request body validation.
// sizeBytes is NOT accepted from the caller — it is computed in the service
// from base64Content.length.
// =============================================================================

import { z } from 'zod';

export const uploadAttachmentSchema = z.object({
  caseId:        z.string().min(1),
  stepNo:        z.number().int().positive(),
  filename:      z.string().min(1).max(500),
  contentType:   z.enum(['application/pdf', 'image/jpeg', 'image/jpg', 'image/png']),
  base64Content: z.string().min(1).max(7_340_032),
});

export type UploadAttachmentInput = z.infer<typeof uploadAttachmentSchema>;
