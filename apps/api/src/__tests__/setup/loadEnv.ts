// =============================================================================
// CCM API — Integration Test Environment Setup
//
// Loads .env.test before integration tests run.
// This file is referenced in vitest.config.ts setupFiles for integration project.
// =============================================================================

import { readFileSync, existsSync } from 'fs';
import path from 'path';

const envTestPath = path.resolve(__dirname, '../../../.env.test');

if (existsSync(envTestPath)) {
  const envContent = readFileSync(envTestPath, 'utf-8');

  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();

    // Skip comments and empty lines
    if (!trimmed || trimmed.startsWith('#')) continue;

    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) continue;

    const key = trimmed.substring(0, eqIndex).trim();
    const value = trimmed.substring(eqIndex + 1).trim();

    // Only set if not already set (allow overrides from actual env)
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
} else {
  // .env.test not found — log a clear message but don't crash yet.
  // Tests will fail with a useful error when they try to connect.
  console.warn(
    '[test setup] .env.test file not found at ' + envTestPath + '. ' +
    'Copy apps/api/.env.test.example to apps/api/.env.test and fill in your local values.',
  );
}
