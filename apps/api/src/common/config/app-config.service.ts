import { Injectable } from '@nestjs/common';

import {
  type AntiSpamConfig,
  type AppConfig,
  type IgdbConfig,
  type JwtConfig,
  type RankingConfig,
  loadAppConfig,
} from './configuration';

/**
 * Typed, validated access to configuration. Injected wherever settings are
 * needed so that no other file reads `process.env`.
 */
@Injectable()
export class AppConfigService {
  private readonly config: AppConfig;

  constructor(config?: AppConfig) {
    this.config = config ?? loadAppConfig();
  }

  get all(): AppConfig {
    return this.config;
  }

  get nodeEnv(): AppConfig['nodeEnv'] {
    return this.config.nodeEnv;
  }

  get isProduction(): boolean {
    return this.config.isProduction;
  }

  get isTest(): boolean {
    return this.config.isTest;
  }

  get port(): number {
    return this.config.port;
  }

  get globalPrefix(): string {
    return this.config.globalPrefix;
  }

  get logLevel(): string {
    return this.config.logLevel;
  }

  get corsOrigins(): string[] {
    return this.config.corsOrigins;
  }

  get databaseUrl(): string {
    return this.config.databaseUrl;
  }

  get redisUrl(): string | null {
    return this.config.redisUrl;
  }

  get webUrl(): string {
    return this.config.webUrl;
  }

  get enableSwagger(): boolean {
    return this.config.enableSwagger;
  }

  get jwt(): JwtConfig {
    return this.config.jwt;
  }

  get igdb(): IgdbConfig {
    return this.config.igdb;
  }

  get ranking(): RankingConfig {
    return this.config.ranking;
  }

  get antiSpam(): AntiSpamConfig {
    return this.config.antiSpam;
  }
}
