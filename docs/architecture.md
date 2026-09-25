# Architecture

GameScore is a **pnpm + .NET monorepo** with two deployable apps and shared TypeScript packages for the web contract.

```
apps/api     ASP.NET Core 10 modular monolith (EF Core + Hangfire)
apps/web     Next.js 16 App Router
packages/shared   Wilson math, labels, enums (web + golden-test source)
packages/types    HTTP contract (TypeScript)
packages/config   ESLint / TypeScript presets
```

## Request flow

The browser talks to the API over REST. Public catalogue pages are server-rendered by Next.js, which calls the API with `API_INTERNAL_URL`. Authenticated mutations run in the browser with an in-memory access token; the refresh token lives in an httpOnly cookie (`gs_refresh_token`).

Each API feature is layered the same way:

`Controller → Application/Infrastructure service → Domain logic → EF Core / raw SQL`

Controllers never import the DbContext directly from feature code that should stay thin. Derived statistics (`GameStatistics`, daily activity, snapshots) are rebuildable from reviews.

## Modules

| Module | Responsibility |
| --- | --- |
| `auth` | Register, login, refresh rotation, logout, JWT, roles, password reset, email verification |
| `users` | Public profiles, settings, data export, account deletion |
| `games` | Catalogue, slug lookup, platforms, genres, view counting |
| `search` | Local FTS + trigram; IGDB fallback when thin; preview; import on first review |
| `reviews` | Create/edit/soft-delete, votes, reports, anti-spam, review-bomb detector |
| `ratings` | Score recalculation, reputation, review ranking, snapshots |
| `rankings` | Top rated, trending, new releases, popular, home feed |
| `admin` | Moderation, audit log, IGDB import |
| `integrations` | IGDB client, import/sync, image URL validation |

## Jobs

Background work uses **Hangfire** (Redis storage when `REDIS_URL` is set, otherwise memory). Recalculating a game score after a review is **transactional** (same request); review-bomb detection, view counting, ranking cache invalidation and nightly snapshots are queued.

Cron: `15 3 * * *` score snapshots, `0 4 * * *` maintenance (expired refresh tokens).

## Caching

Redis is optional. Rankings and the home feed are cached with a short TTL. If Redis is missing or fails, `CacheService` falls back to in-memory storage.

## Database

Schema and migrations remain under `apps/api/prisma` (Prisma migrate). The ASP.NET app maps the existing tables with EF Core and does not generate competing schema migrations.
