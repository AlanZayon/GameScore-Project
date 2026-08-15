import { Injectable, Logger } from '@nestjs/common';

import { AppConfigService } from '../../../common/config/app-config.service';
import { BadRequestError } from '../../../common/errors/app.exception';
import { ERROR_CODES } from '../../../common/errors/error-codes';
import { RateLimiter } from './igdb-rate-limiter';

const TOKEN_URL = 'https://id.twitch.tv/oauth2/token';
const API_URL = 'https://api.igdb.com/v4';

export interface IgdbCompany {
  name?: string;
}

export interface IgdbInvolvedCompany {
  developer?: boolean;
  publisher?: boolean;
  company?: IgdbCompany;
}

export interface IgdbNamed {
  name?: string;
  abbreviation?: string;
}

export interface IgdbCover {
  url?: string;
}

export interface IgdbVideo {
  name?: string;
  video_id?: string;
}

export interface IgdbGame {
  id: number;
  name?: string;
  slug?: string;
  summary?: string;
  storyline?: string;
  first_release_date?: number;
  cover?: IgdbCover;
  screenshots?: IgdbCover[];
  videos?: IgdbVideo[];
  involved_companies?: IgdbInvolvedCompany[];
  genres?: IgdbNamed[];
  platforms?: IgdbNamed[];
  /** IGDB game ids of DLCs. */
  dlcs?: number[];
  /** IGDB game ids of expansions. */
  expansions?: number[];
  updated_at?: number;
}

/** Lightweight row used when resolving DLC / expansion metadata in batch. */
export interface IgdbRelatedGame {
  id: number;
  name?: string;
  cover?: IgdbCover;
  first_release_date?: number;
}

const GAME_DETAIL_FIELDS =
  'id,name,slug,summary,storyline,first_release_date,updated_at,cover.url,screenshots.url,videos.name,videos.video_id,involved_companies.company.name,involved_companies.developer,involved_companies.publisher,genres.name,platforms.name,platforms.abbreviation,dlcs,expansions';

const RELATED_GAME_FIELDS = 'id,name,cover.url,first_release_date';

/** Prefer an IGDB video whose name looks like a trailer; otherwise the first with an id. */
export function pickIgdbTrailerYoutubeId(videos: IgdbVideo[] | undefined): string | null {
  const withId = (videos ?? []).filter((video) => Boolean(video.video_id?.trim()));
  if (withId.length === 0) return null;
  const trailer = withId.find((video) => /trailer/i.test(video.name ?? ''));
  return (trailer ?? withId[0])!.video_id!.trim().slice(0, 32);
}

interface CachedToken {
  accessToken: string;
  expiresAt: number;
}

@Injectable()
export class IgdbClient {
  private readonly logger = new Logger(IgdbClient.name);
  private readonly limiter = new RateLimiter(4, 4);
  private token: CachedToken | null = null;

  constructor(private readonly config: AppConfigService) {}

  get configured(): boolean {
    return this.config.igdb.configured;
  }

  async getGameById(id: string): Promise<IgdbGame | null> {
    const numeric = Number.parseInt(id, 10);
    if (!Number.isFinite(numeric)) {
      throw new BadRequestError(ERROR_CODES.IGDB_INVALID_PAYLOAD, 'IGDB id must be numeric');
    }

    const rows = await this.query<IgdbGame>(
      'games',
      `fields ${GAME_DETAIL_FIELDS}; where id = ${numeric}; limit 1;`,
    );
    return rows[0] ?? null;
  }

  async searchByName(name: string, limit = 5): Promise<IgdbGame[]> {
    const escaped = name.replace(/"/g, '');
    const capped = Math.min(25, Math.max(1, Math.trunc(limit)));
    return this.query<IgdbGame>(
      'games',
      `search "${escaped}"; fields ${GAME_DETAIL_FIELDS}; limit ${capped};`,
    );
  }

  /** Batch-fetch name/cover/release for related IGDB ids (max 40 per call). */
  async getGamesByIds(ids: number[]): Promise<IgdbRelatedGame[]> {
    const unique = [...new Set(ids.filter((id) => Number.isFinite(id) && id > 0))].slice(0, 40);
    if (unique.length === 0) return [];
    return this.query<IgdbRelatedGame>(
      'games',
      `fields ${RELATED_GAME_FIELDS}; where id = (${unique.join(',')}); limit ${unique.length};`,
    );
  }

  private async query<T>(endpoint: string, body: string): Promise<T[]> {
    if (!this.configured) {
      throw new BadRequestError(
        ERROR_CODES.IGDB_NOT_CONFIGURED,
        'IGDB credentials are not configured',
      );
    }

    await this.limiter.acquire();
    const token = await this.getAccessToken();

    const response = await fetch(`${API_URL}/${endpoint}`, {
      method: 'POST',
      headers: {
        'Client-ID': this.config.igdb.clientId as string,
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        'Content-Type': 'text/plain',
      },
      body,
    });

    if (!response.ok) {
      const text = await response.text();
      this.logger.warn(`IGDB ${endpoint} failed (${response.status}): ${text.slice(0, 200)}`);
      throw new BadRequestError(ERROR_CODES.IGDB_REQUEST_FAILED, 'IGDB request failed');
    }

    return (await response.json()) as T[];
  }

  private async getAccessToken(): Promise<string> {
    if (this.token && this.token.expiresAt > Date.now() + 60_000) {
      return this.token.accessToken;
    }

    const params = new URLSearchParams({
      client_id: this.config.igdb.clientId as string,
      client_secret: this.config.igdb.clientSecret as string,
      grant_type: 'client_credentials',
    });

    const response = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });
    if (!response.ok) {
      throw new BadRequestError(ERROR_CODES.IGDB_REQUEST_FAILED, 'Could not obtain an IGDB access token');
    }

    const payload = (await response.json()) as { access_token: string; expires_in: number };
    this.token = {
      accessToken: payload.access_token,
      expiresAt: Date.now() + payload.expires_in * 1000,
    };
    return this.token.accessToken;
  }
}
