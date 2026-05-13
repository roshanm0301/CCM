// =============================================================================
// CCM API — Case Category Validator
//
// Zod schemas for case category and subcategory create/update operations.
// Source: CCM_Phase3_CaseCategory_Master.md
// =============================================================================

import { z } from 'zod';

// Controlled special characters allowed: & / - ( ) , .
const ALLOWED_TEXT_REGEX = /^[A-Za-z0-9\s&/\-(),.]+$/;
const CODE_REGEX = /^[A-Z0-9_-]+$/;

export const createCategorySchema = z.object({
  code: z
    .string()
    .trim()
    .min(1)
    .max(30)
    .regex(CODE_REGEX, 'Code must be uppercase alphanumeric with _ or -'),
  displayName: z
    .string()
    .trim()
    .min(1)
    .max(100)
    .regex(ALLOWED_TEXT_REGEX, 'Invalid characters in Display Name'),
  definition: z
    .string()
    .trim()
    .min(1)
    .max(500)
    .regex(ALLOWED_TEXT_REGEX, 'Invalid characters in Definition'),
  departments: z.array(z.string()).min(1, 'Please select at least one value for Department'),
  caseNatures: z.array(z.string()).min(1, 'Please select at least one value for Case Nature'),
  productTypes: z.array(z.string()).min(1, 'Please select at least one value for Product Type'),
  isActive: z.boolean().optional().default(true),
});

export const updateCategorySchema = createCategorySchema.partial().extend({
  isActive: z.boolean().optional(),
});

export const createSubcategorySchema = z.object({
  code: z
    .string()
    .trim()
    .min(1)
    .max(30)
    .regex(CODE_REGEX, 'Code must be uppercase alphanumeric with _ or -'),
  displayName: z
    .string()
    .trim()
    .min(1)
    .max(100)
    .regex(ALLOWED_TEXT_REGEX, 'Invalid characters in Display Name'),
  definition: z
    .string()
    .trim()
    .min(1)
    .max(500)
    .regex(ALLOWED_TEXT_REGEX, 'Invalid characters in Definition'),
  isActive: z.boolean().optional().default(true),
});

export const updateSubcategorySchema = createSubcategorySchema.partial().extend({
  isActive: z.boolean().optional(),
});

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
export type CreateSubcategoryInput = z.infer<typeof createSubcategorySchema>;
export type UpdateSubcategoryInput = z.infer<typeof updateSubcategorySchema>;
