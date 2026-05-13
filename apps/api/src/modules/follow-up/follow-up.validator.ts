// =============================================================================
// CCM API — Follow-Up Validator
//
// Zod schema for adding a follow-up entry against a registered case.
// =============================================================================

import { z } from 'zod';

export const addFollowUpSchema = z.object({
  caseId:           z.string().min(1),
  customerRemarks:  z.string().min(1, 'Please enter customer remarks.').max(500).transform((s) => s.trim()),
  agentRemarks:     z.string().min(1, 'Please enter agent remarks.').max(500).transform((s) => s.trim()),
  callRecordingLink: z.string().url().optional(),
});

export type AddFollowUpInput = z.infer<typeof addFollowUpSchema>;
