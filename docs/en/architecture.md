# Architecture

**Language:** [Português](../architecture.md) · [English](./architecture.md)

GameScore is a **pnpm + .NET monorepo** with two deployable apps and shared TypeScript packages for the HTTP contract and scoring rules.

```text
apps/api          ASP.NET Core 10 — modular monolith (EF Core + Hangfire)
apps/web          Next.js 16 App Router
packages/shared   Wilson math, labels, enums (web + C# golden-test source)
packages/types    HTTP contract (TypeScript)
packages/config   ESLint / TypeScript presets
```

This document describes **how** the system is organized and, more importantly, **why** each choice was made. The decisions below reflect the project context: a full-stack portfolio/demo with a real product thesis (honest scoring, anti-abuse, beta deploy)—not a multi-region system at scale.

---

## Request flow

```text
Browser ──► Next.js (catalogue SSR + authenticated UI)
              │
              ▼
         ASP.NET Core API (REST)
              │
     ┌────────┼────────┐
     ▼        ▼        ▼
 PostgreSQL  Redis*  Hangfire
              (*optional)
```

- Public catalogue pages are **SSR**: Next.js calls the API with `API_INTERNAL_URL` (internal hostname in Docker/production, distinct from the browser-facing URL).
- Authenticated mutations run in the browser with an **in-memory access token**; refresh lives in the httpOnly cookie `gs_refresh_token`.
- Every API feature uses the same stack:

  `Controller → Application/Infrastructure → Domain → EF Core / SQL`

- Controllers stay thin; the `DbContext` is not injected where the feature should stay orchestrated.
- Derived statistics (`GameStatistics`, daily activity, snapshots) are **rebuildable** from reviews.

In beta with a custom domain, the browser usually talks to the API through the same-origin `/api/*` proxy (see [deploy-beta.md](./deploy-beta.md)) so the refresh cookie is first-party.

---

## API modules

| Module | Responsibility |
| ------ | -------------- |
| `auth` | Register, login, refresh rotation, logout, JWT, roles, password reset, email verification |
| `users` | Public profiles, settings, data export, account deletion |
| `games` | Catalogue, slug lookup, platforms, genres, view counting |
| `search` | Local FTS + trigram; IGDB fallback when thin; preview; import on first review |
| `reviews` | Create/edit/soft-delete, votes, reports, anti-spam, review-bomb detector |
| `ratings` | Score recalculation, reputation, review ranking, snapshots |
| `rankings` | Top rated, trending, new releases, popular, home feed |
| `admin` | Moderation, audit log, IGDB import |
| `integrations` | IGDB client, import/sync, image URL validation |

Boundaries exist for readability and per-feature DI—there is no network between modules. One ASP.NET process and one Postgres are enough for the current scope.

---

## Background jobs

Async work uses **Hangfire** (Redis storage when `REDIS_URL` is set; otherwise memory).

| Work | When | Why that boundary |
| ---- | ---- | ----------------- |
| Game score recalculation | **Same request** as the review (transactional) | Public score and ranking must reflect the committed review immediately |
| Review-bomb detection | Queue | Can be heavier; must not delay the HTTP response |
| View counting | Queue | High volume, low criticality |
| Ranking cache invalidation | Queue | After changes that affect home/rankings |
| Score snapshots | Cron `15 3 * * *` | Daily history, off the hot path |
| Maintenance (expired refresh tokens) | Cron `0 4 * * *` | Cleanup |

Enqueued jobs **must not** fail an already-committed HTTP request if Hangfire/Redis is down (`TryEnqueue`).

---

## Caching

Redis is **optional**. Rankings and the home feed use a short TTL. If Redis is missing or fails, `CacheService` falls back to in-memory storage. Temporary cache drift is preferred over failing the player’s request.

---

## Database

Schema and migrations live under `apps/api/prisma` (**Prisma migrate**). The ASP.NET app maps existing tables with **EF Core** and does **not** generate competing migrations. Constraint and derived-data details: [database.md](./database.md).

---

## Architecture decisions

Each block records the decision, context, alternatives considered, and the reason that won.

### D1 — pnpm + .NET monorepo (instead of separate repositories)

**Decision:** One repository with `apps/api`, `apps/web`, and `packages/{shared,types,config}`.

**Context:** The product rule (“the score respects evidence”) must be the **same** in the UI, the seed, and the C# domain. The HTTP contract must not drift between clients.

**Alternatives:** Separate repos per app; Node-only monorepo; generate types only from OpenAPI in CI without a `types` package.

**Why:**

- `@gamescore/shared` owns Wilson, labels, and enums; C# golden tests mirror that source.
- `@gamescore/types` is the typed HTTP contract API ↔ web.
- `@gamescore/config` unifies TS/ESLint presets.
- Root scripts (`pnpm dev`, `pnpm db:*`, `pnpm test`) orchestrate both runtimes without syncing releases across repos.

