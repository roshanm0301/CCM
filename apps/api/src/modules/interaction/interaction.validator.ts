// =============================================================================
// CCM API — Interaction Input Validators (Zod)
// =============================================================================

import { z } from 'zod';

export const updateContextSchema = z.object({
  customerRef: z.string().min(1, 'customerRef is required'),
  vehicleRef: z.string().nullable().optional(),
  dealerRef: z.string().nullable().optional(),
  isReselection: z.boolean().default(false),
  customerPhoneNumber: z.string().nullable().optional(),
});

export type UpdateContextInput = z.infer<typeof updateContextSchema>;

// Dispositions that require a non-empty remarks value.
// Source: CCM_Phase1_Agent_Interaction_Documentation.md §C6
const REMARKS_REQUIRED_DISPOSITIONS = new Set([
  'no_match_found',
  'technical_issue',
  'abusive_caller',
  'others',
  'incomplete_interaction',
]);

export const saveWrapupSchema = z
  .object({
    contactReasonCode: z.string().min(1, 'Select Contact Reason.'),
    identificationOutcomeCode: z.string().min(1, 'Select Identification Outcome.'),
    interactionDispositionCode: z.string().min(1, 'Select Interaction Disposition.'),
    remarks: z.string().max(1000, 'Remarks must be 1000 characters or fewer.').nullable().optional(),
  })
  .superRefine((data, ctx) => {
    if (
      REMARKS_REQUIRED_DISPOSITIONS.has(data.interactionDispositionCode) &&
      (!data.remarks || data.remarks.trim().length === 0)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Remarks are required for this disposition',
        path: ['remarks'],
      });
    }
  });

export type SaveWrapupInput = z.infer<typeof saveWrapupSchema>;
