/**
 * End-to-end suite: boots the real Nest application against a real PostgreSQL
 * database and drives it over HTTP, exactly as a browser client would.
 */

/** @type {import('jest').Config} */
module.exports = {
  rootDir: '..',
  testEnvironment: 'node',
  moduleFileExtensions: ['js', 'json', 'ts'],
  testMatch: ['<rootDir>/test/e2e/**/*.e2e-spec.ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  globalSetup: '<rootDir>/test/support/global-setup.ts',
  setupFiles: ['<rootDir>/test/support/setup-env.ts'],
  maxWorkers: 1,
  forceExit: true,
  testTimeout: 60000,
};
