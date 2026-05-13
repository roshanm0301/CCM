// =============================================================================
// CCM API — Context Repository
//
// Writes context snapshots to PostgreSQL for interaction traceability.
// Source: migration 009
// =============================================================================

import { getPool } from '../../shared/database/postgres';

export async function insertContextSnapshot(params: {
  interactionId: string;
  snapshotType: 'customer' | 'vehicle' | 'dealer' | 'combined';
  sourceSystem: string;
  sourceReference: string;
  snapshotJson: Record<string, unknown>;
}): Promise<void> {
  const sql = `
    INSERT INTO context_snapshots
      (interaction_id, snapshot_type, source_system, source_reference, snapshot_json)
    VALUES ($1, $2, $3, $4, $5)
  `;
  await getPool().query(sql, [
    params.interactionId,
    params.snapshotType,
    params.sourceSystem,
    params.sourceReference,
    JSON.stringify(params.snapshotJson),
  ]);
}
