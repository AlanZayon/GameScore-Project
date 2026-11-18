# Beta deploy (Vercel + Render + Neon)

Public sampling setup without a custom domain: Next.js on Vercel, ASP.NET API on Render, Postgres on Neon.

## Architecture

```text
Browser  →  Vercel (web)     NEXT_PUBLIC_SITE_URL
         →  Render (API)     CORS_ORIGINS = Vercel origin
         →  Neon (Postgres)  DATABASE_URL with sslmode=require
```

Refresh cookies are `SameSite=None; Secure` in production so the Vercel origin can call `POST /auth/refresh` on Render with `credentials: 'include'`.

## 1. Neon

1. Create a project and copy the connection string.
2. Prefer the pooled URL if Render opens many connections.
3. Ensure the URL includes `sslmode=require` (the API also forces SSL for `*.neon.tech` hosts).
4. Run migrations against Neon from a trusted machine:

```bash
DATABASE_URL='postgresql://...@...neon.tech/neondb?sslmode=require' pnpm db:migrate
```

**Never** run `pnpm db:seed` against production/beta.

## Guided setup

From the repo root (Git Bash / WSL):

```bash
bash scripts/setup-beta-wizard.sh
```

JWTs are pre-generated in `.env.beta.local` (gitignored). The wizard walks Neon → Resend SMTP → Render → Vercel and writes the remaining values.

## 2. Render (API)

Prefer the repo Blueprint [`render.yaml`](../render.yaml) (New → Blueprint), or create a Web Service (Docker, dockerfile `infrastructure/docker/api.Dockerfile`, context `.`).

| Variable | Value |
|----------|--------|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | Neon URL |
| `JWT_SECRET` | `openssl rand -base64 48` |
| `JWT_REFRESH_SECRET` | different `openssl rand -base64 48` |
| `CORS_ORIGINS` | exact Vercel origin, e.g. `https://gamescore-xxx.vercel.app` (no trailing slash) |
| `NEXT_PUBLIC_SITE_URL` | same Vercel origin (used in email links) |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_FROM` | required in production |
| `SMTP_USER` / `SMTP_PASS` / `SMTP_SECURE` | Resend: set `SMTP_HOST=smtp.resend.com` and `SMTP_PASS` = API key (`re_…`). The API uses Resend’s **HTTPS** API automatically (Render free blocks outbound SMTP on 25/465/587). After domain verify, set `SMTP_FROM` to `GameScore <noreply@your-domain>`. |
| `ENABLE_SWAGGER` | `false` |
| `LOG_LEVEL` | `info` |
| `REDIS_URL` | recommended (Render Redis / Upstash) |
| `IGDB_CLIENT_ID` / `IGDB_CLIENT_SECRET` | optional |

Health check path: `/health`.

Secrets that contain `dev-only-` or `change-me` are rejected at startup.

## 3. Vercel (web)

Import the **repo root** (not `apps/web`). [`vercel.json`](../vercel.json) runs the pnpm workspace build for `@gamescore/web`.

| Variable | Value |
|----------|--------|
| `NEXT_PUBLIC_API_URL` | `https://your-api.onrender.com` |
| `NEXT_PUBLIC_SITE_URL` | `https://your-app.vercel.app` |
| `API_INTERNAL_URL` | same as API URL (SSR fetch) |

Rebuild after changing `NEXT_PUBLIC_*` — CSP `connect-src` and the client bundle bake them in at build time.

Chicken-and-egg: deploy API first (temporary CORS), deploy Vercel, then set `CORS_ORIGINS` + `NEXT_PUBLIC_SITE_URL` on Render and redeploy both.

Preview deployments: each `*.vercel.app` URL must appear in Render `CORS_ORIGINS`, or pin a stable production/preview hostname.

## 4. Smoke checklist

- [ ] Register → verification email arrives → confirm → write a review
- [ ] Unverified account gets `EMAIL_NOT_VERIFIED` on review/vote
- [ ] Refresh after reload still works (cookie cross-site)
- [ ] Login / forgot-password rate-limit after repeated hits (429)
- [ ] Swagger not public (`/api/docs`)
- [ ] Admin list users: moderators see masked emails; admins see full

## 5. Optional Redis

Without Redis the API uses in-memory cache, Hangfire memory storage, and in-memory rate-limit counters. Fine for a single Render instance; add Redis before scaling replicas.
