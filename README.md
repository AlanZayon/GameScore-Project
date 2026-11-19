# GameScore

**A nota que respeita a evidência.**

GameScore é uma plataforma de descoberta e avaliação de jogos em que a nota pública nasce de **recomendações reais de jogadores** — não de médias de críticos — e em que a **quantidade de evidência** por trás da nota importa tanto quanto a proporção de opiniões positivas.

> Um jogo com 10 avaliações positivas em 10 **não** supera um jogo com 9.500 positivas em 10.000. Essa regra única molda o produto inteiro: o número público é o percentual positivo; o ranking usa o **limite inferior do intervalo de Wilson** dessa proporção.

---

## Propósito

Sites de jogos costumam tratar “nota” como média aritmética (estrelas, 0–10, Metacritic). Isso gera dois problemas:

1. **Amostras pequenas enganam** — 100% de 8 reviews parece “melhor” que 94% de milhares.
2. **Média de críticos ≠ opinião de quem joga** — o GameScore parte do ponto de vista do jogador: *recomenda ou não recomenda?*

O objetivo do projeto é ser um **instrumento de descoberta**:

- Mostrar o **% positivo** de forma clara e honesta.
- Expor o **tamanho da amostra** e rótulos como “Poucas avaliações” quando a evidência é fraca.
- Ordenar rankings pela **confiança estatística** (Wilson lower bound), não pelo percentual bruto.
- Dar aos jogadores perfil, reputação e reviews úteis — e à moderação ferramentas contra spam e review bombs.

É um monorepo full-stack de demonstração/portfólio com stack moderna, testes, deploy beta e documentação de arquitetura.

---

## Como a nota funciona (resumo)

| Conceito | Comportamento |
| -------- | ------------- |
| Nota pública | Percentual de recomendações positivas (`positivas / total`) |
| Ranking / Top Rated | Limite inferior de Wilson a 95% de confiança (`z ≈ 1.96`), normalizado 0–100 como `confidenceScore` |
| Mínimo para Top Rated | `RANKING_MINIMUM_REVIEWS` (padrão: 50) |
| Poucas avaliações | Menos de 10 reviews → rótulo `FEW_REVIEWS` (a UI não trata o % como veredicto) |
| Extremamente positivo | ≥ 95% positivo **e** ≥ 200 reviews |

Fórmula (Wilson lower bound):

```text
p = pos / n
lower = (p + z²/(2n) - z * sqrt((p(1-p) + z²/(4n)) / n)) / (1 + z²/n)
```

Detalhes, exemplos numéricos e regras de ranking de reviews: [docs/scoring.md](docs/scoring.md).

---

## O que o produto oferece

### Para jogadores

- **Catálogo e busca** — jogos, gêneros, plataformas; full-text + trigram no Postgres; fallback IGDB quando o catálogo local é fino
- **Import sob demanda** — preview de título externo (`/games/ext/:id`); o jogo entra no banco na **primeira review publicada**
- **Reviews** — recomendar ou não, texto, horas jogadas, plataforma; edição e soft-delete; votos de utilidade; denúncias
- **Rankings** — mais bem avaliados, em alta, lançamentos, populares e feed da home
- **Perfis públicos** — reviews, analytics (gêneros/plataformas/timeline), ledger de reputação com tiers (`NEWCOMER` → `ELITE`)
- **Conta** — registro, login, refresh com cookie httpOnly, verificação de e-mail, reset de senha, exportação e exclusão de conta
- **i18n e tema** — `next-intl` (pt-BR / en) e tema claro/escuro (design system Evidence)

### Para moderação e admin

- Moderação de reviews e reports
- Detecção de **review bomb** (pico diário vs mediana de 30 dias) — confirmação humana; janelas confirmadas podem ser excluídas de estatísticas alternativas
- Import IGDB, edição editorial de jogos (`editedFields` não são sobrescritos no sync)
- Alteração de papéis e **audit log** de ações sensíveis

### Anti-abuso (alto nível)

- Anti-spam em reviews longas/naturais vs padrões abusivos
- Uma review ativa por jogador por jogo
- Reputação com eventos auditáveis (votos úteis, remoções, abuso confirmado)
- Refresh token com rotação; reuso de token rotacionado revoga **todas** as sessões da conta

---

## Stack

| Camada | Tecnologia |
| ------ | ---------- |
| Frontend | Next.js 16 (App Router), React 19, TypeScript, Tailwind 4, TanStack Query, next-intl |
| Backend | ASP.NET Core 10 (monólito modular), EF Core, Hangfire |
| Banco | PostgreSQL 18 (FTS + `pg_trgm`; schema/migrations Prisma) |
| Cache | Redis (opcional — a app funciona sem ele) |
| Integrações | IGDB (Twitch), SMTP / Resend |
| Ops local | Docker Compose, pnpm workspaces + .NET 10 SDK |
| Beta | Vercel (web) + Render (API) + Neon (Postgres) |

---

## Arquitetura (visão rápida)

```text
Browser ──► Next.js (SSR catálogo + UI autenticada)
              │
              ▼
         ASP.NET Core API (REST)
              │
     ┌────────┼────────┐
     ▼        ▼        ▼
 PostgreSQL  Redis*  Hangfire
              (*opcional)
```

