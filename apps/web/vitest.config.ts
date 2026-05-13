import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    pool: 'forks',
    testTimeout: 20000,
    setupFiles: ['./src/test/setup.ts'],
    deps: {
      optimizer: {
        web: {
          // react-router v7 ships as pure ESM; include it in the optimizer so
          // the jsdom/forks environment can consume it without a CJS/ESM conflict.
          include: [/react-router/],
        },
      },
    },
    coverage: {
      provider: 'v8',
      thresholds: {
        lines: 80,
        branches: 80,
        functions: 80,
        statements: 80,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@ccm/types': path.resolve(__dirname, '../../packages/types/src/index.ts'),
    },
  },
});