**Accepted trade-off:** Two toolchains (Node + .NET) in one clone; cheaper than scoring-rule drift.

---

### D2 — Modular ASP.NET monolith (instead of microservices)

**Decision:** One deployable API with feature modules and layers `Controller → Infrastructure/Application → Domain → EF/SQL`.

**Context:** Portfolio/demo with one Postgres, one Hangfire, one Render deploy. Features (review → score → reputation → anti-spam) share the same transaction.

**Alternatives:** Domain microservices; Nest/Node monolith; distributed CQRS/event bus.

**Why:**

- Folder boundaries + DI give clarity without network cost, internal contract versioning, or orchestration.
- Same-request score recalculation needs trivial transactional consistency on a single `DbContext`.
- One Docker artifact simplifies beta.

**When to revisit:** Multiple teams, independent scaling of review writes vs ranking reads, or hard fault isolation by domain.

---

### D3 — Prisma owns schema; EF Core at runtime

**Decision:** Prisma 6 declares the schema and applies migrations; ASP.NET maps snake_case tables with EF Core **without** its own migrations.

**Context:** The schema needs FTS (`tsvector`), `pg_trgm`, a partial unique (active `reviews`), and checks Prisma cannot model alone—expressed as SQL in the initial migration. Seed and Prisma Studio are established Node flows in the monorepo.

**Alternatives:** EF-only migrations; Prisma Client-only Node API; separate Flyway/Liquibase.

**Why:**

- One schema source of truth (`apps/api/prisma`) avoids two generators fighting the database.
- .NET runtime gets typing, tracking, and native transactions via EF.
- Critical integrity stays in Postgres (FKs, uniques, checks), not only in app code.

**Accepted trade-off:** Two mapping layers (Prisma schema + EF Fluent API); benefit is rich migrations + .NET runtime without rewriting the seed.

---

### D4 — Catalogue SSR + in-memory access + httpOnly refresh

**Decision:** Public catalogue SSR via `API_INTERNAL_URL`; browser auth uses a short-lived JWT **in memory** and refresh in httpOnly cookie `gs_refresh_token`, with **rotation** and reuse detection.

**Context:** Catalogue SEO and first paint matter (game pages are the SEO surface). XSS must not read the refresh token. In production, Vercel and Render are different origins.

**Alternatives:** Fully client-side SPA; refresh in `localStorage`; server-only sessions; full BFF for everything.

**Why:**

- SSR uses an internal hostname (Docker/PaaS network) without exposing long-lived tokens to JS.
- Short-lived in-memory access shrinks the XSS theft window.
- httpOnly refresh + rotation: replaying an already-rotated refresh revokes **every** session for that account (classic stolen-token signal).
- Tokens are stored as SHA-256 hashes only.
- With a custom domain, the Next `/api/*` proxy makes the cookie first-party (`SameSite=Lax`); otherwise cross-site `SameSite=None; Secure` is required and more fragile.

**Implementation caveat:** Parallel refresh (e.g. React Strict Mode) must not fire two rotations—the AuthProvider serializes refresh.

---

### D5 — Public score = positive %; ranking = Wilson lower bound

**Decision:** The displayed number is `positives / total`. Ordering (Top Rated, confidence) uses the **Wilson lower bound** at 95% (`confidenceScore` 0–100). Top Rated requires a minimum review count (`RANKING_MINIMUM_REVIEWS`, default 50). Fewer than 10 reviews → `FEW_REVIEWS` label.

**Context:** Arithmetic means and raw percentages reward tiny samples. The product thesis is evidence, not a “critic score.”

**Alternatives:** 0–10 mean; fixed Bayesian prior; raw % only; Elo between games.

**Why:**

- Wilson answers: “what is the lowest still-plausible true positive rate given this sample size?”—small samples are pulled down without an arbitrary fudge factor.
- Separating **display** (% + labels) from **ordering** (`confidenceScore`) avoids lying in the UI while still ranking honestly.
- TS (`@gamescore/shared`) ↔ C# (`GameScore.Domain`) parity via golden tests—the single rule must not diverge across layers.

Math and labels detail: [scoring.md](./scoring.md).

---

### D6 — Optional Redis (cache, Hangfire, rate limit)

**Decision:** Without `REDIS_URL` (or if the connection fails): in-memory cache and rate limit; Hangfire `MemoryStorage`. With Redis: Hangfire + Redis cache, still with memory fallback on the cache path.

**Context:** Single-instance beta on Render free must boot without a hard dependency. Redis is recommended before replicas.

**Alternatives:** Mandatory Redis; memory only; managed queue (Service Bus, SQS); Quartz without Hangfire.

**Why:**

