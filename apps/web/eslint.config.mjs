import nextPlugin from '@next/eslint-plugin-next';
import reactHooks from 'eslint-plugin-react-hooks';

import { createNextConfig } from '@gamescore/config/eslint/next';

export default createNextConfig({
  nextPlugin: nextPlugin.configs['core-web-vitals'],
  // The top-level `configs` entries are still eslintrc shaped; the flat ones
  // live under `configs.flat`.
  reactHooksConfig: reactHooks.configs.flat['recommended-latest'],
});
