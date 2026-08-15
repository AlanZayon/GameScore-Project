import { hash } from '@node-rs/argon2';
import { calculateGameScore, calculateReviewScoreValue, slugify } from '@gamescore/shared';
import { PrismaClient, type PlatformFamily } from '@prisma/client';

const prisma = new PrismaClient();
const PASSWORD = 'Password123!';

const ARGON = {
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;

/** Steam library covers are public CDN URLs — no API key, no broken placeholders. */
function steamCoverUrl(appId: number): string {
  return `https://cdn.cloudflare.steamstatic.com/steam/apps/${appId}/library_600x900.jpg`;
}

function steamBannerUrl(appId: number): string {
  return `https://cdn.cloudflare.steamstatic.com/steam/apps/${appId}/header.jpg`;
}

interface SeedGame {
  name: string;
  summary: string;
  developer: string;
  publisher: string;
  releaseDate: string;
  platforms: string[];
  genres: string[];
  /** Target positive share 0..1 and approximate review count. */
  positiveRate: number;
  reviewCount: number;
  bomb?: boolean;
  /** Steam app id used for library cover art on the CDN. */
  steamAppId?: number;
}

const PLATFORMS: Array<{ slug: string; name: string; abbreviation: string; family: PlatformFamily; sortOrder: number }> = [
  { slug: 'pc', name: 'PC', abbreviation: 'PC', family: 'PC', sortOrder: 1 },
  { slug: 'ps5', name: 'PlayStation 5', abbreviation: 'PS5', family: 'PLAYSTATION', sortOrder: 2 },
  { slug: 'ps4', name: 'PlayStation 4', abbreviation: 'PS4', family: 'PLAYSTATION', sortOrder: 3 },
  { slug: 'xbox-series', name: 'Xbox Series X|S', abbreviation: 'XSX', family: 'XBOX', sortOrder: 4 },
  { slug: 'xbox-one', name: 'Xbox One', abbreviation: 'XB1', family: 'XBOX', sortOrder: 5 },
  { slug: 'switch', name: 'Nintendo Switch', abbreviation: 'NSW', family: 'NINTENDO', sortOrder: 6 },
  { slug: 'ios', name: 'iOS', abbreviation: 'iOS', family: 'MOBILE', sortOrder: 7 },
  { slug: 'android', name: 'Android', abbreviation: 'AND', family: 'MOBILE', sortOrder: 8 },
];

const GENRES = [
  'Action',
  'Adventure',
  'RPG',
  'Shooter',
  'Strategy',
  'Simulation',
  'Indie',
  'Platformer',
  'Horror',
  'Sports',
];

const GAMES: SeedGame[] = [
  { name: 'Elden Ring', summary: 'An open-world action RPG from FromSoftware.', developer: 'FromSoftware', publisher: 'Bandai Namco', releaseDate: '2022-02-25', platforms: ['pc', 'ps5', 'xbox-series'], genres: ['action', 'rpg'], positiveRate: 0.94, reviewCount: 86, steamAppId: 1245620 },
  { name: 'The Witcher 3: Wild Hunt', summary: 'A sprawling fantasy RPG about a monster hunter and his choices.', developer: 'CD Projekt Red', publisher: 'CD Projekt', releaseDate: '2015-05-19', platforms: ['pc', 'ps5', 'xbox-series', 'switch'], genres: ['rpg', 'adventure'], positiveRate: 0.96, reviewCount: 72, steamAppId: 292030 },
  { name: 'Hades', summary: 'A rogue-like dungeon crawler where you fight to escape the Underworld.', developer: 'Supergiant Games', publisher: 'Supergiant Games', releaseDate: '2020-09-17', platforms: ['pc', 'switch', 'ps5', 'xbox-series'], genres: ['action', 'indie'], positiveRate: 0.98, reviewCount: 54, steamAppId: 1145360 },
  { name: 'Stardew Valley', summary: 'A farming sim about rebuilding a life in the countryside.', developer: 'ConcernedApe', publisher: 'ConcernedApe', releaseDate: '2016-02-26', platforms: ['pc', 'switch', 'ps4', 'xbox-one', 'ios', 'android'], genres: ['simulation', 'indie'], positiveRate: 0.97, reviewCount: 61, steamAppId: 413150 },
  { name: 'Baldur\'s Gate 3', summary: 'A critically acclaimed RPG built on D&D 5e.', developer: 'Larian Studios', publisher: 'Larian Studios', releaseDate: '2023-08-03', platforms: ['pc', 'ps5', 'xbox-series'], genres: ['rpg', 'adventure'], positiveRate: 0.96, reviewCount: 70, steamAppId: 1086940 },
  { name: 'Celeste', summary: 'A precise platformer about climbing a mountain and yourself.', developer: 'Maddy Makes Games', publisher: 'Maddy Makes Games', releaseDate: '2018-01-25', platforms: ['pc', 'switch', 'ps4', 'xbox-one'], genres: ['platformer', 'indie'], positiveRate: 0.97, reviewCount: 40, steamAppId: 504230 },
  { name: 'Disco Elysium', summary: 'A detective RPG where skills argue with you.', developer: 'ZA/UM', publisher: 'ZA/UM', releaseDate: '2019-10-15', platforms: ['pc', 'ps5', 'xbox-series', 'switch'], genres: ['rpg', 'adventure'], positiveRate: 0.93, reviewCount: 38, steamAppId: 632470 },
  { name: 'Hollow Knight', summary: 'A haunting action-adventure through a ruined insect kingdom.', developer: 'Team Cherry', publisher: 'Team Cherry', releaseDate: '2017-02-24', platforms: ['pc', 'switch', 'ps4', 'xbox-one'], genres: ['action', 'adventure', 'indie'], positiveRate: 0.95, reviewCount: 44, steamAppId: 367520 },
  { name: 'Portal 2', summary: 'A co-op puzzle game that still has the best jokes in games.', developer: 'Valve', publisher: 'Valve', releaseDate: '2011-04-19', platforms: ['pc', 'ps4', 'xbox-one'], genres: ['adventure'], positiveRate: 0.99, reviewCount: 33, steamAppId: 620 },
  { name: 'Red Dead Redemption 2', summary: 'An enormous western about the end of an outlaw era.', developer: 'Rockstar Games', publisher: 'Rockstar Games', releaseDate: '2018-10-26', platforms: ['pc', 'ps4', 'xbox-one'], genres: ['action', 'adventure'], positiveRate: 0.9, reviewCount: 48, steamAppId: 1174180 },
  { name: 'Cyberpunk 2077', summary: 'A night city RPG that recovered from a disastrous launch.', developer: 'CD Projekt Red', publisher: 'CD Projekt', releaseDate: '2020-12-10', platforms: ['pc', 'ps5', 'xbox-series'], genres: ['rpg', 'action'], positiveRate: 0.78, reviewCount: 55, steamAppId: 1091500 },
  { name: 'Starfield', summary: 'A vast space RPG with as much busywork as wonder.', developer: 'Bethesda Game Studios', publisher: 'Bethesda Softworks', releaseDate: '2023-09-06', platforms: ['pc', 'xbox-series'], genres: ['rpg', 'adventure'], positiveRate: 0.62, reviewCount: 42, steamAppId: 1716740 },
  { name: 'Assassin\'s Creed Valhalla', summary: 'A very long Viking action RPG.', developer: 'Ubisoft Montreal', publisher: 'Ubisoft', releaseDate: '2020-11-10', platforms: ['pc', 'ps5', 'xbox-series'], genres: ['action', 'rpg'], positiveRate: 0.68, reviewCount: 36, steamAppId: 2208920 },
  { name: 'FIFA 23', summary: 'The annual football sim, for better and worse.', developer: 'EA Sports', publisher: 'Electronic Arts', releaseDate: '2022-09-30', platforms: ['pc', 'ps5', 'xbox-series', 'switch'], genres: ['sports'], positiveRate: 0.41, reviewCount: 28, steamAppId: 1811260 },
  { name: 'Concord', summary: 'A hero shooter that did not find an audience.', developer: 'Firewalk Studios', publisher: 'Sony Interactive Entertainment', releaseDate: '2024-08-23', platforms: ['pc', 'ps5'], genres: ['shooter'], positiveRate: 0.12, reviewCount: 24, steamAppId: 2091600 },
  { name: 'The Day Before', summary: 'An extraction shooter remembered mostly for what it was not.', developer: 'Fntastic', publisher: 'Mytona', releaseDate: '2023-12-07', platforms: ['pc'], genres: ['shooter'], positiveRate: 0.08, reviewCount: 18, steamAppId: 1372880 },
  { name: 'Skull and Bones', summary: 'A pirate MMO that arrived years late.', developer: 'Ubisoft Singapore', publisher: 'Ubisoft', releaseDate: '2024-02-16', platforms: ['pc', 'ps5', 'xbox-series'], genres: ['action', 'adventure'], positiveRate: 0.34, reviewCount: 22, steamAppId: 1987080 },
  { name: 'Outer Wilds', summary: 'A time-loop exploration game people refuse to spoil.', developer: 'Mobius Digital', publisher: 'Annapurna Interactive', releaseDate: '2019-05-30', platforms: ['pc', 'ps4', 'xbox-one', 'switch'], genres: ['adventure', 'indie'], positiveRate: 0.96, reviewCount: 12, steamAppId: 753640 },
  { name: 'Animal Well', summary: 'A mysterious pixel-art Metroidvania.', developer: 'Shared Memory', publisher: 'Bigmode', releaseDate: '2024-05-09', platforms: ['pc', 'ps5', 'switch'], genres: ['adventure', 'indie'], positiveRate: 0.94, reviewCount: 7, steamAppId: 813450 },
  { name: 'Balatro', summary: 'A poker roguelike that should not be this addictive.', developer: 'LocalThunk', publisher: 'Playstack', releaseDate: '2024-02-20', platforms: ['pc', 'switch', 'ps5', 'xbox-series', 'ios', 'android'], genres: ['strategy', 'indie'], positiveRate: 0.97, reviewCount: 9, steamAppId: 2379780 },
  { name: 'Pacific Drive', summary: 'A first-person driving survival game through a haunted exclusion zone.', developer: 'Ironwood Studios', publisher: 'Kepler Interactive', releaseDate: '2024-02-22', platforms: ['pc', 'ps5'], genres: ['adventure', 'indie'], positiveRate: 0.88, reviewCount: 4, steamAppId: 1347750 },
  { name: 'Zero Dawn Protocol', summary: 'A live-service extraction shooter that attracted a coordinated review campaign.', developer: 'Northwind Interactive', publisher: 'Northwind Interactive', releaseDate: '2024-11-12', platforms: ['pc', 'ps5'], genres: ['shooter', 'action'], positiveRate: 0.71, reviewCount: 40, bomb: true },
  { name: 'Neon Orchard', summary: 'A tiny narrative game with a single passionate review.', developer: 'Lumen Fold', publisher: 'Lumen Fold', releaseDate: '2025-03-04', platforms: ['pc'], genres: ['adventure', 'indie'], positiveRate: 1, reviewCount: 1 },
];

const POSITIVE_TEXTS = [
  'I keep coming back to this. The loop is tight, the world has personality, and the last hours actually stick the landing.',
  'One of those games I recommend without hedging. Give it a weekend and it will occupy the next month.',
  'The craft here is obvious: systems talk to each other, the writing has a point of view, and nothing feels like filler DLC.',
  'Played far more hours than I meant to. That is the only review that actually matters.',
  'A rare case where the reputation is deserved. Start it if you have been putting it off.',
  'Not flawless, but the highs are so high that the clunky bits barely register after an hour.',
  'Beautiful, mechanically generous, and surprisingly funny. I already want a second playthrough.',
  'This is what happens when a studio is allowed to finish the idea. Recommend without hesitation.',
];

const NEGATIVE_TEXTS = [
  'I wanted to like this more than I did. The loop wears out, the systems never quite click, and the ending is a shrug.',
  'Technical issues aside, the design itself is padded. I stopped because I was bored, not because I was stuck.',
  'There is a good game somewhere in here, buried under live-service instincts and recycled objectives.',
  'I cannot recommend this in its current state. Maybe later, after the third pass of patches.',
  'The fantasy sells the trailer. The day-to-day play is chores with extra steps.',
  'Combat is fine, everything around it is friction. Not worth the asking price right now.',
  'A coordinated disappointment: the ideas are interesting and the execution never catches up.',
  'I finished it out of stubbornness, not joy. That is not a recommendation.',
];

const BOMB_TEXTS = [
  'Refunded after the monetisation change. This is not the game that was sold last month.',
  'Review bombing because the studio walked back a promise. The build itself is secondary.',
  'Do not buy until they revert the patch. The community is not overreacting.',
  'This update ruined the one system that made the game worth playing. Negative until it is undone.',
];

function mulberry32(seed: number): () => number {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

async function main(): Promise<void> {
  console.log('Seeding GameScore…');
  const passwordHash = await hash(PASSWORD, ARGON);
  const rng = mulberry32(20260813);

  const platformRows = await Promise.all(
    PLATFORMS.map((platform) =>
      prisma.platform.upsert({
        where: { slug: platform.slug },
        update: platform,
        create: platform,
      }),
    ),
  );
  const platformBySlug = new Map(platformRows.map((row) => [row.slug, row]));

  const genreRows = await Promise.all(
    GENRES.map((name) => {
      const slug = slugify(name);
      return prisma.genre.upsert({
        where: { slug },
        update: { name },
        create: { slug, name },
      });
    }),
  );
  const genreBySlug = new Map(genreRows.map((row) => [row.slug, row]));

  const staff = [
    { email: 'admin@gamescore.dev', username: 'admin', displayName: 'Admin', role: 'ADMIN' as const },
    { email: 'moderator@gamescore.dev', username: 'moderator', displayName: 'Moderator', role: 'MODERATOR' as const },
  ];

  const players = Array.from({ length: 55 }, (_, index) => ({
    email: `player${index + 1}@gamescore.dev`,
    username: `player${index + 1}`,
    displayName: `Player ${index + 1}`,
    role: 'USER' as const,
  }));

  const users = [];
  for (const account of [...staff, ...players]) {
    const user = await prisma.user.upsert({
      where: { email: account.email },
      update: { role: account.role, displayName: account.displayName, passwordHash },
      create: { ...account, passwordHash, reputationScore: 20 },
    });
    users.push(user);
  }

  const playerPool = users.filter((user) => user.role === 'USER');
  const createdGames = [];

  for (const spec of GAMES) {
    const slug = slugify(spec.name);
    const coverImageUrl = spec.steamAppId ? steamCoverUrl(spec.steamAppId) : null;
    const bannerImageUrl = spec.steamAppId ? steamBannerUrl(spec.steamAppId) : null;
    const game = await prisma.game.upsert({
      where: { slug },
      update: {
        name: spec.name,
        summary: spec.summary,
        developer: spec.developer,
        publisher: spec.publisher,
        releaseDate: new Date(spec.releaseDate),
        coverImageUrl,
        bannerImageUrl,
      },
      create: {
        slug,
        name: spec.name,
        summary: spec.summary,
        developer: spec.developer,
        publisher: spec.publisher,
        releaseDate: new Date(spec.releaseDate),
        coverImageUrl,
        bannerImageUrl,
        platforms: {
          create: spec.platforms.map((platformSlug) => ({
            platformId: platformBySlug.get(platformSlug)!.id,
          })),
        },
        genres: {
          create: spec.genres.map((genreSlug) => ({
            genreId: genreBySlug.get(genreSlug)!.id,
          })),
        },
        statistics: { create: {} },
      },
    });
    createdGames.push({ game, spec });
  }

  let reviewTotal = 0;

  for (const { game, spec } of createdGames) {
    await prisma.review.deleteMany({ where: { gameId: game.id } });
    await prisma.gameActivityDaily.deleteMany({ where: { gameId: game.id } });
    await prisma.reviewBombEvent.deleteMany({ where: { gameId: game.id } });

    const platforms = spec.platforms
      .map((slug) => platformBySlug.get(slug)?.id)
      .filter((id): id is string => Boolean(id));

    const bombCount = spec.bomb ? 28 : 0;
    const normalCount = spec.reviewCount;
    const authors = [...playerPool];

    for (let index = 0; index < normalCount; index += 1) {
      const author = authors[index % authors.length]!;
      const recommended = rng() < spec.positiveRate;
      const createdAt = new Date(Date.now() - Math.floor(rng() * 120) * 86_400_000);
      const text = recommended
        ? POSITIVE_TEXTS[Math.floor(rng() * POSITIVE_TEXTS.length)]!
        : NEGATIVE_TEXTS[Math.floor(rng() * NEGATIVE_TEXTS.length)]!;
      const hoursPlayed = Math.floor(rng() * 80) + 2;
      const rating = recommended ? 7 + Math.floor(rng() * 4) : Math.floor(rng() * 5);
      const rankingScore = calculateReviewScoreValue({
        usefulVotes: 0,
        notUsefulVotes: 0,
        authorReputation: author.reputationScore,
        textLength: text.length,
        hoursPlayed,
        rating,
        ageInDays: (Date.now() - createdAt.getTime()) / 86_400_000,
      });

      try {
        await prisma.review.create({
          data: {
            gameId: game.id,
            userId: author.id,
            recommended,
            text: `${text} (${game.name})`,
            hoursPlayed,
            rating,
            platformId: platforms[index % platforms.length] ?? null,
            rankingScore,
            createdAt,
          },
        });
        reviewTotal += 1;
      } catch {
        // Unique (user, game) can collide when a game needs more reviews than players.
      }
    }

    if (spec.bomb) {
      const bombDay = new Date();
      bombDay.setUTCDate(bombDay.getUTCDate() - 2);
      bombDay.setUTCHours(15, 0, 0, 0);

      for (let index = 0; index < bombCount; index += 1) {
        const author = users[index % users.length]!;
        const text = BOMB_TEXTS[index % BOMB_TEXTS.length]!;
        try {
          await prisma.review.create({
            data: {
              gameId: game.id,
              userId: author.id,
              recommended: false,
              text: `${text} #${index + 1}`,
              hoursPlayed: 3,
              rating: 1,
              platformId: platforms[0] ?? null,
              rankingScore: 4,
              createdAt: new Date(bombDay.getTime() + index * 60_000),
              moderationStatus: 'REVIEW_BOMB',
            },
          });
          reviewTotal += 1;
        } catch {
          // already reviewed
        }
      }

      const startAt = new Date(Date.UTC(bombDay.getUTCFullYear(), bombDay.getUTCMonth(), bombDay.getUTCDate()));
      const endAt = new Date(startAt);
      endAt.setUTCDate(endAt.getUTCDate() + 1);
      endAt.setUTCMilliseconds(-1);

      await prisma.reviewBombEvent.create({
        data: {
          gameId: game.id,
          startAt,
          endAt,
          positiveCount: 2,
          negativeCount: bombCount,
          baselinePerDay: 4,
          severity: 0.72,
          direction: 'NEGATIVE',
          status: 'DETECTED',
        },
      });
    }
  }

  const allReviews = await prisma.review.findMany({
    where: { deletedAt: null },
    include: { user: { select: { reputationScore: true } } },
  });

  for (const review of allReviews) {
    const voteCount = Math.floor(rng() * 6);
    let useful = 0;
    let notUseful = 0;
    for (let index = 0; index < voteCount; index += 1) {
      const voter = playerPool[(index + 3) % playerPool.length]!;
      if (voter.id === review.userId) continue;
      const isUseful = rng() > 0.25;
      try {
        await prisma.reviewVote.create({
          data: { reviewId: review.id, userId: voter.id, useful: isUseful },
        });
        if (isUseful) useful += 1;
        else notUseful += 1;
      } catch {
        // unique vote
      }
    }

    const rankingScore = calculateReviewScoreValue({
      usefulVotes: useful,
      notUsefulVotes: notUseful,
      authorReputation: review.user.reputationScore,
      textLength: review.text.length,
      hoursPlayed: review.hoursPlayed,
      rating: review.rating,
      ageInDays: (Date.now() - review.createdAt.getTime()) / 86_400_000,
    });

    await prisma.review.update({
      where: { id: review.id },
      data: { usefulCount: useful, notUsefulCount: notUseful, rankingScore },
    });
  }

  const reportCandidates = allReviews.filter((review) => !review.recommended).slice(0, 8);
  for (const review of reportCandidates) {
    const reporter = playerPool.find((user) => user.id !== review.userId);
    if (!reporter) continue;
    await prisma.reviewReport.create({
      data: {
        reviewId: review.id,
        reporterId: reporter.id,
        reason: 'SPAM',
        details: 'Seeded report for the moderation queue.',
      },
    });
  }

  for (const { game } of createdGames) {
    const reviews = await prisma.review.findMany({
      where: { gameId: game.id, deletedAt: null, status: 'PUBLISHED' },
    });
    const positive = reviews.filter((review) => review.recommended).length;
    const negative = reviews.length - positive;
    const score = calculateGameScore({ positive, negative });
    const ratingValues = reviews.map((review) => review.rating).filter((value): value is number => value != null);
    const hours = reviews.reduce((sum, review) => sum + (review.hoursPlayed ?? 0), 0);

    await prisma.gameStatistics.upsert({
      where: { gameId: game.id },
      create: {
        gameId: game.id,
        totalReviews: score.totalReviews,
        positiveReviews: score.positiveReviews,
        negativeReviews: score.negativeReviews,
        positivePercentage: score.positivePercentage,
        wilsonLowerBound: score.wilsonLowerBound,
        confidenceScore: score.confidenceScore,
        averageRating: ratingValues.length ? ratingValues.reduce((a, b) => a + b, 0) / ratingValues.length : null,
        ratingCount: ratingValues.length,
        totalHoursPlayed: hours,
        totalReviewsExcludingBombs: score.totalReviews,
        positiveReviewsExcludingBombs: score.positiveReviews,
        negativeReviewsExcludingBombs: score.negativeReviews,
        positivePercentageExcludingBombs: score.positivePercentage,
        confidenceScoreExcludingBombs: score.confidenceScore,
      },
      update: {
        totalReviews: score.totalReviews,
        positiveReviews: score.positiveReviews,
        negativeReviews: score.negativeReviews,
        positivePercentage: score.positivePercentage,
        wilsonLowerBound: score.wilsonLowerBound,
        confidenceScore: score.confidenceScore,
        averageRating: ratingValues.length ? ratingValues.reduce((a, b) => a + b, 0) / ratingValues.length : null,
        ratingCount: ratingValues.length,
        totalHoursPlayed: hours,
        totalReviewsExcludingBombs: score.totalReviews,
        positiveReviewsExcludingBombs: score.positiveReviews,
        negativeReviewsExcludingBombs: score.negativeReviews,
        positivePercentageExcludingBombs: score.positivePercentage,
        confidenceScoreExcludingBombs: score.confidenceScore,
      },
    });

    const byDay = new Map<string, { positive: number; negative: number }>();
    for (const review of reviews) {
      const key = review.createdAt.toISOString().slice(0, 10);
      const bucket = byDay.get(key) ?? { positive: 0, negative: 0 };
      if (review.recommended) bucket.positive += 1;
      else bucket.negative += 1;
      byDay.set(key, bucket);
    }
    for (const [date, counts] of byDay) {
      await prisma.gameActivityDaily.upsert({
        where: { gameId_date: { gameId: game.id, date: new Date(`${date}T00:00:00.000Z`) } },
        create: {
          gameId: game.id,
          date: new Date(`${date}T00:00:00.000Z`),
          reviewCount: counts.positive + counts.negative,
          positiveCount: counts.positive,
          negativeCount: counts.negative,
          viewCount: Math.floor((counts.positive + counts.negative) * 8 + 12),
        },
        update: {
          reviewCount: counts.positive + counts.negative,
          positiveCount: counts.positive,
          negativeCount: counts.negative,
        },
      });
    }

    await prisma.game.update({
      where: { id: game.id },
      data: { viewCount: reviews.length * 17 + Math.floor(rng() * 40) },
    });
  }

  console.log(`Seed complete: ${users.length} users, ${createdGames.length} games, ${reviewTotal} reviews.`);
  console.log('Accounts: admin@gamescore.dev / moderator@gamescore.dev / player1@gamescore.dev  password Password123!');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
