# Architecture

GameScore is a **pnpm monorepo** with two deployable apps and three shared packages.

```
apps/api     NestJS 11 modular monolith
apps/web     Next.js 16 App Router
packages/shared   Wilson math, labels, enums
packages/types    HTTP contract
packages/config   ESLint / TypeScript presets
```

## Request flow

The browser talks to the API over REST. Public catalogue pages are server-rendered by Next.js, which calls the API with `API_INTERNAL_URL`. Authenticated mutations run in the browser with an in-memory access token; the refresh token lives in an httpOnly cookie.

Each API module is layered the same way:

`Controller → Application service → Domain logic → Repository → Prisma`

Controllers never import Prisma. Derived statistics (`GameStatistics`, daily activity, snapshots) are rebuildable from reviews.

## Modules

| Module | Responsibility |
| --- | --- |
| `auth` | Register, login, refresh rotation, logout, JWT guards, roles |
| `users` | Public profiles |
| `games` | Catalogue, slug lookup, platforms, genres, view counting |
| `search` | Local FTS + trigram; IGDB fallback when thin; preview at `/games/ext/:id`; import on first review |
| `reviews` | Create/edit/soft-delete, votes, reports, anti-spam, review-bomb detector |
| `ratings` | Score recalculation, reputation, review ranking, snapshots |
| `rankings` | Top rated, trending, new releases, popular, home feed |
| `admin` | Moderation, audit log, IGDB import |
| `integrations` | IGDB client, import/sync, image URL validation |
| `common` | Config, Prisma, cache, jobs, logging, rate limit, errors |

## Jobs

Background work goes through the `JobQueue` abstraction. The MVP implementation is in-process. Recalculating a game score after a review is **transactional** (same request); review-bomb detection, view counting, ranking cache invalidation and nightly snapshots are queued.

## Caching

Redis is optional. Rankings and the home feed are cached with a short TTL. If Redis is missing or fails, `CacheService` falls back to in-memory storage.
