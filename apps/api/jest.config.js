/**
 * Unit + integration test suite.
 *
 * Unit tests live next to the code in `src/**` and never touch the database.
 * Integration tests live in `test/integration` and run against a real
 * PostgreSQL database (`TEST_DATABASE_URL`), which is created and migrated by
 * the global setup below. No mocked database anywhere.
 */

/** @type {import('jest').Config} */
module.exports = {
  rootDir: '.',
  testEnvironment: 'node',
  moduleFileExtensions: ['js', 'json', 'ts'],
  testMatch: ['<rootDir>/src/**/*.spec.ts', '<rootDir>/test/integration/**/*.spec.ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  globalSetup: '<rootDir>/test/support/global-setup.ts',
  setupFiles: ['<rootDir>/test/support/setup-env.ts'],
  // Integration tests share one database, so they must not race each other.
  maxWorkers: 1,
  forceExit: true,
  clearMocks: true,
  testTimeout: 30000,
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.module.ts',
    '!src/**/*.dto.ts',
    '!src/main.ts',
  ],
};
