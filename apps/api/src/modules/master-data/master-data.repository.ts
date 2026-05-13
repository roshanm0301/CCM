// =============================================================================
// CCM API — Master Data Repository
//
// Queries the reference_values table.
// Source: migration 010, 011
// =============================================================================

import { getPool } from '../../shared/database/postgres';

export interface ReferenceValueRow {
  code: string;
  label: string;
  sort_order: number;
  is_active: boolean;
  metadata: Record<string, unknown> | null;
}

// Map from URL-friendly type param to DB reference_type value
export const REFERENCE_TYPE_MAP: Record<string, string> = {
  'search-filters': 'search_filter',
  'contact-reasons': 'contact_reason',
  'identification-outcomes': 'identification_outcome',
  'interaction-dispositions': 'interaction_disposition',
  'agent-statuses': 'agent_status',
};

export async function findReferenceValuesByType(referenceType: string): Promise<ReferenceValueRow[]> {
  const sql = `
    SELECT code, label, sort_order, is_active, metadata
    FROM reference_values
    WHERE reference_type = $1
      AND is_active = TRUE
    ORDER BY sort_order ASC
  `;
  const result = await getPool().query<ReferenceValueRow>(sql, [referenceType]);
  return result.rows;
}
