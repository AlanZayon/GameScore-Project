import { resolveTestDatabaseUrl } from './database-url';

/**
 * Runs inside every Jest worker before the test framework is installed.
 * Jest workers are separate processes, so the environment has to be prepared
 * here rather than only in the global setup.
 */
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = resolveTestDatabaseUrl();
process.env.LOG_LEVEL = process.env.TEST_LOG_LEVEL ?? 'silent';

// Deterministic, throwaway secrets: tests must never depend on real ones.
process.env.JWT_SECRET = 'test-access-secret-000000000000000000000000000000';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-11111111111111111111111111111';
process.env.JWT_ACCESS_TOKEN_TTL = '900';
process.env.JWT_REFRESH_TOKEN_TTL = '2592000';

// Rate limiting and caching must stay in-process during tests.
delete process.env.REDIS_URL;

// The IGDB integration is exercised through a stubbed HTTP client.
delete process.env.IGDB_CLIENT_ID;
delete process.env.IGDB_CLIENT_SECRET;
