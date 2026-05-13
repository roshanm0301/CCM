// =============================================================================
// CCM API — Interaction Validator Unit Tests
//
// Covers saveWrapupSchema superRefine: remarks are required for specific
// dispositions at the Zod schema layer, before the service is called.
// Source: CCM_Phase1_Agent_Interaction_Documentation.md §C6
// =============================================================================

import { describe, it, expect } from 'vitest';
import { saveWrapupSchema } from '../interaction.validator';

// GAP 5 (F8): Mobile format validation lives in search.validator — import it here
// to avoid creating a new file for a small extension.
// Source: apps/api/src/modules/search/search.validator.ts normalizeSearchValue
import { normalizeSearchValue } from '../../search/search.validator';
import { SearchFilter } from '@ccm/types';

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

function validBase(dispositionCode = 'information_provided', remarks?: string | null) {
  return {
    contactReasonCode: 'query',
    identificationOutcomeCode: 'customer_vehicle_identified',
    interactionDispositionCode: dispositionCode,
    remarks: remarks,
  };
}

// ---------------------------------------------------------------------------
// saveWrapupSchema — superRefine: remarks required for mandatory dispositions
// ---------------------------------------------------------------------------

describe('saveWrapupSchema', () => {
  describe('dispositions that do NOT require remarks', () => {
    it('should accept information_provided with no remarks', () => {
      const result = saveWrapupSchema.safeParse(validBase('information_provided', undefined));
      expect(result.success).toBe(true);
    });

    it('should accept information_provided with null remarks', () => {
      const result = saveWrapupSchema.safeParse(validBase('information_provided', null));
      expect(result.success).toBe(true);
    });

    it('should accept information_provided with actual remarks', () => {
      const result = saveWrapupSchema.safeParse(validBase('information_provided', 'Some note'));
      expect(result.success).toBe(true);
    });
  });

  describe('dispositions that require remarks — empty remarks rejected', () => {
    const remarksRequiredDispositions: string[] = [
      'no_match_found',
      'technical_issue',
      'abusive_caller',
      'others',
      'incomplete_interaction',
    ];

    it.each(remarksRequiredDispositions)(
      'should reject %s with undefined remarks',
      (dispositionCode) => {
        const result = saveWrapupSchema.safeParse(validBase(dispositionCode, undefined));
        expect(result.success).toBe(false);
        if (!result.success) {
          const issue = result.error.issues.find((i) => i.path.includes('remarks'));
          expect(issue).toBeDefined();
          expect(issue!.message).toBe('Remarks are required for this disposition');
        }
      },
    );

    it.each(remarksRequiredDispositions)(
      'should reject %s with null remarks',
      (dispositionCode) => {
        const result = saveWrapupSchema.safeParse(validBase(dispositionCode, null));
        expect(result.success).toBe(false);
        if (!result.success) {
          const issue = result.error.issues.find((i) => i.path.includes('remarks'));
          expect(issue).toBeDefined();
        }
      },
    );

    it.each(remarksRequiredDispositions)(
      'should reject %s with empty string remarks',
      (dispositionCode) => {
        const result = saveWrapupSchema.safeParse(validBase(dispositionCode, ''));
        expect(result.success).toBe(false);
        if (!result.success) {
          const issue = result.error.issues.find((i) => i.path.includes('remarks'));
          expect(issue).toBeDefined();
        }
      },
    );

    it.each(remarksRequiredDispositions)(
      'should reject %s with whitespace-only remarks',
      (dispositionCode) => {
        const result = saveWrapupSchema.safeParse(validBase(dispositionCode, '   '));
        expect(result.success).toBe(false);
        if (!result.success) {
          const issue = result.error.issues.find((i) => i.path.includes('remarks'));
          expect(issue).toBeDefined();
        }
      },
    );

    it.each(remarksRequiredDispositions)(
      'should accept %s when remarks are present and non-empty',
      (dispositionCode) => {
        const result = saveWrapupSchema.safeParse(validBase(dispositionCode, 'Caller was abusive'));
        expect(result.success).toBe(true);
      },
    );
  });

  describe('field-level validations', () => {
    it('should reject missing contactReasonCode', () => {
      const result = saveWrapupSchema.safeParse({
        contactReasonCode: '',
        identificationOutcomeCode: 'customer_vehicle_identified',
        interactionDispositionCode: 'information_provided',
      });
      expect(result.success).toBe(false);
    });

    it('should reject missing identificationOutcomeCode', () => {
      const result = saveWrapupSchema.safeParse({
        contactReasonCode: 'query',
        identificationOutcomeCode: '',
        interactionDispositionCode: 'information_provided',
      });
      expect(result.success).toBe(false);
    });

    it('should reject remarks exceeding 1000 characters', () => {
      const result = saveWrapupSchema.safeParse({
        contactReasonCode: 'query',
        identificationOutcomeCode: 'customer_vehicle_identified',
        interactionDispositionCode: 'information_provided',
        remarks: 'x'.repeat(1001),
      });
      expect(result.success).toBe(false);
    });

    it('should accept remarks exactly 1000 characters', () => {
      const result = saveWrapupSchema.safeParse({
        contactReasonCode: 'query',
        identificationOutcomeCode: 'customer_vehicle_identified',
        interactionDispositionCode: 'information_provided',
        remarks: 'x'.repeat(1000),
      });
      expect(result.success).toBe(true);
    });
  });
});

