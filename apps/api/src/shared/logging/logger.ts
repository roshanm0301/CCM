// =============================================================================
// CCM API — Structured logger
//
// Uses Winston with JSON output for production.
// Log fields align with logging-and-monitoring.md requirements:
//   timestamp, level, service, environment, message, correlation_id, module, etc.
// =============================================================================

import winston from 'winston';

const { combine, timestamp, json, colorize, printf } = winston.format;

// ---------------------------------------------------------------------------
// Human-readable format for development console
// ---------------------------------------------------------------------------
const devFormat = printf(({ level, message, timestamp: ts, ...meta }) => {
  const extras = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
  return `${String(ts)} [${level}] ${String(message)}${extras}`;
});

// ---------------------------------------------------------------------------
// Determine log level from environment — default to info
// ---------------------------------------------------------------------------
const logLevel = process.env['LOG_LEVEL'] ?? 'info';
const nodeEnv = process.env['NODE_ENV'] ?? 'development';
const isProduction = nodeEnv === 'production';
// In test environments, Winston's handleExceptions/handleRejections install
// global process.on() listeners that prevent vitest worker exit. Tests that
// import this module directly should mock it via vi.mock (see test-strategy.md).
const isTest = nodeEnv === 'test';

// ---------------------------------------------------------------------------
// Logger instance
// ---------------------------------------------------------------------------
export const logger = winston.createLogger({
  level: logLevel,
  defaultMeta: {
    service: 'ccm-api',
    environment: nodeEnv,
  },
  format: isProduction
    ? combine(timestamp(), json())
    : combine(
        colorize(),
        timestamp({ format: 'HH:mm:ss' }),
        devFormat,
      ),
  transports: [
    new winston.transports.Console({
      handleExceptions: !isTest,
      handleRejections: !isTest,
    }),
  ],
  exitOnError: false,
});

// ---------------------------------------------------------------------------
// Helper: create a child logger with contextual metadata
// ---------------------------------------------------------------------------

export interface LogContext {
  module?: string;
  correlationId?: string;
  requestId?: string;
  userId?: string;
  interactionId?: string;
  [key: string]: unknown;
}

export function createContextLogger(context: LogContext): winston.Logger {
  return logger.child(context);
}
