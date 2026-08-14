/**
 * Single place where `process.env` is read.
 *
 * Everything else in the application depends on `AppConfigService`, so there is
 * exactly one definition of every setting, one place that validates it and one
 * place to look when something is misconfigured.
 */

export type NodeEnvironment = 'development' | 'test' | 'production';

export interface JwtConfig {
  accessSecret: string;
  refreshSecret: string;
  accessTtlSeconds: number;
  refreshTtlSeconds: number;
}

export interface IgdbConfig {
  clientId: string | null;
  clientSecret: string | null;
  /** True only when both credentials are present. */
  configured: boolean;
}

export interface RankingConfig {
  /** Reviews a game needs before it may enter the "Top Rated" ranking. */
  minimumReviews: number;
  /** Reviews needed before a confident score label is shown. */
  scoreLabelMinimumReviews: number;
  /** Reviews a platform needs before its own percentage is displayed. */
  platformMinimumReviews: number;
  /** Size of the trending window, in days. */
  trendingWindowDays: number;
}

export interface AntiSpamConfig {
  maxReviewsPerHour: number;
  maxReviewsPerDay: number;
  /** Reviews shorter than this are flagged as low effort. */
  minimumTextLength: number;
  /** Distinct accounts sharing one IP before the newest is flagged. */
  maxAccountsPerIp: number;
}

export interface AppConfig {
  nodeEnv: NodeEnvironment;
  isProduction: boolean;
  isTest: boolean;
  port: number;
  globalPrefix: string;
  logLevel: string;
  corsOrigins: string[];
  databaseUrl: string;
  redisUrl: string | null;
  webUrl: string;
  jwt: JwtConfig;
  igdb: IgdbConfig;
  ranking: RankingConfig;
  antiSpam: AntiSpamConfig;
}

class ConfigurationError extends Error {
  constructor(problems: string[]) {
    super(
      `Invalid environment configuration:\n${problems.map((p) => `  - ${p}`).join('\n')}\n` +
        'Copy .env.example to .env and fill in the missing values.',
    );
    this.name = 'ConfigurationError';
  }
}

function readString(
  env: NodeJS.ProcessEnv,
  key: string,
  fallback?: string,
): { value?: string; problem?: string } {
  const raw = env[key]?.trim();
  if (raw) return { value: raw };
  if (fallback !== undefined) return { value: fallback };
  return { problem: `${key} is required` };
}

function readInt(env: NodeJS.ProcessEnv, key: string, fallback: number): number {
  const raw = env[key]?.trim();
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function readNodeEnv(env: NodeJS.ProcessEnv): NodeEnvironment {
  const raw = env.NODE_ENV?.trim();
  if (raw === 'production' || raw === 'test' || raw === 'development') {
    return raw;
  }
  return 'development';
}

export function loadAppConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const problems: string[] = [];
  const nodeEnv = readNodeEnv(env);
  const isProduction = nodeEnv === 'production';

  const databaseUrl = readString(env, 'DATABASE_URL');
  if (databaseUrl.problem) problems.push(databaseUrl.problem);

  const accessSecret = readString(env, 'JWT_SECRET');
  if (accessSecret.problem) problems.push(accessSecret.problem);

  const refreshSecret = readString(env, 'JWT_REFRESH_SECRET');
  if (refreshSecret.problem) problems.push(refreshSecret.problem);

  if (
    accessSecret.value &&
    refreshSecret.value &&
    accessSecret.value === refreshSecret.value
  ) {
    problems.push('JWT_SECRET and JWT_REFRESH_SECRET must be different values');
  }

  if (isProduction) {
    for (const [key, secret] of [
      ['JWT_SECRET', accessSecret.value],
      ['JWT_REFRESH_SECRET', refreshSecret.value],
    ] as const) {
      if (secret && secret.length < 32) {
        problems.push(`${key} must be at least 32 characters long in production`);
      }
    }
  }

  if (problems.length > 0) {
    throw new ConfigurationError(problems);
  }

  const igdbClientId = env.IGDB_CLIENT_ID?.trim() || null;
  const igdbClientSecret = env.IGDB_CLIENT_SECRET?.trim() || null;

  return {
    nodeEnv,
    isProduction,
    isTest: nodeEnv === 'test',
    port: readInt(env, 'API_PORT', 3001),
    globalPrefix: env.API_GLOBAL_PREFIX?.trim() ?? '',
    logLevel: env.LOG_LEVEL?.trim() || (nodeEnv === 'production' ? 'info' : 'debug'),
    corsOrigins: (env.CORS_ORIGINS?.trim() || 'http://localhost:3000')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
    databaseUrl: databaseUrl.value as string,
    redisUrl: env.REDIS_URL?.trim() || null,
    webUrl: env.NEXT_PUBLIC_SITE_URL?.trim() || 'http://localhost:3000',
    jwt: {
      accessSecret: accessSecret.value as string,
      refreshSecret: refreshSecret.value as string,
      accessTtlSeconds: readInt(env, 'JWT_ACCESS_TOKEN_TTL', 900),
      refreshTtlSeconds: readInt(env, 'JWT_REFRESH_TOKEN_TTL', 2592000),
    },
    igdb: {
      clientId: igdbClientId,
      clientSecret: igdbClientSecret,
      configured: Boolean(igdbClientId && igdbClientSecret),
    },
    ranking: {
      minimumReviews: readInt(env, 'RANKING_MINIMUM_REVIEWS', 50),
      scoreLabelMinimumReviews: readInt(env, 'SCORE_LABEL_MINIMUM_REVIEWS', 10),
      platformMinimumReviews: readInt(env, 'PLATFORM_MINIMUM_REVIEWS', 5),
      trendingWindowDays: readInt(env, 'TRENDING_WINDOW_DAYS', 14),
    },
    antiSpam: {
      maxReviewsPerHour: readInt(env, 'ANTISPAM_MAX_REVIEWS_PER_HOUR', 5),
      maxReviewsPerDay: readInt(env, 'ANTISPAM_MAX_REVIEWS_PER_DAY', 20),
      minimumTextLength: readInt(env, 'ANTISPAM_MIN_TEXT_LENGTH', 20),
      maxAccountsPerIp: readInt(env, 'ANTISPAM_MAX_ACCOUNTS_PER_IP', 5),
    },
  };
}
