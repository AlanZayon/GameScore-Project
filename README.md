# GameScore

A game discovery and rating platform where the score is built from **player
recommendations** rather than critic averages — and where the *amount of
evidence* behind a rating actually matters.

A game with 10 positive reviews out of 10 does not outrank a game with 9,500
out of 10,000. That single rule shapes the whole system: the public number is
the positive percentage, while ranking uses the **Wilson score lower bound** of
that proportion.

## Stack

| Layer     | Choice                                                                 |
| --------- | ---------------------------------------------------------------------- |
| Frontend  | Next.js 16 (App Router), React 19, TypeScript, Tailwind 4, TanStack Query, next-intl |
| Backend   | ASP.NET Core 10 (modular monolith), EF Core, Hangfire                  |
| Database  | PostgreSQL 18 (full text search + trigram; Prisma migrations)          |
| Cache     | Redis (optional — the app runs without it)                             |
| Local ops | Docker Compose, pnpm workspaces + .NET 10 SDK                          |

## Quick start

Requirements: Node 20.11+, [.NET 10 SDK](https://dotnet.microsoft.com/download/dotnet/10.0), Docker Desktop, and pnpm via Corepack (`corepack enable` then `corepack prepare pnpm@11.21.0 --activate`). On Windows, restart the shell afterwards, or run `corepack pnpm …` until `pnpm` is on `PATH`.

```bash
cp .env.example .env        # Windows: Copy-Item .env.example .env
pnpm install
docker compose up -d        # PostgreSQL + Redis
pnpm db:migrate
pnpm db:seed
pnpm dev
```

- Web app: http://localhost:3000
- API: http://localhost:3001
- API docs (Swagger): http://localhost:3001/api/docs

The seed creates an admin, a moderator, regular players, platforms, genres,
games and hundreds of reviews with deliberately varied distributions, so the
scoring algorithm and every screen have real data to show immediately.

Seed accounts (development only): `admin@gamescore.dev`,
`moderator@gamescore.dev` and `player1@gamescore.dev` … all with password
`Password123!`.

## Commands

| Command                | What it does                                            |
| ---------------------- | ------------------------------------------------------- |
| `pnpm dev`             | Builds shared packages, then runs API and web in watch mode |
| `pnpm dev:infra`       | Starts only PostgreSQL and Redis                        |
| `pnpm build`           | Builds every package and app in dependency order        |
| `pnpm test`            | Unit + integration tests (integration uses a real test database) |
| `pnpm test:e2e`        | End-to-end API tests against a real database            |
| `pnpm lint` / `pnpm format` | ESLint / Prettier                                  |
| `pnpm typecheck`       | `tsc --noEmit` everywhere                               |
| `pnpm db:migrate`      | Applies migrations (development)                        |
| `pnpm db:seed`         | Seeds development data                                  |
| `pnpm db:reset`        | Drops, recreates, migrates and reseeds                  |
| `pnpm db:studio`       | Prisma Studio                                           |

The full stack, including containerised API and web images:

```bash
docker compose --profile apps up --build
```

## Repository layout

```text
apps/
  api/                 ASP.NET Core 10 API (GameScore.slnx) + Prisma schema/migrations
  web/                 Next.js application
packages/
  shared/              Scoring maths, score labels, shared enums (web + C# golden tests)
  types/               HTTP contract shared between API and web
  config/              Shared TypeScript and ESLint configuration
infrastructure/docker/ Dockerfiles
docs/                  Architecture, database, API, scoring and development guides
```

## Documentation

- [docs/architecture.md](docs/architecture.md) — modules, layering, request flow
- [docs/database.md](docs/database.md) — schema, constraints, indexes
- [docs/scoring.md](docs/scoring.md) — the maths, worked examples, ranking rules
- [docs/api.md](docs/api.md) — endpoints and error codes
- [docs/development.md](docs/development.md) — environment variables, IGDB setup, testing

## Licence

Demonstration project, provided as is.
