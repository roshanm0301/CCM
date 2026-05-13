// =============================================================================
// CCM API — Search Input Validator
//
// Per-filter normalization rules from:
// CCM_Phase1_Agent_Interaction_Documentation.md §C3 / §D3
// =============================================================================

import { z } from 'zod';
import { SearchFilter } from '@ccm/types';
import { AppError } from '../../shared/errors/AppError';

export const searchSchema = z.object({
  interactionId: z.string().uuid('interactionId must be a valid UUID'),
  filter: z.nativeEnum(SearchFilter, {
    errorMap: () => ({ message: 'Select one search filter.' }),
  }),
  value: z.string().min(1, 'Enter a search value.'),
});

export type SearchInput = z.infer<typeof searchSchema>;

/**
 * Normalize the search value based on the selected filter.
 * Throws AppError with 422 if validation fails.
 */
export function normalizeSearchValue(filter: SearchFilter, rawValue: string): string {
  const trimmed = rawValue.trim();

  if (trimmed.length < 3) {
    throw new AppError('VALIDATION_ERROR', 'Enter at least 3 characters.', 422);
  }

  switch (filter) {
    case SearchFilter.MOBILE: {
      if (!/^\d+$/.test(trimmed)) {
        throw new AppError('VALIDATION_ERROR', 'Enter a valid mobile number.', 422);
      }
      return trimmed;
    }

    case SearchFilter.REGISTRATION_NUMBER: {
      if (!/^[A-Za-z0-9]+$/.test(trimmed)) {
        throw new AppError('VALIDATION_ERROR', 'Enter a valid registration number.', 422);
      }
      return trimmed.toUpperCase();
    }

    case SearchFilter.CUSTOMER_NAME: {
      if (!/^[A-Za-z\s]+$/.test(trimmed)) {
        throw new AppError('VALIDATION_ERROR', 'Enter a valid customer name.', 422);
      }
      return trimmed;
    }

    case SearchFilter.EMAIL: {
      const emailRegex = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;
      if (!emailRegex.test(trimmed)) {
        throw new AppError('VALIDATION_ERROR', 'Enter a valid email address.', 422);
      }
      return trimmed.toLowerCase();
    }

    default:
      return trimmed;
  }
}
