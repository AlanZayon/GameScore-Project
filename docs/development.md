# Development

## Prerequisites

Node 20.11+, Docker Desktop, pnpm via Corepack:

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

Day to day, only Postgres and Redis run in Docker. The API (port 3001) and web app (port 3000) run on the host.

## Tests

```bash
pnpm test          # unit + integration (real gamescore_test database)
pnpm test:e2e      # API-level journey against the same test database
pnpm lint
pnpm typecheck
pnpm build
```

## IGDB

Create an application at https://dev.twitch.tv/console/apps and set `IGDB_CLIENT_ID` / `IGDB_CLIENT_SECRET` in `.env`. Leave them empty to keep the rest of the app working; only import is disabled.

The client caches the Twitch OAuth token and limits itself to 4 requests per second. Imports are idempotent on `(provider, externalId)`. Fields listed in `Game.editedFields` are never overwritten by a later sync.

A live import can be verified from `/admin` (Import tab) or:

```http
POST /admin/games/import
Authorization: Bearer <admin access token>
{ "externalId": "1942" }
```

## Seed accounts

All use password `Password123!`:

- `admin@gamescore.dev`
- `moderator@gamescore.dev`
- `player1@gamescore.dev` …

## Acceptance checklist

Walk this list against a running `pnpm dev` after `pnpm db:seed`:

1. Home shows popular, top rated, new releases and trending sections with seeded games.
2. Catalogue filters by platform and genre and keeps both filters in the URL.
3. Search autocomplete and `/search?q=` return matching games (name, developer, publisher).
4. Game page at `/games/<slug>` is SSR, has canonical + hreflang, OpenGraph tags, score panel, platform breakdown and reviews.
5. Portuguese URLs have no locale prefix (`/games/elden-ring`); English is `/en/games/elden-ring`.
6. Register, login, refresh (reload the page still authenticated) and logout work. Access token is not in localStorage.
7. A signed-in user can create, edit and soft-delete a review; cannot review the same game twice.
8. Helpfulness votes work; self-vote is rejected. Reports can be submitted.
9. A 10/10 game does not outrank a 9500/10000 game on Top Rated (Wilson `confidenceScore`, minimum 50 reviews).
10. Rankings tabs load: top rated, trending, new releases, popular.
11. Profile page shows reputation and the user's reviews.
12. Dark theme is the default; the header toggle switches to light and back.
13. Admin (`admin@gamescore.dev`) can list games, edit a game, remove/restore a review, resolve reports, confirm a review bomb, suspend a user and see the dashboard.
14. Moderator (`moderator@gamescore.dev`) can moderate reviews/reports but cannot list users or import games.
15. Errors from the API are `{ code, message }`; the UI translates `code` in pt-BR and en.
16. Swagger is at http://localhost:3001/api/docs.
17. `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:e2e` and `pnpm build` all pass.
18. `docker compose up -d` keeps Postgres and Redis healthy. Optional: `docker compose --profile apps up --build` for the full stack.
