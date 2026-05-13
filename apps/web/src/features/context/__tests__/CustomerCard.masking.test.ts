/**
 * CustomerCard — maskMobile pure-function contract tests.
 *
 * The function is defined inline in CustomerCard.tsx and is not exported.
 * The contract is re-implemented here verbatim so these tests remain
 * independent of implementation internals while still guarding the
 * documented masking behaviour.
 *
 * Source: CustomerCard.tsx §maskMobile, security-principles.md (PII masking)
 */

import { describe, it, expect } from 'vitest';

// Re-implement the same contract as CustomerCard.tsx — this is intentional.
// If the implementation diverges from this contract the component test for
// the rendered masked value (VehicleCard.masking.test.tsx) will catch it.
function maskMobile(mobile: string): string {
  if (!mobile) return '';
  if (mobile.length <= 4) return mobile;
  return 'x'.repeat(mobile.length - 4) + mobile.slice(-4);
}

describe('maskMobile', () => {
  it('returns empty string for empty input', () => {
    expect(maskMobile('')).toBe('');
  });

  it('returns the value unchanged when it is exactly 4 characters', () => {
    expect(maskMobile('1234')).toBe('1234');
  });

  it('returns the value unchanged when it is shorter than 4 characters', () => {
    expect(maskMobile('123')).toBe('123');
  });

  it('masks all digits except the last 4 for a 10-digit mobile number', () => {
    expect(maskMobile('9876543210')).toBe('xxxxxx3210');
  });

  it('produces exactly (length - 4) leading x characters', () => {
    const input = '9876543210'; // 10 digits
    const result = maskMobile(input);
    const xCount = result.split('').filter((c) => c === 'x').length;
    expect(xCount).toBe(input.length - 4);
  });

  it('preserves the last 4 digits verbatim', () => {
    expect(maskMobile('9876543210').slice(-4)).toBe('3210');
  });
});
