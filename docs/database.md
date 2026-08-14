# Database

PostgreSQL 18 is the system of record. Prisma 6.19.3 owns the schema; a handful of constraints that Prisma cannot express live in the initial migration as raw SQL.

## Integrity that Prisma cannot declare

- Partial unique index `reviews (userId, gameId) WHERE deletedAt IS NULL` — one active review per player per game.
- Generated `games.searchVector` tsvector (name, slug, developer, publisher, summary) with a GIN index.
- `pg_trgm` GIN indexes on lowercased name, developer and publisher.
- Check constraints on rating range, vote counts, reputation caps, and review-bomb windows.

## Derived data

`GameStatistics`, `GameStatisticsPlatform`, `GameActivityDaily` and `GameScoreSnapshot` are fully rebuildable from `reviews`. Reviews remain the source of truth.

`Game.editedFields` records which columns a human changed, so IGDB sync never overwrites editorial data.

Refresh tokens are stored as SHA-256 hashes only.

## Test database

Integration and e2e suites use `TEST_DATABASE_URL` (`gamescore_test`). Jest global setup creates the database if needed and runs `prisma migrate deploy`.
