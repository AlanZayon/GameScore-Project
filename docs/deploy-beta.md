# Deploy beta (Vercel + Render + Neon)

**Idioma:** [Português](./deploy-beta.md) · [English](./en/deploy-beta.md)

Setup público de amostragem sem domínio customizado obrigatório: Next.js na Vercel, API ASP.NET no Render, Postgres no Neon.

## Arquitetura

```text
Browser  →  Vercel (web)     NEXT_PUBLIC_SITE_URL
         →  Render (API)     CORS_ORIGINS = origem Vercel
         →  Neon (Postgres)  DATABASE_URL com sslmode=require
```

Cookies de refresh são `SameSite=None; Secure` em produção quando o browser fala direto com outra origem, para a origem Vercel poder chamar `POST /auth/refresh` no Render com `credentials: 'include'`. Com domínio próprio, prefira o proxy same-origin (abaixo).

## 1. Neon

1. Crie um projeto e copie a connection string.
2. Prefira a URL pooled se o Render abrir muitas conexões.
3. Garanta `sslmode=require` na URL (a API também força SSL para hosts `*.neon.tech`).
4. Rode migrations no Neon a partir de uma máquina confiável:

```bash
DATABASE_URL='postgresql://...@...neon.tech/neondb?sslmode=require' pnpm db:migrate
```

**Nunca** rode `pnpm db:seed` contra produção/beta.

## Setup guiado

Na raiz do repo (Git Bash / WSL):

```bash
bash scripts/setup-beta-wizard.sh
```

JWTs são pré-gerados em `.env.beta.local` (gitignored). O wizard percorre Neon → Resend SMTP → Render → Vercel e grava o restante.

## 2. Render (API)

Prefira o Blueprint do repo [`render.yaml`](../render.yaml) (New → Blueprint), ou crie um Web Service (Docker, dockerfile `infrastructure/docker/api.Dockerfile`, context `.`).

| Variável | Valor |
|----------|--------|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | URL do Neon |
| `JWT_SECRET` | `openssl rand -base64 48` |
| `JWT_REFRESH_SECRET` | outro `openssl rand -base64 48` |
| `CORS_ORIGINS` | origem Vercel exata, ex. `https://gamescore-xxx.vercel.app` (sem barra no final) |
| `NEXT_PUBLIC_SITE_URL` | mesma origem Vercel (usada em links de e-mail) |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_FROM` | obrigatórios em produção |
| `SMTP_USER` / `SMTP_PASS` / `SMTP_SECURE` | Resend: `SMTP_HOST=smtp.resend.com` e `SMTP_PASS` = API key (`re_…`). A API usa a API **HTTPS** do Resend automaticamente (o plano free do Render bloqueia SMTP outbound em 25/465/587). Após verificar domínio, use `SMTP_FROM` como `GameScore <noreply@seu-dominio>`. |
| `ENABLE_SWAGGER` | `false` |
| `LOG_LEVEL` | `info` |
| `REDIS_URL` | recomendado (Render Redis / Upstash) |
| `IGDB_CLIENT_ID` / `IGDB_CLIENT_SECRET` | opcional |

Health check: `/health`.

Secrets que contenham `dev-only-` ou `change-me` são rejeitados no startup.

## 3. Vercel (web)

Importe a **raiz do repo** (não `apps/web`). [`vercel.json`](../vercel.json) roda o build do workspace pnpm para `@gamescore/web`.

### Cookies de sessão (obrigatório com domínio customizado)

Browsers tratam `gamesscore.com.br` → `*.onrender.com` como cookies **third-party**, então o login funciona até o refresh e a sessão some. A web faz proxy da API pelo same-origin `/api/*` (route handler do Next) e reescreve o cookie de refresh para `SameSite=Lax`:

| Variável | Valor |
|----------|--------|
| `NEXT_PUBLIC_SITE_URL` | `https://www.gamesscore.com.br` |
| `NEXT_PUBLIC_API_URL` | preferir `/api`; se ainda apontar para `*.onrender.com`, o build redireciona o browser para `/api` automaticamente |
| `API_INTERNAL_URL` | `https://gamescore-project.onrender.com` (SSR + upstream do proxy `/api`) |
| `API_REWRITE_TARGET` | opcional; default `API_INTERNAL_URL` ou a URL pública antiga onrender |

No Render, defina:

| Variável | Valor |
|----------|--------|
| `CORS_ORIGINS` | `https://www.gamesscore.com.br,https://gamesscore.com.br` |
| `NEXT_PUBLIC_SITE_URL` | `https://www.gamesscore.com.br` |
| `COOKIE_SAMESITE` | `Lax` (first-party via proxy `/api`) |

Rebuild depois de mudar `NEXT_PUBLIC_*` — CSP `connect-src` e o bundle do client embutem esses valores no build.

Ovo e galinha: deploy da API primeiro (CORS temporário), deploy Vercel, depois ajuste `CORS_ORIGINS` + `NEXT_PUBLIC_SITE_URL` no Render e redeploy dos dois.

Preview deployments: cada URL `*.vercel.app` precisa aparecer em `CORS_ORIGINS` do Render, ou fixe um hostname estável de production/preview.

## 4. Checklist de smoke

- [ ] Registrar → e-mail de verificação chega → confirmar → escrever review
- [ ] Conta não verificada recebe `EMAIL_NOT_VERIFIED` em review/voto
- [ ] Refresh após reload ainda funciona (cookie same-origin `/api`)
- [ ] Login / forgot-password rate-limit após hits repetidos (429)
- [ ] Swagger não público (`/api/docs`)
- [ ] Admin lista users: moderadores veem e-mails mascarados; admins veem completo

## 5. Redis opcional

Sem Redis a API usa cache in-memory, Hangfire memory storage e contadores de rate-limit em memória. Ok para uma única instância no Render; adicione Redis antes de escalar réplicas.
