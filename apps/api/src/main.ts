// =============================================================================
// CCM API — Application Entry Point
//
// Responsibilities:
// 1. Validate configuration (fail fast on startup if env vars are missing)
// 2. Connect to databases
// 3. Start the HTTP server
// 4. Register graceful shutdown handlers
// =============================================================================

// Config must be the very first import so validation fires before any
// other module tries to use environment variables.
import { config } from './config/index';
import { logger } from './shared/logging/logger';
import { connectMongo, closeMongo } from './shared/database/mongo';
import { getPool, closePool } from './shared/database/postgres';
import app from './app';

const SERVICE = 'ccm-api';

async function start(): Promise<void> {
  logger.info('Starting CCM API', {
    module: 'main',
    nodeEnv: config.nodeEnv,
    port: config.port,
  });

  // -------------------------------------------------------------------------
  // Connect to PostgreSQL (validate pool by running a test query)
  // -------------------------------------------------------------------------
  try {
    const client = await getPool().connect();
    await client.query('SELECT 1');
    client.release();
    logger.info('PostgreSQL connection pool ready', { module: 'main' });
  } catch (err) {
    logger.error('Failed to connect to PostgreSQL — aborting startup', {
      module: 'main',
      message: err instanceof Error ? err.message : String(err),
    });
    process.exit(1);
  }

  // -------------------------------------------------------------------------
  // Connect to MongoDB
  // -------------------------------------------------------------------------
  try {
    await connectMongo();
    logger.info('MongoDB connection established', { module: 'main' });
  } catch (err) {
    logger.error('Failed to connect to MongoDB — aborting startup', {
      module: 'main',
      message: err instanceof Error ? err.message : String(err),
    });
    process.exit(1);
  }

  // -------------------------------------------------------------------------
  // Start HTTP server
  // -------------------------------------------------------------------------
  const server = app.listen(config.port, () => {
    logger.info(`${SERVICE} listening`, {
      module: 'main',
      port: config.port,
      nodeEnv: config.nodeEnv,
    });
  });

  // -------------------------------------------------------------------------
  // Graceful shutdown
  // -------------------------------------------------------------------------
  async function shutdown(signal: string): Promise<void> {
    logger.info(`Received ${signal} — starting graceful shutdown`, { module: 'main' });

    // Stop accepting new connections
    server.close(async () => {
      logger.info('HTTP server closed', { module: 'main' });

      try {
        await closePool();
        await closeMongo();
        logger.info('Graceful shutdown complete', { module: 'main' });
        process.exit(0);
      } catch (err) {
        logger.error('Error during shutdown', {
          module: 'main',
          message: err instanceof Error ? err.message : String(err),
        });
        process.exit(1);
      }
    });

    // Force-exit if shutdown takes too long (15 seconds)
    setTimeout(() => {
      logger.error('Graceful shutdown timed out — forcing exit', { module: 'main' });
      process.exit(1);
    }, 15_000).unref();
  }

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));

  // Surface unhandled promise rejections — do not swallow silently
  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled promise rejection', {
      module: 'main',
      reason: reason instanceof Error ? reason.message : String(reason),
    });
  });
}

start().catch((err: unknown) => {
  // If start() itself throws synchronously (e.g. config validation) log and exit
  console.error('Fatal startup error:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
