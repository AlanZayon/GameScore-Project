import { Injectable } from '@nestjs/common';
import type { HomeFeedDto, RankingResponseDto } from '@gamescore/types';

import { CacheService } from '../../../common/cache/cache.service';
import { AppConfigService } from '../../../common/config/app-config.service';
import { utcDate } from '../../../common/crypto/hash';
import { toGameSummaryDto } from '../../games/mappers/game.mapper';
import { gameCardInclude } from '../../games/repositories/game.repository';
import { PrismaService } from '../../../common/prisma/prisma.service';

const HOME_CACHE_KEY = 'home:feed';
const RANKINGS_TTL_SECONDS = 60;
const HOME_TTL_SECONDS = 45;

@Injectable()
export class RankingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    private readonly config: AppConfigService,
  ) {}

  async topRated(limit = 25): Promise<RankingResponseDto> {
    return this.cachedRanking('top-rated', limit, async () => {
      const games = await this.prisma.game.findMany({
        where: {
          statistics: { totalReviews: { gte: this.config.ranking.minimumReviews } },
        },
        include: gameCardInclude,
        orderBy: [
          { statistics: { confidenceScore: 'desc' } },
          { statistics: { totalReviews: 'desc' } },
        ],
        take: limit,
      });
      return {
        ranking: 'top-rated',
        criteriaKey: 'rankings.criteria.topRated',
        minimumReviews: this.config.ranking.minimumReviews,
        entries: games.map((game, index) => ({
          position: index + 1,
          game: toGameSummaryDto(game, this.config.ranking.scoreLabelMinimumReviews),
          rankingValue: game.statistics?.confidenceScore ?? 0,
        })),
        generatedAt: new Date().toISOString(),
      };
    });
  }

  async popular(limit = 25): Promise<RankingResponseDto> {
    return this.cachedRanking('popular', limit, async () => {
      const games = await this.prisma.game.findMany({
        include: gameCardInclude,
        orderBy: [{ statistics: { totalReviews: 'desc' } }, { viewCount: 'desc' }],
        take: limit,
      });
      return {
        ranking: 'popular',
        criteriaKey: 'rankings.criteria.popular',
        minimumReviews: null,
        entries: games.map((game, index) => ({
          position: index + 1,
          game: toGameSummaryDto(game, this.config.ranking.scoreLabelMinimumReviews),
          rankingValue: game.statistics?.totalReviews ?? 0,
        })),
        generatedAt: new Date().toISOString(),
      };
    });
  }

  async newReleases(limit = 25): Promise<RankingResponseDto> {
    return this.cachedRanking('new-releases', limit, async () => {
      const games = await this.prisma.game.findMany({
        where: { releaseDate: { not: null, lte: utcDate() } },
        include: gameCardInclude,
        orderBy: [{ releaseDate: 'desc' }, { createdAt: 'desc' }],
        take: limit,
      });
      return {
        ranking: 'new-releases',
        criteriaKey: 'rankings.criteria.newReleases',
        minimumReviews: null,
        entries: games.map((game, index) => ({
          position: index + 1,
          game: toGameSummaryDto(game, this.config.ranking.scoreLabelMinimumReviews),
          rankingValue: game.releaseDate ? game.releaseDate.getTime() : 0,
        })),
        generatedAt: new Date().toISOString(),
      };
    });
  }

  async trending(limit = 25): Promise<RankingResponseDto> {
    return this.cachedRanking('trending', limit, async () => {
      const since = utcDate();
      since.setUTCDate(since.getUTCDate() - this.config.ranking.trendingWindowDays);

      const activity = await this.prisma.gameActivityDaily.groupBy({
        by: ['gameId'],
        where: { date: { gte: since } },
        _sum: { reviewCount: true, viewCount: true },
      });

      const scored = activity
        .map((row) => ({
          gameId: row.gameId,
          value: (row._sum.reviewCount ?? 0) * 4 + (row._sum.viewCount ?? 0),
        }))
        .filter((row) => row.value > 0)
        .sort((a, b) => b.value - a.value)
        .slice(0, limit);

      const games = await this.prisma.game.findMany({
        where: { id: { in: scored.map((row) => row.gameId) } },
        include: gameCardInclude,
      });
      const byId = new Map(games.map((game) => [game.id, game]));

      const entries = scored
        .map((row, index) => {
          const game = byId.get(row.gameId);
          if (!game) return null;
          return {
            position: index + 1,
            game: toGameSummaryDto(game, this.config.ranking.scoreLabelMinimumReviews),
            rankingValue: row.value,
          };
        })
        .filter((entry): entry is NonNullable<typeof entry> => entry !== null);

      return {
        ranking: 'trending',
        criteriaKey: 'rankings.criteria.trending',
        minimumReviews: null,
        entries,
        generatedAt: new Date().toISOString(),
      };
    });
  }

  async home(): Promise<HomeFeedDto> {
    return this.cache.wrap(HOME_CACHE_KEY, HOME_TTL_SECONDS, async () => {
      const [popular, topRated, newReleases, trending, recentReviews, totals] = await Promise.all([
        this.popular(8),
        this.topRated(8),
        this.newReleases(8),
        this.trending(8),
        this.prisma.review.findMany({
          where: { deletedAt: null, status: 'PUBLISHED' },
          include: {
            user: { select: { username: true, avatarUrl: true } },
            game: { select: { slug: true, name: true, coverImageUrl: true, developer: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: 6,
        }),
        Promise.all([
          this.prisma.game.count(),
          this.prisma.review.count({ where: { deletedAt: null } }),
          this.prisma.user.count({ where: { deletedAt: null } }),
        ]),
      ]);

      return {
        popular: popular.entries.map((entry) => entry.game),
        topRated: topRated.entries.map((entry) => entry.game),
        newReleases: newReleases.entries.map((entry) => entry.game),
        trending: trending.entries.map((entry) => entry.game),
        recentReviews: recentReviews.map((review) => ({
          id: review.id,
          gameSlug: review.game.slug,
          gameName: review.game.name,
          gameCoverImageUrl: review.game.coverImageUrl,
          gameDeveloper: review.game.developer,
          authorUsername: review.user.username,
          authorAvatarUrl: review.user.avatarUrl,
          recommended: review.recommended,
          excerpt: review.text.slice(0, 180),
          createdAt: review.createdAt.toISOString(),
        })),
        totals: {
          games: totals[0],
          reviews: totals[1],
          users: totals[2],
        },
      };
    });
  }

  private cachedRanking(
    name: string,
    limit: number,
    factory: () => Promise<RankingResponseDto>,
  ): Promise<RankingResponseDto> {
    return this.cache.wrap(`rankings:${name}:${limit}`, RANKINGS_TTL_SECONDS, factory);
  }
}
