import globals from 'globals';
import tseslint from 'typescript-eslint';

import { baseConfig } from './base.mjs';

/** Lint rules for Node.js services (NestJS API, scripts, seeds). */
export const nodeConfig = tseslint.config(
  ...baseConfig,
  {
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
    rules: {
      // NestJS relies on decorator metadata, so empty constructor-only classes
      // and parameter properties are idiomatic rather than a smell.
      '@typescript-eslint/no-extraneous-class': 'off',
      '@typescript-eslint/no-empty-function': ['error', { allow: ['constructors', 'methods'] }],
      // `import type` erases the binding. NestJS `emitDecoratorMetadata` needs
      // the runtime class for constructor injection, so value imports stay.
      '@typescript-eslint/consistent-type-imports': 'off',
    },
  },
  {
    files: ['**/*.spec.ts', '**/*.e2e-spec.ts', '**/test/**/*.ts', '**/prisma/seed.ts'],
    languageOptions: {
      globals: {
        ...globals.jest,
      },
    },
    rules: {
      'no-console': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },
);

export default nodeConfig;
