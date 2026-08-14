import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';

import { AppConfigService } from '../config/app-config.service';

/**
 * Anything that can run a query: the client itself or an interactive
 * transaction. Repositories accept this type so the same method works inside
 * and outside a transaction.
 */
export type PrismaTransaction = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor(config: AppConfigService) {
    super({
      datasources: { db: { url: config.databaseUrl } },
      log: [
        { emit: 'event', level: 'warn' },
        { emit: 'event', level: 'error' },
      ],
    });

    // Prisma's own diagnostics go through the application logger, so they end
    // up in the same structured stream as everything else.
    const client = this as unknown as {
      $on(event: 'warn' | 'error', listener: (payload: { message: string }) => void): void;
    };
    client.$on('warn', (event) => this.logger.warn(event.message));
    client.$on('error', (event) => this.logger.error(event.message));
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  /** Cheap round trip used by the health endpoint. */
  async isHealthy(): Promise<boolean> {
    try {
      await this.$queryRaw`SELECT 1`;
      return true;
    } catch (error) {
      this.logger.error(
        'Database health check failed',
        error instanceof Error ? error.message : String(error),
      );
      return false;
    }
  }

  /**
   * Removes every row while keeping the schema. Only ever called by the test
   * suites, which run against a dedicated database.
   */
  async truncateAllTables(): Promise<void> {
    if (process.env.NODE_ENV !== 'test') {
      throw new Error('truncateAllTables() is only available when NODE_ENV=test');
    }

    const tables = await this.$queryRaw<{ tablename: string }[]>`
      SELECT tablename FROM pg_tables
      WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'
    `;

    if (tables.length === 0) return;

    const quoted = tables.map((table) => `"public"."${table.tablename}"`).join(', ');
    await this.$executeRawUnsafe(`TRUNCATE TABLE ${quoted} RESTART IDENTITY CASCADE`);
  }
}

export { Prisma };
