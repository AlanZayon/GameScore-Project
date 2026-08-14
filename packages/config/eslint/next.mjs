import globals from 'globals';
import tseslint from 'typescript-eslint';

import { baseConfig } from './base.mjs';

/**
 * Lint rules for the Next.js app. The Next and React Hooks plugins are passed
 * in by the app itself, because they are app-level dependencies.
 */
export function createNextConfig({ nextPlugin, reactHooksConfig }) {
  return tseslint.config(
    ...baseConfig,
    {
      languageOptions: {
        globals: {
          ...globals.browser,
          ...globals.node,
        },
      },
    },
    nextPlugin,
    ...(reactHooksConfig ? [reactHooksConfig] : []),
    {
      files: ['**/*.tsx'],
      rules: {
        // Server Components are async functions returning JSX; the default
        // React rules do not expect that shape.
        '@typescript-eslint/no-misused-promises': 'off',
      },
    },
  );
}

export default createNextConfig;