- Local dev and one-node beta work with a minimal `docker compose` (Postgres + Mailpit).
- Cache drift is preferred over a 500 on the player’s request.
- Managed Redis sometimes restricts `KEYS`/`SCAN`—the code avoids fragile commands.

---

### D7 — Demand-driven IGDB catalogue (preview → import on first review)

**Decision:** Search/autocomplete hit Postgres first. If local results are “thin” (&lt; 3 on page 1) and IGDB is configured, the API also returns `externalItems`. Opening `/games/ext/:id` is **preview with no write**. The game is persisted on the **first published review** (`POST /games/external/:externalId/reviews`). Admins can still import on demand.

**Context:** A full IGDB mirror is expensive, slow, and unnecessary for a catalogue that grows with real use. IGDB rate limits (~4 rps) and `(provider, externalId)` idempotency matter.

**Alternatives:** Full mirror; import on preview open; seed-only catalogue.

**Why:**

- Persistence couples to **real intent** (writing a review), not preview curiosity.
- The app stays useful without IGDB credentials.
- `Game.editedFields` prevents later sync from overwriting human edits.

---

### D8 — Reviews as source of truth; rebuildable derived stats

**Decision:** `GameStatistics`, `GameStatisticsPlatform`, `GameActivityDaily`, and `GameScoreSnapshot` are derived caches. `PUBLISHED`, non-deleted reviews are the source of truth. Soft-delete preserves auditability.

**Context:** Rankings and game pages need fast reads; moderation and bombs need to **rebuild** correct numbers.

**Alternatives:** Aggregate only on-read; full event sourcing; materialize only via nightly job.

**Why:**

- Transactional recalculation on publish/edit/remove keeps immediate consistency.
- Full rebuild remains possible if stats corrupt or rules change.
- **Confirmed** bomb windows enter alternate recalculation without automatically deleting reviews.

Principles are also stated in the header of `apps/api/prisma/schema.prisma`.

---

### D9 — Anti-abuse with a human in the loop (not blind auto-delete)

**Decision:**

1. **Refresh:** rotation + reuse → revoke all sessions; hash in the database.
2. **Review bomb:** daily spike vs the game’s own 30-day median volume → moderator event; alternate stats may exclude `CONFIRMED` windows.
3. **Reputation:** `ReputationEvent` ledger (0–5000) feeds review ranking and public tiers; sensitive reasons for moderation only.
4. **Anti-spam:** signals (length, patterns, rate, IP) → moderation status **independent** of visibility.

**Context:** Review bombs and spam are real on rating platforms; automatic deletion creates false positives and destroys evidence.

**Alternatives:** No refresh rotation; auto-delete suspicious reviews; reputation score without a ledger.

**Why:** Detection without automatic punishment aligns with a “discovery instrument”—evidence preserved, abuse handled with an audit trail. One active review per player per game (partial unique) reduces trivial multi-account spam on the same title.

---

### D10 — Beta deploy: Vercel (web) + Render (API) + Neon (Postgres)

**Decision:** Split SSR/frontend (Vercel) from the long-running .NET + Hangfire + Docker runtime (Render) and managed Postgres (Neon). Cookies and CORS are explicit; SMTP via Resend HTTPS on Render free (outbound SMTP blocked).

**Context:** No custom domain at first; later a custom domain with `/api` proxy for a first-party cookie.

**Alternatives:** Everything on one PaaS; API on Vercel; `api.` subdomain on the same registrable domain; self-host.

**Why:**

- Next on Vercel fits App Router/SSR; the .NET API needs a long-lived process and Docker—Render Blueprint (`render.yaml`) covers that.
- Neon pooled + `sslmode=require` for serverless-friendly connections.
- The origin split forces conscious cookie/CORS decisions (documented in [deploy-beta.md](./deploy-beta.md)) instead of hiding them until the first “login vanishes on refresh” bug.

---

## Quick map: evidence → decision

```text
pnpm + shared/types/config      →  single contract and Wilson (D1)
modular Controllers monolith    →  one process, clear boundaries (D2)
Prisma migrate + EF map         →  rich schema + .NET runtime (D3)
API_INTERNAL_URL + refresh      →  SSR + XSS-resistant auth (D4)
Wilson → confidenceScore        →  ranking respects evidence (D5)
optional Redis                  →  one-node beta without hard dep (D6)
IGDB thin → preview → 1st review → demand-driven catalogue (D7)
rebuildable GameStatistics      →  reviews are SoT (D8)
rotation / bomb / reputation    →  abuse without blind auto-delete (D9)
Vercel + Render + Neon + /api   →  first-party cookies in production (D10)
```

---

## Related reading

- [database.md](./database.md) — constraints and derived data
- [scoring.md](./scoring.md) — formula, labels, bombs, reputation
- [api.md](./api.md) — HTTP surface
- [development.md](./development.md) — environment and checklist
- [deploy-beta.md](./deploy-beta.md) — production topology and cookies
