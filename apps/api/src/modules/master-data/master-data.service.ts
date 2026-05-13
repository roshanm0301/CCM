// =============================================================================
// CCM API — Master Data Service
//
// Source: phase1-technical-blueprint.md §5.16
// =============================================================================

import { AppError } from '../../shared/errors/AppError';
import {
  findReferenceValuesByType,
  REFERENCE_TYPE_MAP,
} from './master-data.repository';

export interface ReferenceValueDto {
  code: string;
  label: string;
  sortOrder: number;
  /**
   * Flattened convenience flag derived from metadata.remarksRequired.
   * Present and true only when the disposition requires a remarks entry.
   * Consumers may also inspect the full `metadata` object for other flags.
   */
  remarksRequired?: boolean;
  /**
   * Raw JSONB metadata from the reference_values table.
   * Forwarded verbatim so callers can read any flag without a backend change.
   * null when the DB row has no metadata.
   */
  metadata: Record<string, unknown> | null;
}

export interface MasterDataResult {
  type: string;
  items: ReferenceValueDto[];
}

export async function getMasterDataService(typeParam: string): Promise<MasterDataResult> {
  const referenceType = REFERENCE_TYPE_MAP[typeParam];
  if (!referenceType) {
    throw new AppError(
      'VALIDATION_ERROR',
      `Unknown master data type: ${typeParam}. Valid types are: ${Object.keys(REFERENCE_TYPE_MAP).join(', ')}`,
      400,
    );
  }

  const rows = await findReferenceValuesByType(referenceType);

  const items: ReferenceValueDto[] = rows.map((row) => {
    const dto: ReferenceValueDto = {
      code: row.code,
      label: row.label,
      sortOrder: row.sort_order,
      // Forward the full metadata JSONB so callers can read arbitrary flags
      // without requiring a backend change. null when absent.
      metadata: row.metadata ?? null,
    };

    // Flatten remarksRequired for interaction-dispositions as a convenience
    // flag. The WrapupForm reads dto.remarksRequired directly.
    if (typeParam === 'interaction-dispositions' && row.metadata) {
      const remarksRequired = (row.metadata as Record<string, unknown>)['remarksRequired'];
      if (remarksRequired === true) {
        dto.remarksRequired = true;
      }
    }

    return dto;
  });

  return { type: typeParam, items };
}
