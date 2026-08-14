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

export interface IgdbGame {
  id: number;
  name?: string;
  slug?: string;
  summary?: string;
  storyline?: string;
  first_release_date?: number;
  cover?: IgdbCover;
  screenshots?: IgdbCover[];
  involved_companies?: IgdbInvolvedCompany[];
  genres?: IgdbNamed[];
  platforms?: IgdbNamed[];
  updated_at?: number;
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
      `fields id,name,slug,summary,storyline,first_release_date,updated_at,cover.url,screenshots.url,involved_companies.company.name,involved_companies.developer,involved_companies.publisher,genres.name,platforms.name,platforms.abbreviation; where id = ${numeric}; limit 1;`,
    );
    return rows[0] ?? null;
  }

  async searchByName(name: string): Promise<IgdbGame[]> {
    const escaped = name.replace(/"/g, '');
    return this.query<IgdbGame>(
      'games',
      `search "${escaped}"; fields id,name,slug,summary,storyline,first_release_date,updated_at,cover.url,screenshots.url,involved_companies.company.name,involved_companies.developer,involved_companies.publisher,genres.name,platforms.name,platforms.abbreviation; limit 5;`,
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

    const response = await fetch(`${TOKEN_URL}?${params.toString()}`, { method: 'POST' });
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
