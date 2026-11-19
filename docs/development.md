# Desenvolvimento

**Idioma:** [Português](./development.md) · [English](./en/development.md)

## Pré-requisitos

- Node 20.11+
- [.NET 10 SDK](https://dotnet.microsoft.com/download/dotnet/10.0)
- Docker Desktop
- pnpm via Corepack:

```bash
corepack enable
corepack prepare pnpm@11.21.0 --activate
```

No Windows, reinicie o terminal depois de habilitar o Corepack para o `pnpm` entrar no `PATH`. Até lá, prefixe com `corepack` (`corepack pnpm install`, `corepack pnpm dev`, …).

## Primeira execução

```bash
cp .env.example .env
pnpm install
docker compose up -d
pnpm db:migrate
pnpm db:seed
pnpm dev
```

No dia a dia, Postgres, Redis e Mailpit rodam no Docker. A API (porta 3001, ASP.NET) e a web (porta 3000, Next.js) rodam no host. Abra http://localhost:8025 para ler e-mails de reset de senha e confirmação.

Só a API:

```bash
pnpm --filter @gamescore/api dev
# ou
dotnet run --project apps/api/src/GameScore.Api
```

## Testes

```bash
pnpm test          # web + API (dotnet test para domain/smoke da API)
pnpm test:api      # testes do GameScore.slnx
pnpm lint
pnpm typecheck
pnpm build
```

## IGDB

Crie um app em https://dev.twitch.tv/console/apps e defina `IGDB_CLIENT_ID` / `IGDB_CLIENT_SECRET` no `.env`. Deixe vazios para o restante da app funcionar; só o fallback/import IGDB ficam desligados.

### Crescimento do catálogo sob demanda

Busca e autocomplete consultam o Postgres primeiro. Quando o resultado local é fino (menos de 3 na página 1) e a IGDB está configurada, a API também devolve `externalItems`. Abrir um título vai para `/games/ext/:externalId` (só preview — nada é gravado ainda). O jogo é importado no Postgres na **primeira review publicada** via `POST /games/external/:externalId/reviews`.

Import em massa/admin ainda pode ser verificado em `/admin` (aba Import) ou:

```http
POST /admin/games/import
Authorization: Bearer <admin access token>
{ "externalId": "1942" }
```

O cliente cacheia o OAuth da Twitch e se limita a 4 requests por segundo. Imports são idempotentes em `(provider, externalId)`. Campos listados em `Game.editedFields` nunca são sobrescritos por um sync posterior.

## Contas do seed

Todas usam a senha `Password123!`:

- `admin@gamescore.dev`
- `moderator@gamescore.dev`
- `player1@gamescore.dev` …

## Hosting beta

Para um sample público sem domínio customizado (Vercel web + Render API + Neon Postgres), veja [deploy-beta.md](./deploy-beta.md). O guia cobre cookies de refresh cross-origin, CORS, secrets JWT, SMTP e o checklist de smoke.

## Checklist de aceitação

Percorra esta lista com `pnpm dev` após `pnpm db:seed`:

1. A home mostra seções de populares, top rated, lançamentos e trending com jogos do seed.
2. O catálogo filtra por plataforma e gênero e mantém os dois filtros na URL.
3. Autocomplete e `/search?q=` devolvem jogos locais (com capas); com IGDB configurada, resultados locais finos também mostram hits externos que abrem preview e só importam na primeira review.
4. A página `/games/<slug>` é SSR, tem canonical + hreflang, OpenGraph, painel de nota, breakdown por plataforma e reviews.
5. URLs em português não têm prefixo de locale (`/games/elden-ring`); inglês é `/en/games/elden-ring`.
6. Registro, login, refresh (reload ainda autenticado) e logout funcionam. Access token não está no localStorage. Registro exige aceitar termos; e-mail de confirmação aparece no Mailpit.
7. Usuário autenticado com **e-mail verificado** cria, edita e soft-deleta review; não pode avaliar o mesmo jogo duas vezes. Contas não verificadas recebem `EMAIL_NOT_VERIFIED`.
8. Votos de utilidade funcionam; auto-voto é rejeitado. Denúncias podem ser enviadas.
9. Um jogo 10/10 não supera um 9500/10000 no Top Rated (Wilson `confidenceScore`, mínimo 50 reviews).
10. Abas de rankings carregam: top rated, trending, lançamentos, populares.
11. Perfil mostra reputação, analytics de avaliador (quando há reviews suficientes) e as reviews do usuário.
12. Tema escuro é o padrão; o toggle do header alterna para claro e volta.
13. Admin (`admin@gamescore.dev`) lista jogos, edita um jogo, remove/restaura review, resolve reports, confirma review bomb, suspende usuário e vê o dashboard.
14. Moderador (`moderator@gamescore.dev`) modera reviews/reports/bombs, lista e suspende usuários, mas não lista jogos nem importa da IGDB.