- Páginas públicas do catálogo são renderizadas no servidor com `API_INTERNAL_URL`.
- Mutações autenticadas usam access token em memória; refresh fica em cookie httpOnly (`gs_refresh_token`).
- Cada feature da API segue: `Controller → Application/Infrastructure → Domain → EF Core / SQL`.
- Estatísticas derivadas (`GameStatistics`, atividade diária, snapshots) são **reconstruíveis** a partir das reviews.

Módulos principais: `auth`, `users`, `games`, `search`, `reviews`, `ratings`, `rankings`, `admin`, `integrations`.

Decisões (por quê monólito, Prisma+EF, Wilson, Redis opcional, IGDB sob demanda, etc.): [docs/architecture.md](docs/architecture.md) · [EN](docs/en/architecture.md).

---

## Estrutura do repositório

```text
apps/
  api/                 ASP.NET Core 10 (GameScore.slnx) + Prisma schema/migrations
  web/                 Aplicação Next.js
packages/
  shared/              Matemática Wilson, labels, enums (web + testes dourados C#)
  types/               Contrato HTTP compartilhado (API ↔ web)
  config/              Presets TypeScript / ESLint
infrastructure/docker/ Dockerfiles
docs/                  Documentação canônica em português (+ docs/en/)
scripts/               Utilitários (ex.: wizard de beta)
```

---

## Quick start

**Requisitos:** Node 20.11+, [.NET 10 SDK](https://dotnet.microsoft.com/download/dotnet/10.0), Docker Desktop e pnpm via Corepack:

```bash
corepack enable
corepack prepare pnpm@11.21.0 --activate
```

No Windows, reinicie o terminal depois do Corepack (ou use `corepack pnpm …` até o `pnpm` estar no `PATH`).

```bash
cp .env.example .env        # Windows: Copy-Item .env.example .env
pnpm install
docker compose up -d        # PostgreSQL + Redis (+ Mailpit)
pnpm db:migrate
pnpm db:seed
pnpm dev
```

| Serviço | URL |
| ------- | --- |
| Web | http://localhost:3000 |
| API | http://localhost:3001 |
| Swagger | http://localhost:3001/api/docs |
| Mailpit (e-mails locais) | http://localhost:8025 |

O seed cria admin, moderador, jogadores, plataformas, gêneros, jogos e centenas de reviews com distribuições variadas — para o algoritmo de scoring e todas as telas terem dados reais de imediato.

**Contas de desenvolvimento** (senha `Password123!`):

- `admin@gamescore.dev`
- `moderator@gamescore.dev`
- `player1@gamescore.dev` …

Stack completa em containers (API + web):

```bash
docker compose --profile apps up --build
```

---

## Comandos

| Comando | O que faz |
| ------- | --------- |
| `pnpm dev` | Sobe API e web em watch |
| `pnpm dev:infra` | Sobe só PostgreSQL, Redis e Mailpit |
| `pnpm build` | Build de todos os pacotes/apps |
| `pnpm test` | Testes unitários + integração |
| `pnpm test:e2e` | E2E da API contra banco real |
| `pnpm lint` / `pnpm format` | ESLint / Prettier |
| `pnpm typecheck` | `tsc --noEmit` / build .NET |
| `pnpm db:migrate` | Aplica migrations (dev) |
| `pnpm db:seed` | Popula dados de desenvolvimento |
| `pnpm db:reset` | Drop + migrate + seed |
| `pnpm db:studio` | Prisma Studio |

---

## IGDB (opcional)

Crie um app em https://dev.twitch.tv/console/apps e defina `IGDB_CLIENT_ID` / `IGDB_CLIENT_SECRET` no `.env`. Sem isso, o restante da aplicação funciona; só o fallback/import IGDB fica desligado.

Busca e autocomplete consultam o Postgres primeiro. Se o resultado local for fino e a IGDB estiver configurada, a API devolve também `externalItems`. Detalhes em [docs/development.md](docs/development.md).

---

## Deploy beta

Checklist público (sem domínio customizado): Next.js na **Vercel**, API ASP.NET no **Render**, Postgres no **Neon** — ver [docs/deploy-beta.md](docs/deploy-beta.md).

Wizard guiado (Git Bash / WSL):

```bash
bash scripts/setup-beta-wizard.sh
```

**Nunca** rode `pnpm db:seed` contra beta/produção.

---

## Documentação

Índice: [docs/README.md](docs/README.md) (**português**, canônico) · [docs/en/README.md](docs/en/README.md) (English mirror).

| Documento (PT) | English | Conteúdo |
| -------------- | ------- | -------- |
| [architecture.md](docs/architecture.md) | [EN](docs/en/architecture.md) | Módulos, fluxo de request e **decisões** (D1–D10) |
| [database.md](docs/database.md) | [EN](docs/en/database.md) | Schema, constraints, índices, dados derivados |
| [scoring.md](docs/scoring.md) | [EN](docs/en/scoring.md) | Wilson, labels, ranking de reviews, reputação, bombs |
| [api.md](docs/api.md) | [EN](docs/en/api.md) | Endpoints e códigos de erro |
| [development.md](docs/development.md) | [EN](docs/en/development.md) | Env, IGDB, testes, checklist de aceitação |
| [deploy-beta.md](docs/deploy-beta.md) | [EN](docs/en/deploy-beta.md) | Vercel + Render + Neon |
| [design/DESIGN_SYSTEM.md](docs/design/DESIGN_SYSTEM.md) | [EN](docs/en/design/DESIGN_SYSTEM.md) | Design system Evidence |

---

## Licença

MIT — ver [LICENSE](LICENSE).
