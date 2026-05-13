'use strict';

// Shared ESLint configuration for all CCM workspaces.
// Designed for use with ESLint flat config (eslint.config.mjs).
// Consumers import this and spread or compose it.

/** @type {import('eslint').Linter.Config[]} */
const baseConfig = [
  {
    rules: {
      // --- General ---
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'no-debugger': 'error',
      'no-var': 'error',
      'prefer-const': 'error',
      'eqeqeq': ['error', 'always'],
      'curly': ['error', 'all'],
      'no-implicit-coercion': 'error',
      'no-duplicate-imports': 'error',
      'no-return-await': 'error',
      'require-await': 'warn',
    },
  },
];

/** @type {import('eslint').Linter.Config[]} */
const typescriptConfig = [
  ...baseConfig,
  {
    rules: {
      // TypeScript-specific rules — requires @typescript-eslint/eslint-plugin
      // Consumers must supply the typescript-eslint plugin and parser.
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': [
        'warn',
        { ignoreRestArgs: false },
      ],
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-shadow': 'error',
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', disallowTypeAnnotations: false },
      ],
      '@typescript-eslint/no-non-null-assertion': 'warn',
      '@typescript-eslint/prefer-nullish-coalescing': 'warn',
      '@typescript-eslint/prefer-optional-chain': 'warn',
    },
  },
];

module.exports = {
  baseConfig,
  typescriptConfig,
};
