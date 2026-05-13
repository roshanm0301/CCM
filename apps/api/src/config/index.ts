// =============================================================================
// CCM API — Configuration
//
// All application configuration is derived from environment variables.
// This module performs fail-fast validation at startup so misconfigured
// deployments surface immediately rather than failing at first use.
// =============================================================================

import { z } from 'zod';

// ---------------------------------------------------------------------------
// Schema definition
// ---------------------------------------------------------------------------

const configSchema = z.object({
  // Server
  // No default — NODE_ENV must be explicitly set so that security-sensitive
  // checks (e.g. HMAC bypass in dev mode) cannot be accidentally activated
  // in production by an unset environment variable.
  nodeEnv: z.enum(['development', 'production', 'test']),
  port: z.coerce.number().int().min(1).max(65535).default(3000),
  logLevel: z.enum(['error', 'warn', 'info', 'http', 'debug']).default('info'),

  // PostgreSQL
  postgresHost: z.string().min(1),
  postgresPort: z.coerce.number().int().min(1).max(65535).default(5432),
  postgresDb: z.string().min(1),
  postgresUser: z.string().min(1),
  postgresPassword: z.string().min(1),
  postgresPoolMin: z.coerce.number().int().min(1).default(2),
  postgresPoolMax: z.coerce.number().int().min(1).default(10),

  // MongoDB
  mongoHost: z.string().min(1),
  mongoPort: z.coerce.number().int().min(1).max(65535).default(27017),
  mongoDb: z.string().min(1),
  mongoUser: z.string().min(1),
  mongoPassword: z.string().min(1),
  mongoReplicaSet: z.string().optional(),

  // JWT
  jwtSecret: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  jwtExpiry: z.string().default('8h'),
  jwtRefreshExpiry: z.string().default('24h'),

  // CORS
  corsAllowedOrigins: z.string().default('http://localhost:8080'),

  // Cookies
  // Controls the Secure flag on session and CSRF cookies, and the __Host-
  // prefix on the CSRF cookie name.  Set to 'true' only when the app is
  // served over TLS (HTTPS).  Defaults to 'false' so HTTP deployments
  // (Docker Compose without TLS, LAN access via IP) work out-of-the-box.
  cookieSecure: z.enum(['true', 'false']).default('false'),

  // TeleCMI CTI
  // telecmiAppId: coerced to a positive integer at startup so that appIdAsNumber()
  //   in cti.client.ts never silently produces NaN. Startup fails fast if
  //   TELECMI_APP_ID is missing, empty, or non-numeric.
  // telecmiSbcUri has a safe default (non-secret).
  // telecmiAppSecret and telecmiWebhookCustomValue are treated as credentials:
  //   - empty string default means CTI features degrade gracefully (no calls routed)
  //     rather than failing startup in environments without CTI configured.
  //   - In production, TELECMI_APP_ID, TELECMI_APP_SECRET MUST be set via .env.
  //   - TELECMI_WEBHOOK_CUSTOM_VALUE: optional shared secret echoed in all webhook
  //     payloads as "custom". Configured in TeleCMI portal under
  //     Business Number → Settings → Webhooks → Custom value.
  //   - TELECMI_CALLER_ID: DID/virtual number used as callerid for outbound click2call
  //     (digits only, with country code, e.g. "917943444751").
  telecmiAppId: z.coerce.number().int().positive().default(1111112),
  telecmiAppSecret: z.string().default(''),
  telecmiSbcUri: z.string().default('sbcind.telecmi.com'),
  telecmiWebhookCustomValue: z.string().default(''),
  telecmiBaseUrl: z.string().default('https://rest.telecmi.com'),
  telecmiCallerId: z.string().default(''),
});

export type AppConfig = z.infer<typeof configSchema>;

// ---------------------------------------------------------------------------
// Parse and validate — throws ZodError on startup if any required var is missing
// ---------------------------------------------------------------------------

function loadConfig(): AppConfig {
  const rawConfig = {
    nodeEnv: process.env['NODE_ENV'],
    port: process.env['PORT'],
    logLevel: process.env['LOG_LEVEL'],
    postgresHost: process.env['POSTGRES_HOST'],
    postgresPort: process.env['POSTGRES_PORT'],
    postgresDb: process.env['POSTGRES_DB'],
    postgresUser: process.env['POSTGRES_USER'],
    postgresPassword: process.env['POSTGRES_PASSWORD'],
    postgresPoolMin: process.env['POSTGRES_POOL_MIN'],
    postgresPoolMax: process.env['POSTGRES_POOL_MAX'],
    mongoHost: process.env['MONGO_HOST'],
    mongoPort: process.env['MONGO_PORT'],
    mongoDb: process.env['MONGO_DB'],
    mongoUser: process.env['MONGO_USER'],
    mongoPassword: process.env['MONGO_PASSWORD'],
    mongoReplicaSet: process.env['MONGO_REPLICA_SET'],
    jwtSecret: process.env['JWT_SECRET'],
    jwtExpiry: process.env['JWT_EXPIRY'],
    jwtRefreshExpiry: process.env['JWT_REFRESH_EXPIRY'],
    corsAllowedOrigins: process.env['CORS_ALLOWED_ORIGINS'],
    cookieSecure: process.env['COOKIE_SECURE'],
    telecmiAppId: process.env['TELECMI_APP_ID'],
    telecmiAppSecret: process.env['TELECMI_APP_SECRET'],
    telecmiSbcUri: process.env['TELECMI_SBC_URI'],
    telecmiWebhookCustomValue: process.env['TELECMI_WEBHOOK_CUSTOM_VALUE'],
    telecmiBaseUrl: process.env['TELECMI_BASE_URL'],
    telecmiCallerId: process.env['TELECMI_CALLER_ID'],
  };

  const result = configSchema.safeParse(rawConfig);

  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Configuration validation failed:\n${issues}`);
  }

  return result.data;
}

// ---------------------------------------------------------------------------
// Singleton — loaded once at module import time
// ---------------------------------------------------------------------------

export const config: AppConfig = loadConfig();

/** Returns the singleton config instance. Convenience accessor for modules that prefer a function call. */
export function getConfig(): AppConfig {
  return config;
}

// ---------------------------------------------------------------------------
// Derived connection strings (never logged)
// ---------------------------------------------------------------------------

export function getPostgresConnectionString(): string {
  const { postgresUser, postgresPassword, postgresHost, postgresPort, postgresDb } = config;
  return `postgresql://${postgresUser}:${postgresPassword}@${postgresHost}:${postgresPort}/${postgresDb}`;
}

export function getMongoConnectionString(): string {
  const { mongoUser, mongoPassword, mongoHost, mongoPort, mongoDb, mongoReplicaSet } = config;
  const replicaSetParam = mongoReplicaSet ? `&replicaSet=${mongoReplicaSet}` : '';
  return `mongodb://${mongoUser}:${mongoPassword}@${mongoHost}:${mongoPort}/${mongoDb}?authSource=admin${replicaSetParam}`;
}
