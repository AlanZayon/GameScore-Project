import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { databaseNameFromUrl, resolveTestDatabaseUrl, toMaintenanceUrl } from './database-url';

/** Locates the Prisma CLI entry point in a way that works on every platform. */
function resolvePrismaCli(): string {
  const packageJsonPath = require.resolve('prisma/package.json');
  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as {
    bin?: string | Record<string, string>;
  };
  const binField = packageJson.bin;
  const relativeEntry = typeof binField === 'string' ? binField : binField?.prisma;
  if (!relativeEntry) {
    throw new Error('Unable to locate the Prisma CLI entry point');
  }
  return join(dirname(packageJsonPath), relativeEntry);
}

function runPrisma(args: string[], databaseUrl: string, input?: string): void {
  execFileSync(process.execPath, [resolvePrismaCli(), ...args], {
    cwd: join(__dirname, '..', '..'),
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: input === undefined ? ['ignore', 'pipe', 'pipe'] : ['pipe', 'pipe', 'pipe'],
    input,
  });
}

function createDatabaseIfMissing(databaseUrl: string): void {
  const name = databaseNameFromUrl(databaseUrl);
  try {
    runPrisma(
      ['db', 'execute', `--url=${toMaintenanceUrl(databaseUrl)}`, '--stdin'],
      databaseUrl,
      `CREATE DATABASE "${name}";`,
    );
  } catch (error) {
    // Already existing is the expected outcome on every run after the first.
    const message = error instanceof Error ? error.message : String(error);
    if (!/already exists/i.test(message)) {
      throw new Error(`Could not create the test database "${name}": ${message}`, {
        cause: error,
      });
    }
  }
}

/**
 * Prepares a real PostgreSQL database for the suite. Runs once per Jest
 * invocation, before any worker starts.
 */
export default function globalSetup(): void {
  const databaseUrl = resolveTestDatabaseUrl();
  const migrationsDir = join(__dirname, '..', '..', 'prisma', 'migrations');

  if (!existsSync(migrationsDir)) {
    // Happens only before the first migration exists.
    process.stdout.write('[test] No Prisma migrations found, skipping database preparation.\n');
    return;
  }

  createDatabaseIfMissing(databaseUrl);

  try {
    runPrisma(['migrate', 'deploy'], databaseUrl);
  } catch (error) {
    const details = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Failed to migrate the test database. Is PostgreSQL running? Try "pnpm dev:infra".\n${details}`,
      { cause: error },
    );
  }
}
