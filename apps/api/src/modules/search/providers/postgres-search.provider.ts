import { Injectable } from '@nestjs/common';
import type { AutocompleteItemDto } from '@gamescore/types';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../../common/prisma/prisma.service';
import type { SearchHits, SearchProvider, SearchQuery } from './search-provider';

/**
 * PostgreSQL full-text search plus trigram matching.
 *
 * Titles, slugs, developers and publishers are all searchable. Full-text
 * ranking is preferred when the query looks like real words; trigram similarity
 * covers prefixes and typos ("zel" → Zelda, "eldenrng" → Elden Ring).
 */
@Injectable()
export class PostgresSearchProvider implements SearchProvider {
  readonly name = 'postgres';

  constructor(private readonly prisma: PrismaService) {}

  async search(query: SearchQuery): Promise<SearchHits> {
    const started = Date.now();
    const term = query.q.trim();
    if (term.length === 0) {
      return { items: [], total: 0, tookMs: Date.now() - started };
    }

    const tsQuery = this.toTsQuery(term);
    const like = `%${this.escapeLike(term)}%`;
    const offset = (query.page - 1) * query.limit;

    const platformFilter = query.platformSlug
      ? Prisma.sql`AND EXISTS (
          SELECT 1 FROM game_platforms gp
          JOIN platforms p ON p.id = gp."platformId"
          WHERE gp."gameId" = g.id AND p.slug = ${query.platformSlug}
        )`
      : Prisma.empty;

    const genreFilter = query.genreSlug
      ? Prisma.sql`AND EXISTS (
          SELECT 1 FROM game_genres gg
          JOIN genres ge ON ge.id = gg."genreId"
          WHERE gg."gameId" = g.id AND ge.slug = ${query.genreSlug}
        )`
      : Prisma.empty;

    const rows = await this.prisma.$queryRaw<Array<{ id: string; rank: number; total: bigint }>>(
      Prisma.sql`
        WITH scored AS (
          SELECT
            g.id,
            (
              COALESCE(ts_rank_cd(g."searchVector", to_tsquery('simple', ${tsQuery})), 0) * 2
              + similarity(lower(g.name), lower(${term}))
              + similarity(lower(coalesce(g.developer, '')), lower(${term})) * 0.4
              + similarity(lower(coalesce(g.publisher, '')), lower(${term})) * 0.4
            ) AS rank
          FROM games g
          WHERE (
            g."searchVector" @@ to_tsquery('simple', ${tsQuery})
            OR lower(g.name) LIKE lower(${like})
            OR lower(g.slug) LIKE lower(${like})
            OR lower(coalesce(g.developer, '')) LIKE lower(${like})
            OR lower(coalesce(g.publisher, '')) LIKE lower(${like})
            OR similarity(lower(g.name), lower(${term})) > 0.15
          )
          ${platformFilter}
          ${genreFilter}
        )
        SELECT id, rank, COUNT(*) OVER() AS total
        FROM scored
        WHERE rank > 0
        ORDER BY rank DESC, id ASC
        OFFSET ${offset}
        LIMIT ${query.limit}
      `,
    );

    return {
      items: rows.map((row) => ({ gameId: row.id, rank: Number(row.rank) })),
      total: rows.length > 0 ? Number(rows[0]!.total) : 0,
      tookMs: Date.now() - started,
    };
  }

  async autocomplete(query: string, limit: number): Promise<AutocompleteItemDto[]> {
    const term = query.trim();
    if (term.length < 2) return [];

    const like = `${this.escapeLike(term)}%`;
    const contains = `%${this.escapeLike(term)}%`;

    const rows = await this.prisma.$queryRaw<
      Array<{
        id: string;
        slug: string;
        name: string;
        coverImageUrl: string | null;
        releaseDate: Date | null;
        positivePercentage: number | null;
        totalReviews: number | null;
      }>
    >(Prisma.sql`
      SELECT
        g.id,
        g.slug,
        g.name,
        g."coverImageUrl",
        g."releaseDate",
        s."positivePercentage",
        s."totalReviews"
      FROM games g
      LEFT JOIN game_statistics s ON s."gameId" = g.id
      WHERE
        lower(g.name) LIKE lower(${like})
        OR lower(g.name) LIKE lower(${contains})
        OR lower(g.slug) LIKE lower(${contains})
        OR similarity(lower(g.name), lower(${term})) > 0.2
      ORDER BY
        CASE WHEN lower(g.name) LIKE lower(${like}) THEN 0 ELSE 1 END,
        similarity(lower(g.name), lower(${term})) DESC,
        coalesce(s."totalReviews", 0) DESC
      LIMIT ${limit}
    `);

    return rows.map((row) => ({
      id: row.id,
      slug: row.slug,
      name: row.name,
      coverImageUrl: row.coverImageUrl,
      releaseYear: row.releaseDate ? row.releaseDate.getUTCFullYear() : null,
      positivePercentage: row.positivePercentage,
      totalReviews: row.totalReviews ?? 0,
    }));
  }

  /**
   * Turns free text into a prefix-friendly tsquery: "elden ring" →
   * "elden":* & "ring":*. Special characters are stripped so user input cannot
   * change the query syntax.
   */
  private toTsQuery(term: string): string {
    const tokens = term
      .toLowerCase()
      .replace(/[^a-z0-9\s]+/g, ' ')
      .split(/\s+/)
      .filter((token) => token.length > 0)
      .slice(0, 8);

    if (tokens.length === 0) {
      return 'empty:*';
    }

    return tokens.map((token) => `${token}:*`).join(' & ');
  }

  private escapeLike(value: string): string {
    return value.replace(/[%_\\]/g, '\\$&');
  }
}
