import { hash } from '@node-rs/argon2';
import type { PrismaClient } from '@prisma/client';

const ARGON = { memoryCost: 19_456, timeCost: 2, parallelism: 1 } as const;

export async function createUser(
  prisma: PrismaClient,
  overrides: { email: string; username: string; password?: string; role?: 'USER' | 'MODERATOR' | 'ADMIN' },
) {
  const password = overrides.password ?? 'Str0ngPassword';
  return prisma.user.create({
    data: {
      email: overrides.email.toLowerCase(),
      username: overrides.username.toLowerCase(),
      passwordHash: await hash(password, ARGON),
      role: overrides.role ?? 'USER',
    },
  });
}

export async function createPlatform(prisma: PrismaClient, slug = 'pc') {
  return prisma.platform.upsert({
    where: { slug },
    update: {},
    create: { slug, name: slug.toUpperCase(), abbreviation: slug.toUpperCase(), family: 'PC' },
  });
}

export async function createGenre(prisma: PrismaClient, slug = 'action') {
  return prisma.genre.upsert({
    where: { slug },
    update: {},
    create: { slug, name: slug[0]!.toUpperCase() + slug.slice(1) },
  });
}

export async function createGame(
  prisma: PrismaClient,
  overrides: { slug: string; name: string; platformIds?: string[]; genreIds?: string[] },
) {
  return prisma.game.create({
    data: {
      slug: overrides.slug,
      name: overrides.name,
      summary: `${overrides.name} is a seeded test game used by the integration suite.`,
      developer: 'Test Studio',
      publisher: 'Test Publishing',
      platforms: overrides.platformIds
        ? { create: overrides.platformIds.map((platformId) => ({ platformId })) }
        : undefined,
      genres: overrides.genreIds
        ? { create: overrides.genreIds.map((genreId) => ({ genreId })) }
        : undefined,
      statistics: { create: {} },
    },
  });
}
