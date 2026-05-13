// =============================================================================
// CCM API — Cases Validator
//
// Zod schema for case creation request body validation.
// =============================================================================

import { z } from 'zod';

export const createCaseSchema = z.object({
  interactionId:     z.string().uuid('interactionId must be a valid UUID'),
  customerRef:       z.string().min(1),
  vehicleRef:        z.string().nullable().optional(),
  caseNature:        z.string().min(1),
  department:        z.string().min(1),
  priority:          z.string().nullable().optional(),
  productType:       z.string().min(1),
  productTypeSource: z.enum(['Derived', 'Manually Selected']),
  caseCategoryId:    z.string().min(1).regex(/^[0-9a-fA-F]{24}$/, 'Must be a valid resource ID'),
  caseSubcategoryId: z.string().min(1).regex(/^[0-9a-fA-F]{24}$/, 'Must be a valid resource ID'),
  customerRemarks:   z.string().min(1).max(1000, 'Customer remarks cannot exceed 1000 characters'),
  agentRemarks:      z.string().min(1).max(1000, 'Agent remarks cannot exceed 1000 characters'),
  dealerRef:         z.string().min(1, 'dealerRef is required').regex(/^DLR-\d{3}$/, 'dealerRef must be a valid dealer code (e.g. DLR-001)'),
});

export type CreateCaseInput = z.infer<typeof createCaseSchema>;
