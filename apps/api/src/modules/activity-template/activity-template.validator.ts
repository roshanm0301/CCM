// =============================================================================
// CCM API — Activity Template Validator
//
// Zod schemas for activity template create/update operations.
// Includes per-step and per-outcome schemas.
// Source: CCM_Phase5_ActivityFlowConfiguration.md § Features 3–5
// =============================================================================

import { z } from 'zod';

// Fix 5: Loop and Close outcomes must not specify a next step — enforced at
// schema level in addition to the runtime integrity check.
export const outcomeSchema = z.object({
  outcomeName: z
    .string()
    .trim()
    .min(1, 'Outcome Name is required.')
    .max(100, 'Outcome Name must be at most 100 characters.'),
  outcomeType: z.enum(['MoveForward', 'Loop', 'Close'], {
    errorMap: () => ({ message: 'Outcome Type must be MoveForward, Loop, or Close.' }),
  }),
  nextStepNo: z.number().int().positive().nullable().default(null),
  roleOverride: z.string().trim().nullable().optional().default(null),
  requiresOtpVerification: z.boolean().optional().default(false),
}).refine(
  (o) => !((o.outcomeType === 'Loop' || o.outcomeType === 'Close') && o.nextStepNo !== null),
  { message: 'Loop and Close outcomes must not specify a Next Step.' },
);

export const stepSchema = z.object({
  stepNo: z
    .number()
    .int({ message: 'Step No. must be an integer.' })
    .positive({ message: 'Step No. must be positive.' }),
  activityId: z.string().trim().min(1, 'Activity is required.'),
  assignedRole: z.string().trim().min(1, 'Assigned Role is required.'),
  slaValue: z.number().nonnegative().nullable().optional().default(null),
  slaUnit: z.enum(['Hours', 'Days']).nullable().optional().default(null),
  weightPercentage: z
    .number()
    .min(0, 'Weight % must be between 0 and 100.')
    .max(100, 'Weight % must be between 0 and 100.')
    .default(0),
  isMandatory: z.boolean().optional().default(false),
  isStartStep: z.boolean().optional().default(false),
  outcomes: z.array(outcomeSchema).default([]),
}).superRefine((step, ctx) => {
  const names = step.outcomes.map((o) => o.outcomeName.trim().toLowerCase());
  const seen = new Set<string>();
  names.forEach((name, idx) => {
    if (seen.has(name)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Duplicate outcome name is not allowed within the same step.',
        path: ['outcomes', idx, 'outcomeName'],
      });
    }
    seen.add(name);
  });
});

// Create: isActive and steps both have defaults — a draft (inactive, no steps)
// can be saved without triggering the graph integrity check.
export const createTemplateSchema = z.object({
  templateName: z
    .string()
    .trim()
    .min(1, 'Template Name is required.')
    .max(200, 'Template Name must be at most 200 characters.'),
  appliesTo: z.string().trim().min(1, 'Applies To is required.'),
  department: z.string().trim().min(1, 'Department is required.'),
  productType: z.string().trim().min(1, 'Product Type is required.'),
  isActive: z.boolean().optional().default(true),
  steps: z.array(stepSchema).default([]),
});

// Fix 7: Update schema makes isActive and steps REQUIRED (no silent defaults).
// A PUT/PATCH that omits either field is rejected with a 422 rather than
// silently wiping steps or defaulting isActive=true.
export const updateTemplateSchema = z.object({
  templateName: z
    .string()
    .trim()
    .min(1, 'Template Name is required.')
    .max(200, 'Template Name must be at most 200 characters.'),
  appliesTo: z.string().trim().min(1, 'Applies To is required.'),
  department: z.string().trim().min(1, 'Department is required.'),
  productType: z.string().trim().min(1, 'Product Type is required.'),
  isActive: z.boolean({ required_error: 'isActive is required.' }),
  steps: z.array(stepSchema),     // required — no default
});

export type OutcomeInput = z.infer<typeof outcomeSchema>;
export type StepInput = z.infer<typeof stepSchema>;
export type CreateTemplateInput = z.infer<typeof createTemplateSchema>;
export type UpdateTemplateInput = z.infer<typeof updateTemplateSchema>;
