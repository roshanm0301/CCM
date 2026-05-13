// =============================================================================
// CCM API — Activity Master Validator Unit Tests
//
// Tests Zod schemas for activity master create/update operations.
// Source: CCM_Phase5_ActivityFlowConfiguration.md § Feature 1
// =============================================================================

import { describe, it, expect } from 'vitest';
import {
  createActivitySchema,
  updateActivitySchema,
} from '../activity-master.validator';

// ---------------------------------------------------------------------------
// createActivitySchema
// ---------------------------------------------------------------------------

describe('createActivitySchema', () => {
  it('valid input passes', () => {
    const result = createActivitySchema.safeParse({
      code: 'CALL_LOG',
      displayName: 'Call Logging',
    });
    expect(result.success).toBe(true);
  });

  it('missing code → fails with required message', () => {
    const result = createActivitySchema.safeParse({
      displayName: 'Call Logging',
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues.some((i) => i.path.includes('code'))).toBe(true);
  });

  it('missing displayName → fails with required message', () => {
    const result = createActivitySchema.safeParse({
      code: 'CALL_LOG',
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues.some((i) => i.path.includes('displayName'))).toBe(true);
  });

  it('empty code string → fails min(1)', () => {
    const result = createActivitySchema.safeParse({
      code: '',
      displayName: 'Call Logging',
    });
    expect(result.success).toBe(false);
    const messages = result.error?.issues.map((i) => i.message) ?? [];
    expect(messages.some((m) => m.toLowerCase().includes('required') || m.toLowerCase().includes('least'))).toBe(true);
  });

  it('code too long (>30 chars) → fails max(30)', () => {
    const result = createActivitySchema.safeParse({
      code: 'A'.repeat(31),
      displayName: 'Call Logging',
    });
    expect(result.success).toBe(false);
    const messages = result.error?.issues.map((i) => i.message) ?? [];
    expect(messages.some((m) => m.includes('30'))).toBe(true);
  });

  it('displayName too long (>150 chars) → fails max(150)', () => {
    const result = createActivitySchema.safeParse({
      code: 'CALL_LOG',
      displayName: 'A'.repeat(151),
    });
    expect(result.success).toBe(false);
    const messages = result.error?.issues.map((i) => i.message) ?? [];
    expect(messages.some((m) => m.includes('150'))).toBe(true);
  });

  it('isActive defaults to true when not provided', () => {
    const result = createActivitySchema.safeParse({
      code: 'CALL_LOG',
      displayName: 'Call Logging',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.isActive).toBe(true);
    }
  });

  it('isActive: false is accepted when provided', () => {
    const result = createActivitySchema.safeParse({
      code: 'CALL_LOG',
      displayName: 'Call Logging',
      isActive: false,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.isActive).toBe(false);
    }
  });

  it('description defaults to empty string when not provided', () => {
    const result = createActivitySchema.safeParse({
      code: 'CALL_LOG',
      displayName: 'Call Logging',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.description).toBe('');
    }
  });

  it('description too long (>500 chars) → fails', () => {
    const result = createActivitySchema.safeParse({
      code: 'CALL_LOG',
      displayName: 'Call Logging',
      description: 'X'.repeat(501),
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// updateActivitySchema
// ---------------------------------------------------------------------------

describe('updateActivitySchema', () => {
  it('empty object is valid — all fields optional', () => {
    const result = updateActivitySchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('partial update with only code passes', () => {
    const result = updateActivitySchema.safeParse({ code: 'NEW_CODE' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.code).toBe('NEW_CODE');
    }
  });

  it('partial update with only displayName passes', () => {
    const result = updateActivitySchema.safeParse({ displayName: 'Updated Name' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.displayName).toBe('Updated Name');
    }
  });

  it('partial update with only isActive passes', () => {
    const result = updateActivitySchema.safeParse({ isActive: false });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.isActive).toBe(false);
    }
  });

  it('code too long in partial update → fails', () => {
    const result = updateActivitySchema.safeParse({ code: 'A'.repeat(31) });
    expect(result.success).toBe(false);
  });

  it('empty displayName in partial update → fails', () => {
    const result = updateActivitySchema.safeParse({ displayName: '' });
    expect(result.success).toBe(false);
  });
});
