/**
 * Resolves the database URL used by the automated test suites.
 *
 * Tests must never touch the development database, so `TEST_DATABASE_URL` is
 * preferred and, when it is missing, a `_test` suffixed database is derived
 * from `DATABASE_URL`.
 */
export function resolveTestDatabaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  const explicit = env.TEST_DATABASE_URL?.trim();
  if (explicit) {
    return explicit;
  }

  const development = env.DATABASE_URL?.trim();
  if (!development) {
    throw new Error(
      'Neither TEST_DATABASE_URL nor DATABASE_URL is set. Copy .env.example to .env first.',
    );
  }

  const url = new URL(development);
  const databaseName = url.pathname.replace(/^\//, '') || 'gamescore';
  if (databaseName.endsWith('_test')) {
    return development;
  }
  url.pathname = `/${databaseName}_test`;
  return url.toString();
}

/** Same server, but pointed at the maintenance database, to run CREATE DATABASE. */
export function toMaintenanceUrl(databaseUrl: string): string {
  const url = new URL(databaseUrl);
  url.pathname = '/postgres';
  url.search = '';
  return url.toString();
}

export function databaseNameFromUrl(databaseUrl: string): string {
  const url = new URL(databaseUrl);
  const name = url.pathname.replace(/^\//, '');
  if (!name) {
    throw new Error(`Database URL is missing a database name: ${databaseUrl}`);
  }
  return name;
}
