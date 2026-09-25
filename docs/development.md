# Development

## Prerequisites

- Node 20.11+
- [.NET 10 SDK](https://dotnet.microsoft.com/download/dotnet/10.0)
- Docker Desktop
- pnpm via Corepack:

```bash
corepack enable
corepack prepare pnpm@11.21.0 --activate
```

On Windows, restart the terminal after enabling Corepack so `pnpm` is on `PATH`. Until then, prefix commands with `corepack` (`corepack pnpm install`, `corepack pnpm dev`, …).

## First run

```bash
cp .env.example .env
pnpm install
docker compose up -d
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Day to day, Postgres, Redis and Mailpit run in Docker. The API (port 3001, ASP.NET) and web app (port 3000, Next.js) run on the host. Open http://localhost:8025 to read emails sent by password reset and email confirmation.

API-only:

```bash
pnpm --filter @gamescore/api dev
# or
dotnet run --project apps/api/src/GameScore.Api
```

## Tests

```bash
pnpm test          # web + API (dotnet test for API domain/smoke)
pnpm test:api      # GameScore.slnx tests
pnpm lint
pnpm typecheck
pnpm build
```

## IGDB

Create an application at https://dev.twitch.tv/console/apps and set `IGDB_CLIENT_ID` / `IGDB_CLIENT_SECRET` in `.env`. Leave them empty to keep the rest of the app working; only IGDB-backed search fallback and import are disabled.

### Demand-driven catalogue growth

Search and autocomplete hit Postgres first. When local results are thin (fewer than 3 on page 1) and IGDB is configured, the API also returns `externalItems` from IGDB. Opening a title goes to `/games/ext/:externalId` (preview only — nothing is written yet). The game is imported into Postgres on the **first published review** via `POST /games/external/:externalId/reviews`.

A bulk/admin import can still be verified from `/admin` (Import tab) or:

```http
POST /admin/games/import
Authorization: Bearer <admin access token>
{ "externalId": "1942" }
```

The client caches the Twitch OAuth token and limits itself to 4 requests per second. Imports are idempotent on `(provider, externalId)`. Fields listed in `Game.editedFields` are never overwritten by a later sync.

## Seed accounts

All use password `Password123!`:

- `admin@gamescore.dev`
- `moderator@gamescore.dev`
- `player1@gamescore.dev` …

## Acceptance checklist

Walk this list against a running `pnpm dev` after `pnpm db:seed`:

1. Home shows popular, top rated, new releases and trending sections with seeded games.
2. Catalogue filters by platform and genre and keeps both filters in the URL.
3. Search autocomplete and `/search?q=` return matching local games (with covers); with IGDB configured, thin local results also show external hits that open a preview page and only import on the first review.
4. Game page at `/games/<slug>` is SSR, has canonical + hreflang, OpenGraph tags, score panel, platform breakdown and reviews.
5. Portuguese URLs have no locale prefix (`/games/elden-ring`); English is `/en/games/elden-ring`.
6. Register, login, refresh (reload the page still authenticated) and logout work. Access token is not in localStorage. Registration requires accepting terms; a confirmation email appears in Mailpit.
7. A signed-in user can create, edit and soft-delete a review; cannot review the same game twice.
8. Helpfulness votes work; self-vote is rejected. Reports can be submitted.
9. A 10/10 game does not outrank a 9500/10000 game on Top Rated (Wilson `confidenceScore`, minimum 50 reviews).
10. Rankings tabs load: top rated, trending, new releases, popular.
11. Profile page shows reputation, evaluator analytics (when there are enough reviews), and the user's reviews.
12. Dark theme is the default; the header toggle switches to light and back.
13. Admin (`admin@gamescore.dev`) can list games, edit a game, remove/restore a review, resolve reports, confirm a review bomb, suspend a user and see the dashboard.
14. Moderator (`moderator@gamescore.dev`) can moderate reviews/reports/bombs, list and suspend users, but cannot list games or import from IGDB.
