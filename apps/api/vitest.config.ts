// =============================================================================
// CCM API — Vitest Configuration
//
// Configures two test projects:
//   unit        — fast, no DB required, mocks all external dependencies
//   integration — requires TEST_DATABASE_URL, runs against the real test DB
//
// Coverage targets:
//   - Services:    >= 80% lines/branches
//   - Repositories: >= 70% lines (integration tests cover most paths)
// =============================================================================

import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      // Match tsconfig.json paths so imports resolve correctly in tests
      '@ccm/types': path.resolve(__dirname, '../../packages/types/src/index.ts'),
      '@': path.resolve(__dirname, './src'),
    },
  },

  test: {
    // Use projects for isolation between unit and integration suites
    projects: [
      // ------------------------------------------------------------------
      // Unit tests — fast, no DB, no env vars required
      // ------------------------------------------------------------------
      {
        // root must be set so include/exclude globs resolve from the config
        // file's directory regardless of where vitest is invoked from
        root: __dirname,
        test: {
          name: 'unit',
          include: [
            'src/modules/**/__tests__/*.test.ts',
          ],
          exclude: [
            'src/__tests__/**',
          ],
          environment: 'node',
          globals: false,
          setupFiles: [],
          reporters: ['verbose'],
        },
      },

      // ------------------------------------------------------------------
      // Integration tests — require a running PostgreSQL test database
      // ------------------------------------------------------------------
      {
        root: __dirname,
        test: {
          name: 'integration',
          include: [
            'src/__tests__/**/*.integration.test.ts',
          ],
          environment: 'node',
          globals: false,
          // Load .env.test before running integration tests
          setupFiles: ['./src/__tests__/setup/loadEnv.ts'],
          // Run integration tests serially to avoid state conflicts between
          // tests that share the same test DB user (agent1)
          pool: 'forks',
          poolOptions: {
            forks: {
              singleFork: true,
            },
          },
          reporters: ['verbose'],
          // Longer timeout for DB operations
          testTimeout: 30_000,
          hookTimeout: 15_000,
        },
      },
    ],

    // ------------------------------------------------------------------
    // Coverage configuration (applies when --coverage flag is passed)
    // ------------------------------------------------------------------
    coverage: {
      provider: 'v8',
      include: [
        'src/modules/**/*.service.ts',
        'src/modules/**/*.repository.ts',
        'src/modules/**/*.validator.ts',
        'src/shared/middleware/*.ts',
        'src/shared/errors/*.ts',
      ],
      exclude: [
        'src/**/__tests__/**',
        'src/**/*.test.ts',
        'src/main.ts',
        'src/app.ts',
        'src/config/**',
        'src/shared/logging/**',
        'src/shared/database/**',
      ],
      thresholds: {
        // Minimum coverage gates per testing-strategy.md
        lines: 80,
        functions: 80,
        branches: 75,
        statements: 80,
      },
      reporter: ['text', 'lcov', 'html'],
      reportsDirectory: './coverage',
    },
  },
});
