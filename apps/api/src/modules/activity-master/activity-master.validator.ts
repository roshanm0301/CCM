// =============================================================================
// CCM API — Activity Master Validator
//
// Zod schemas for activity master create/update operations.
// Source: CCM_Phase5_ActivityFlowConfiguration.md § Feature 1
// =============================================================================

import { z } from 'zod';

export const createActivitySchema = z.object({
  code: z
    .string()
    .trim()
    .min(1, 'Code is required.')
    .max(30, 'Code must be at most 30 characters.'),
  displayName: z
    .string()
    .trim()
    .min(1, 'Display Name is required.')
    .max(150, 'Display Name must be at most 150 characters.'),
  description: z
    .string()
    .trim()
    .max(500, 'Description must be at most 500 characters.')
    .optional()
    .default(''),
  isActive: z.boolean().optional().default(true),
});

export const updateActivitySchema = createActivitySchema.partial().extend({
  isActive: z.boolean().optional(),
});

export type CreateActivityInput = z.infer<typeof createActivitySchema>;
export type UpdateActivityInput = z.infer<typeof updateActivitySchema>;
