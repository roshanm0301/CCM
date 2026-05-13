// =============================================================================
// CCM API — MongoDB / Mongoose Connection
//
// Manages a single Mongoose connection for the process lifetime.
// Exports a health check function used by the /health/ready endpoint.
// =============================================================================

import mongoose from 'mongoose';
import { getMongoConnectionString } from '../../config/index';
import { logger } from '../logging/logger';

// ---------------------------------------------------------------------------
// Connect — called once during application startup in main.ts
// ---------------------------------------------------------------------------

export async function connectMongo(): Promise<void> {
  const uri = getMongoConnectionString();

  // Mongoose connection event handlers
  mongoose.connection.on('connected', () => {
    logger.info('MongoDB connected', { module: 'mongo' });
  });

  mongoose.connection.on('error', (err) => {
    logger.error('MongoDB connection error', {
      module: 'mongo',
      message: err instanceof Error ? err.message : String(err),
    });
  });

  mongoose.connection.on('disconnected', () => {
    logger.warn('MongoDB disconnected', { module: 'mongo' });
  });

  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 5_000,
    connectTimeoutMS: 10_000,
    socketTimeoutMS: 45_000,
  });
}

// ---------------------------------------------------------------------------
// Health check — used by /health/ready
// ---------------------------------------------------------------------------

export async function checkMongoHealth(): Promise<'ok' | 'fail'> {
  try {
    const state = mongoose.connection.readyState;
    // 1 = connected
    if (state !== 1) {
      return 'fail';
    }
    // Ping the database
    await mongoose.connection.db?.admin().command({ ping: 1 });
    return 'ok';
  } catch (err) {
    logger.error('MongoDB health check failed', {
      module: 'mongo',
      message: err instanceof Error ? err.message : String(err),
    });
    return 'fail';
  }
}

// ---------------------------------------------------------------------------
// Graceful shutdown — close the Mongoose connection
// ---------------------------------------------------------------------------

export async function closeMongo(): Promise<void> {
  await mongoose.connection.close();
  logger.info('MongoDB connection closed', { module: 'mongo' });
}