// =============================================================================
// GAP 5 (F8): Mobile filter format validation — normalizeSearchValue
//
// The search endpoint must reject non-numeric values for the Mobile filter
// and accept valid numeric strings.
// Source: CCM_Phase1_Agent_Interaction_Documentation.md §C3
// =============================================================================

describe('normalizeSearchValue — Mobile filter format validation (F8)', () => {
  describe('non-numeric values are rejected with 422', () => {
    it('should throw 422 when mobile contains alpha characters', () => {
      expect(() => normalizeSearchValue(SearchFilter.MOBILE, '987654321a')).toThrow(
        expect.objectContaining({ statusCode: 422 }),
      );
    });

    it('should throw 422 when mobile contains a plus sign prefix', () => {
      expect(() => normalizeSearchValue(SearchFilter.MOBILE, '+919876543210')).toThrow(
        expect.objectContaining({ statusCode: 422 }),
      );
    });

    it('should throw 422 when mobile contains hyphen separators', () => {
      expect(() => normalizeSearchValue(SearchFilter.MOBILE, '98765-43210')).toThrow(
        expect.objectContaining({ statusCode: 422 }),
      );
    });

    it('should throw 422 when mobile contains parentheses', () => {
      expect(() => normalizeSearchValue(SearchFilter.MOBILE, '(987)6543210')).toThrow(
        expect.objectContaining({ statusCode: 422 }),
      );
    });

    it('should throw 422 when mobile contains spaces between digits', () => {
      expect(() => normalizeSearchValue(SearchFilter.MOBILE, '98765 43210')).toThrow(
        expect.objectContaining({ statusCode: 422 }),
      );
    });

    it('should throw 422 when mobile contains only 2 digits (below minimum length)', () => {
      expect(() => normalizeSearchValue(SearchFilter.MOBILE, '98')).toThrow(
        expect.objectContaining({ statusCode: 422, message: 'Enter at least 3 characters.' }),
      );
    });

    it('should throw with message "Enter a valid mobile number." for alpha input', () => {
      try {
        normalizeSearchValue(SearchFilter.MOBILE, 'abcdefghij');
        expect.fail('Expected an error to be thrown');
      } catch (err: unknown) {
        expect((err as { message: string }).message).toBe('Enter a valid mobile number.');
      }
    });
  });

  describe('valid numeric strings pass validation', () => {
    it('should accept a 10-digit all-numeric mobile number', () => {
      const result = normalizeSearchValue(SearchFilter.MOBILE, '9876543210');
      expect(result).toBe('9876543210');
    });

    it('should accept a partial numeric mobile (3 digits — minimum length)', () => {
      const result = normalizeSearchValue(SearchFilter.MOBILE, '987');
      expect(result).toBe('987');
    });

    it('should strip leading and trailing whitespace from a valid numeric mobile', () => {
      const result = normalizeSearchValue(SearchFilter.MOBILE, '  9876543210  ');
      expect(result).toBe('9876543210');
    });

    it('should accept a mobile number longer than 10 digits', () => {
      const result = normalizeSearchValue(SearchFilter.MOBILE, '91987654321000');
      expect(result).toBe('91987654321000');
    });
  });
});
