// =============================================================================
// CCM API — Agent Status Validator Unit Tests (Phase 1.5)
//
// Verifies that on_call and wrap_up are rejected (system-managed) and that
// the four agent-selectable statuses all pass validation.
// Source: agent-status.validator.ts, Phase 1.5 — CTI guard
// =============================================================================

import { describe, it, expect } from 'vitest';
import { updateAgentStatusSchema } from '../agent-status.validator';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('updateAgentStatusSchema — system-managed statuses are rejected', () => {
  it('should fail validation for status "on_call" (system-managed)', () => {
    const result = updateAgentStatusSchema.safeParse({ status: 'on_call' });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain('on_call');
    }
  });

  it('should fail validation for status "wrap_up" (system-managed)', () => {
    const result = updateAgentStatusSchema.safeParse({ status: 'wrap_up' });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain('wrap_up');
    }
  });

  it('should produce an error message mentioning system-managed restriction', () => {
    const result = updateAgentStatusSchema.safeParse({ status: 'on_call' });

    expect(result.success).toBe(false);
    if (!result.success) {
      const message = result.error.issues[0]?.message ?? '';
      expect(message.toLowerCase()).toContain('system-managed');
    }
  });
});

describe('updateAgentStatusSchema — agent-selectable statuses pass validation', () => {
  it('should pass validation for status "ready_for_calls"', () => {
    const result = updateAgentStatusSchema.safeParse({ status: 'ready_for_calls' });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe('ready_for_calls');
    }
  });

  it('should pass validation for status "break"', () => {
    const result = updateAgentStatusSchema.safeParse({ status: 'break' });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe('break');
    }
  });

  it('should pass validation for status "offline"', () => {
    const result = updateAgentStatusSchema.safeParse({ status: 'offline' });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe('offline');
    }
  });

  it('should pass validation for status "training"', () => {
    const result = updateAgentStatusSchema.safeParse({ status: 'training' });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe('training');
    }
  });
});

describe('updateAgentStatusSchema — invalid values are rejected', () => {
  it('should fail validation for an arbitrary invalid value', () => {
    const result = updateAgentStatusSchema.safeParse({ status: 'invalid_value' });

    expect(result.success).toBe(false);
  });

  it('should fail validation for an empty string', () => {
    const result = updateAgentStatusSchema.safeParse({ status: '' });

    expect(result.success).toBe(false);
  });

  it('should fail validation when status field is missing', () => {
    const result = updateAgentStatusSchema.safeParse({});

    expect(result.success).toBe(false);
  });

  it('should fail validation for numeric status value', () => {
    const result = updateAgentStatusSchema.safeParse({ status: 1 });

    expect(result.success).toBe(false);
  });
});
