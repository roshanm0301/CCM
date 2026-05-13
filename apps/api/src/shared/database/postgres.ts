// =============================================================================
// CCM API — PostgreSQL Pool
//
// Wraps the pg Pool for use by all repository modules.
// Exports a health check function used by the /health/ready endpoint.
// =============================================================================

import { Pool } from 'pg';
import { config, getPostgresConnectionString } from '../../config/index';
import { logger } from '../logging/logger';

// ---------------------------------------------------------------------------
// Pool singleton — shared across the process lifetime
// ---------------------------------------------------------------------------

let pool: Pool | null = null;

export function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: getPostgresConnectionString(),
      min: config.postgresPoolMin,
      max: config.postgresPoolMax,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    });

    pool.on('error', (err) => {
      logger.error('Unexpected PostgreSQL pool error', {
        module: 'postgres',
        message: err.message,
      });
    });

    pool.on('connect', () => {
      logger.debug('PostgreSQL client connected', { module: 'postgres' });
    });
  }

  return pool;
}

// ---------------------------------------------------------------------------
// Health check — used by /health/ready
// ---------------------------------------------------------------------------

export async function checkPostgresHealth(): Promise<'ok' | 'fail'> {
  try {
    const client = await getPool().connect();
    try {
      await client.query('SELECT 1');
      return 'ok';
    } finally {
      client.release();
    }
  } catch (err) {
    logger.error('PostgreSQL health check failed', {
      module: 'postgres',
      message: err instanceof Error ? err.message : String(err),
    });
    return 'fail';
  }
}

// ---------------------------------------------------------------------------
// Graceful shutdown — drain the pool
// ---------------------------------------------------------------------------

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    logger.info('PostgreSQL pool closed', { module: 'postgres' });
  }
}
