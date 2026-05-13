// =============================================================================
// CCM API — Case Category Validator Unit Tests
//
// Tests all Zod schemas for correct accept/reject behaviour without hitting
// any service or repository code.
// Source: CCM_Phase3_CaseCategory_Master.md
// =============================================================================

import { describe, it, expect } from 'vitest';
import {
  createCategorySchema,
  updateCategorySchema,
  createSubcategorySchema,
} from '../case-category.validator';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Valid base payload for createCategorySchema — use spread to override fields. */
function validCategoryInput() {
  return {
    code: 'COMPLAINT',
    displayName: 'Complaint Handling',
    definition: 'Cases related to customer complaints',
    departments: ['SALES'],
    caseNatures: ['COMPLAINT'],
    productTypes: ['Motorcycle'],
  };
}

/** Valid base payload for createSubcategorySchema. */
function validSubcategoryInput() {
  return {
    code: 'BILLING',
    displayName: 'Billing Complaint',
    definition: 'Complaint about billing',
  };
}

// ---------------------------------------------------------------------------
// createCategorySchema
// ---------------------------------------------------------------------------

describe('createCategorySchema', () => {
  it('valid input passes', () => {
    const result = createCategorySchema.safeParse(validCategoryInput());
    expect(result.success).toBe(true);
  });

  it('code with lowercase letters fails (CODE_REGEX requires uppercase)', () => {
    const result = createCategorySchema.safeParse({
      ...validCategoryInput(),
      code: 'complaint',
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toMatch(/uppercase/i);
  });

  it('code with special chars other than _ or - fails', () => {
    const result = createCategorySchema.safeParse({
      ...validCategoryInput(),
      code: 'COMP@LAINT',
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toMatch(/uppercase/i);
  });

  it('code with underscore and hyphen passes', () => {
    const result = createCategorySchema.safeParse({
      ...validCategoryInput(),
      code: 'COMP_LAINT-1',
    });
    expect(result.success).toBe(true);
  });

  it('displayName with controlled special chars & / - ( ) , . passes', () => {
    const result = createCategorySchema.safeParse({
      ...validCategoryInput(),
      displayName: 'Complaint & Feedback / Handling - (Type A), B.',
    });
    expect(result.success).toBe(true);
  });

  it('displayName with disallowed char @ fails', () => {
    const result = createCategorySchema.safeParse({
      ...validCategoryInput(),
      displayName: 'Complaint@Handling',
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toMatch(/invalid characters/i);
  });

  it('definition > 500 chars fails', () => {
    const longDefinition = 'A'.repeat(501);
    const result = createCategorySchema.safeParse({
      ...validCategoryInput(),
      definition: longDefinition,
    });
    expect(result.success).toBe(false);
  });

  it('definition exactly 500 chars passes', () => {
    const maxDefinition = 'A'.repeat(500);
    const result = createCategorySchema.safeParse({
      ...validCategoryInput(),
      definition: maxDefinition,
    });
    expect(result.success).toBe(true);
  });

  it('departments array empty → fails with min(1) message', () => {
    const result = createCategorySchema.safeParse({
      ...validCategoryInput(),
      departments: [],
    });
    expect(result.success).toBe(false);
    const messages = result.error?.issues.map((i) => i.message) ?? [];
    expect(messages.some((m) => m.toLowerCase().includes('department'))).toBe(true);
  });

  it('caseNatures array empty → fails with min(1) message', () => {
    const result = createCategorySchema.safeParse({
      ...validCategoryInput(),
      caseNatures: [],
    });
    expect(result.success).toBe(false);
    const messages = result.error?.issues.map((i) => i.message) ?? [];
    expect(messages.some((m) => m.toLowerCase().includes('case nature'))).toBe(true);
  });

  it('productTypes array empty → fails with min(1) message', () => {
    const result = createCategorySchema.safeParse({
      ...validCategoryInput(),
      productTypes: [],
    });
    expect(result.success).toBe(false);
    const messages = result.error?.issues.map((i) => i.message) ?? [];
    expect(messages.some((m) => m.toLowerCase().includes('product type'))).toBe(true);
  });

  it('isActive defaults to true when not provided', () => {
    const result = createCategorySchema.safeParse(validCategoryInput());
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.isActive).toBe(true);
    }
  });

  it('isActive: false is accepted when provided', () => {
    const result = createCategorySchema.safeParse({
      ...validCategoryInput(),
      isActive: false,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.isActive).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// createSubcategorySchema
// ---------------------------------------------------------------------------

describe('createSubcategorySchema', () => {
  it('valid input passes', () => {
    const result = createSubcategorySchema.safeParse(validSubcategoryInput());
    expect(result.success).toBe(true);
  });

  it('code with lowercase fails', () => {
    const result = createSubcategorySchema.safeParse({
      ...validSubcategoryInput(),
      code: 'billing',
    });
    expect(result.success).toBe(false);
  });

  it('displayName with disallowed char fails', () => {
    const result = createSubcategorySchema.safeParse({
      ...validSubcategoryInput(),
      displayName: 'Billing#Issue',
    });
    expect(result.success).toBe(false);
  });

  it('definition > 500 chars fails', () => {
    const result = createSubcategorySchema.safeParse({
      ...validSubcategoryInput(),
      definition: 'X'.repeat(501),
    });
    expect(result.success).toBe(false);
  });

  it('isActive defaults to true when not provided', () => {
    const result = createSubcategorySchema.safeParse(validSubcategoryInput());
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.isActive).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// updateCategorySchema
// ---------------------------------------------------------------------------

describe('updateCategorySchema', () => {
  it('all fields optional (partial schema) — empty object passes', () => {
    const result = updateCategorySchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('isActive: boolean accepted', () => {
    const result = updateCategorySchema.safeParse({ isActive: false });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.isActive).toBe(false);
    }
  });

  it('isActive: true accepted', () => {
    const result = updateCategorySchema.safeParse({ isActive: true });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.isActive).toBe(true);
    }
  });

  it('partial update with just displayName passes', () => {
    const result = updateCategorySchema.safeParse({ displayName: 'New Name' });
    expect(result.success).toBe(true);
  });

  it('code with invalid characters still fails even in partial update', () => {
    const result = updateCategorySchema.safeParse({ code: 'bad@code' });
    expect(result.success).toBe(false);
  });
});
