// =============================================================================
// CCM API — Search Repository
//
// Writes to the search_attempts audit table.
// Source: migration 007
// =============================================================================

import { getPool } from '../../shared/database/postgres';

export interface InteractionStatusRow {
  id: string;
  status: string;
  started_by_user_id: string;
}

/** Minimal interaction lookup for search pre-validation. */
export async function findInteractionStatusById(
  id: string,
): Promise<InteractionStatusRow | null> {
  const sql = `
    SELECT id, status, started_by_user_id
    FROM interactions
    WHERE id = $1
    LIMIT 1
  `;
  const result = await getPool().query<InteractionStatusRow>(sql, [id]);
  return result.rows[0] ?? null;
}

export interface SearchAttemptRow {
  id: string;
  interaction_id: string;
  search_filter_code: string;
  raw_value: string;
  normalized_value: string;
  attempted_at: Date;
  attempted_by_user_id: string;
  result_count: number;
  primary_source_used: string | null;
  fallback_source_used: boolean;
  outcome_status: string;
}

export async function insertSearchAttempt(params: {
  interactionId: string;
  searchFilterCode: string;
  rawValue: string;
  normalizedValue: string;
  attemptedByUserId: string;
  resultCount: number;
  primarySourceUsed: string | null;
  fallbackSourceUsed: boolean;
  outcomeStatus: string;
}): Promise<SearchAttemptRow> {
  const sql = `
    INSERT INTO search_attempts
      (interaction_id, search_filter_code, raw_value, normalized_value,
       attempted_by_user_id, result_count, primary_source_used,
       fallback_source_used, outcome_status)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING id, interaction_id, search_filter_code, raw_value, normalized_value,
              attempted_at, attempted_by_user_id, result_count, primary_source_used,
              fallback_source_used, outcome_status
  `;
  const result = await getPool().query<SearchAttemptRow>(sql, [
    params.interactionId,
    params.searchFilterCode,
    params.rawValue,
    params.normalizedValue,
    params.attemptedByUserId,
    params.resultCount,
    params.primarySourceUsed,
    params.fallbackSourceUsed,
    params.outcomeStatus,
  ]);
  return result.rows[0]!;
}
