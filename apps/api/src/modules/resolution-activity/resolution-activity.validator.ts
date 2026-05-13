// =============================================================================
// CCM API — Resolution Activity Validator
//
// Zod schema for the POST /resolution-activity endpoint.
// Source: CCM_Phase6_Resolution_Activities.md § Wave 2 Track D
// =============================================================================

import { z } from 'zod';

export const saveResolutionActivitySchema = z.object({
  caseId:      z.string().min(1),
  templateId:  z.string().min(1),
  stepNo:      z.number().int().positive(),
  activityId:  z.string().min(1),
  outcomeName: z.string().min(1).max(200),
  outcomeType: z.enum(['MoveForward', 'Loop', 'Close']),
  remarks:     z
    .string()
    .min(1, 'Please enter remarks.')
    .max(500)
    .transform((s) => s.trim()),
  attachmentId: z.string().optional(),  // MongoDB ObjectId of an uploaded attachment, if any
  version:      z.number().int().min(0), // optimistic lock version read from state; 0 = no row yet (first save)
});

export type SaveResolutionActivityInput = z.infer<typeof saveResolutionActivitySchema>;
