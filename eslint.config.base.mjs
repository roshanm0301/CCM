// Shared ESLint flat-config base for all CCM workspaces.
// Individual apps/packages extend this and add their own parser/plugin settings.
import js from '@eslint/js';

export default [
  js.configs.recommended,
  {
    rules: {
      // --- General code quality ---
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'no-debugger': 'error',
      'no-unused-vars': 'off', // Replaced by @typescript-eslint/no-unused-vars in TS workspaces
      'no-var': 'error',
      'prefer-const': 'error',
      'eqeqeq': ['error', 'always'],
      'curly': ['error', 'all'],
      'no-implicit-coercion': 'error',
      'no-shadow': 'off', // Replaced by @typescript-eslint/no-shadow in TS workspaces

      // --- Import hygiene ---
      'no-duplicate-imports': 'error',

      // --- Async safety ---
      'no-return-await': 'error',
      'require-await': 'warn',
    },
    linterOptions: {
      reportUnusedDisableDirectives: 'warn',
    },
  },
  {
    // Files to globally ignore
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/coverage/**',
      '**/.vite/**',
      '**/public/sw.js',
      '**/public/workbox-*.js',
    ],
  },
];
