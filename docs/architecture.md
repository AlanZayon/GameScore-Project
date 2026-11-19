# Arquitetura

**Idioma:** [Português](./architecture.md) · [English](./en/architecture.md)

GameScore é um **monorepo pnpm + .NET** com dois apps deployáveis e pacotes TypeScript compartilhados para contrato HTTP e regras de scoring.

```text
apps/api          ASP.NET Core 10 — monólito modular (EF Core + Hangfire)
apps/web          Next.js 16 App Router
packages/shared   Matemática Wilson, labels, enums (web + fonte dos golden tests C#)
packages/types    Contrato HTTP (TypeScript)
packages/config   Presets ESLint / TypeScript
```

Este documento descreve **como** o sistema se organiza e, principalmente, **por que** cada escolha foi tomada. As decisões abaixo refletem o contexto do projeto: demonstração/portfólio full-stack com produto real (scoring honesto, anti-abuso, deploy beta), não um sistema multi-região em escala.

---

## Fluxo de request

```text
Browser ──► Next.js (SSR do catálogo + UI autenticada)
              │
              ▼
         ASP.NET Core API (REST)
              │
     ┌────────┼────────┐
     ▼        ▼        ▼
 PostgreSQL  Redis*  Hangfire
              (*opcional)
```

- Páginas públicas do catálogo são **SSR**: o Next.js chama a API com `API_INTERNAL_URL` (hostname interno em Docker/produção, distinto do URL visto pelo browser).
- Mutações autenticadas rodam no browser com **access token em memória**; o refresh fica em cookie httpOnly `gs_refresh_token`.
- Cada feature da API segue a mesma pilha:

  `Controller → Application/Infrastructure → Domain → EF Core / SQL`

- Controllers permanecem finos; o `DbContext` não é injetado diretamente onde a feature deveria ficar orquestrada.
- Estatísticas derivadas (`GameStatistics`, atividade diária, snapshots) são **reconstruíveis** a partir das reviews.

Em beta com domínio customizado, o browser costuma falar com a API via proxy same-origin `/api/*` (ver [deploy-beta.md](./deploy-beta.md)), para o cookie de refresh ser first-party.

---

## Módulos da API

| Módulo | Responsabilidade |
| ------ | ---------------- |
| `auth` | Registro, login, rotação de refresh, logout, JWT, papéis, reset de senha, verificação de e-mail |
| `users` | Perfis públicos, settings, exportação de dados, exclusão de conta |
| `games` | Catálogo, slug, plataformas, gêneros, contagem de views |
| `search` | FTS + trigram locais; fallback IGDB quando o resultado local é fino; preview; import na 1ª review |
| `reviews` | Criar/editar/soft-delete, votos, denúncias, anti-spam, detector de review bomb |
| `ratings` | Recálculo de score, reputação, ranking de reviews, snapshots |
| `rankings` | Top rated, trending, lançamentos, populares, feed da home |
| `admin` | Moderação, audit log, import IGDB |
| `integrations` | Cliente IGDB, import/sync, validação de URL de imagem |

Fronteiras existem para legibilidade e DI por feature — não há rede entre módulos. Um único processo ASP.NET e um Postgres bastam para o escopo atual.

---

## Jobs em background

Trabalho assíncrono usa **Hangfire** (storage Redis quando `REDIS_URL` está definido; senão memória).

| Trabalho | Quando | Por quê nessa fronteira |
| -------- | ------ | ----------------------- |
| Recálculo de score do jogo | **Na mesma request** da review (transacional) | A nota pública e o ranking precisam refletir a review commitada imediatamente |
| Detecção de review bomb | Fila | Pode ser mais pesada; não deve atrasar a resposta HTTP |
| Contagem de views | Fila | Alto volume, baixa criticidade |
| Invalidação de cache de rankings | Fila | Após mudanças que afetam home/rankings |
| Snapshots de score | Cron `15 3 * * *` | Histórico diário, fora do caminho quente |
| Manutenção (refresh expirados) | Cron `0 4 * * *` | Limpeza |

Jobs enfileirados **não** falham um HTTP já commitado se Hangfire/Redis estiver indisponível (`TryEnqueue`).

---

## Cache

Redis é **opcional**. Rankings e home usam TTL curto. Se Redis estiver ausente ou falhar, `CacheService` cai para armazenamento in-memory. Preferimos drift temporário de cache a derrubar a request.

---

## Banco de dados

Schema e migrations ficam em `apps/api/prisma` (**Prisma migrate**). A app ASP.NET mapeia as tabelas existentes com **EF Core** e **não** gera migrations concorrentes. Detalhes de constraints e dados derivados: [database.md](./database.md).

---

## Decisões de arquitetura

Cada bloco abaixo registra a decisão, o contexto, alternativas consideradas e a razão que prevaleceu.

### D1 — Monorepo pnpm + .NET (em vez de repositórios separados)

**Decisão:** Um repositório com `apps/api`, `apps/web` e `packages/{shared,types,config}`.

**Contexto:** A regra de produto (“a nota respeita a evidência”) precisa ser a **mesma** na UI, no seed e no domínio C#. O contrato HTTP também não pode divergir entre clientes.

**Alternativas:** Repos separados por app; monorepo só Node; gerar tipos só a partir do OpenAPI em CI sem pacote `types`.

**Por quê:**

- `@gamescore/shared` concentra Wilson, labels e enums; golden tests C# espelham essa fonte.
- `@gamescore/types` é o contrato HTTP tipado API ↔ web.
- `@gamescore/config` unifica presets TS/ESLint.
- Scripts na raiz (`pnpm dev`, `pnpm db:*`, `pnpm test`) orquestram os dois runtimes sem sincronizar releases entre repos.

**Trade-off aceito:** Dois toolchains (Node + .NET) no mesmo clone; o custo é menor que drift de regras de scoring.

---

### D2 — Monólito modular ASP.NET (em vez de microserviços)

**Decisão:** Uma API deployável com módulos por feature e camadas `Controller → Infrastructure/Application → Domain → EF/SQL`.

**Contexto:** Portfolio/demo com um Postgres, um Hangfire e um deploy no Render. Features (review → score → reputação → anti-spam) compartilham a mesma transação.

**Alternativas:** Microserviços por domínio; monolito Nest/Node; CQRS/event bus distribuído.

**Por quê:**

- Fronteiras de pasta + DI bastam para clareza sem custo de rede, versionamento de contratos internos ou orquestração.
- Recálculo de score na mesma request exige consistência transacional trivial num único `DbContext`.
- Um único artefato Docker simplifica o beta.

**Quando revisitar:** Múltiplas equipes, scaling independente de escrita de reviews vs leitura de rankings, ou necessidade de isolar falhas por domínio.

---

### D3 — Prisma owns schema; EF Core no runtime

**Decisão:** Prisma 6 declara schema e aplica migrations; ASP.NET mapeia tabelas snake_case com EF Core **sem** gerar migrations próprias.

**Contexto:** O schema precisa de FTS (`tsvector`), `pg_trgm`, unique parcial (`reviews` ativas) e checks que o Prisma não modela sozinho — expressos em SQL na migration. Seed e Prisma Studio são fluxos Node já estabelecidos no monorepo.

**Alternativas:** Só EF migrations; só Prisma Client em Node (API em TypeScript); Flyway/Liquibase à parte.

**Por quê:**

- Uma fonte de verdade de schema (`apps/api/prisma`) evita dois geradores brigando pelo banco.
- Runtime .NET ganha tipagem, tracking e transações nativas com EF.
- Integridade crítica permanece no Postgres (FKs, uniques, checks), não só no código da app.

**Trade-off aceito:** Duas camadas de mapeamento (Prisma schema + Fluent API EF); o benefício é migrations ricas + runtime .NET sem reescrever o seed.

---

### D4 — SSR do catálogo + access em memória + refresh httpOnly

**Decisão:** Catálogo público SSR via `API_INTERNAL_URL`; browser autentica com JWT de acesso **em memória** e refresh em cookie httpOnly `gs_refresh_token`, com **rotação** e detecção de reuso.

**Contexto:** SEO e first paint do catálogo importam (páginas de jogo são superfície SEO). XSS não deve ler o refresh. Em produção, Vercel e Render são origens diferentes.

**Alternativas:** SPA 100% client-side; refresh em `localStorage`; sessão só server-side; BFF completo para tudo.

**Por quê:**

- SSR usa hostname interno (rede Docker/PaaS) sem expor tokens longos ao JS.
- Access curto em memória reduz janela de roubo via XSS.
- Refresh httpOnly + rotação: reusar um refresh já rotacionado revoga **todas** as sessões da conta (sinal clássico de token roubado).
- Tokens no banco só como hash SHA-256.
- Com domínio próprio, o proxy `/api/*` no Next torna o cookie first-party (`SameSite=Lax`); sem isso, cross-site `SameSite=None; Secure` é necessário e mais frágil em browsers.

**Cuidado de implementação:** refresh paralelo (ex.: React Strict Mode) não pode disparar duas rotações — o AuthProvider serializa o refresh.

---

### D5 — Nota pública = % positivo; ranking = Wilson lower bound

**Decisão:** O número exibido é `positivas / total`. Ordenação (Top Rated, confiança) usa o **limite inferior de Wilson** a 95% (`confidenceScore` 0–100). Top Rated exige mínimo de reviews (`RANKING_MINIMUM_REVIEWS`, padrão 50). Poucas avaliações (&lt; 10) → label `FEW_REVIEWS`.

**Contexto:** Médias aritméticas e % bruto recompensam amostras pequenas. A tese do produto é evidência, não “nota de crítico”.

**Alternativas:** Média 0–10; prior bayesiano fixo; só % bruto; Elo entre jogos.

**Por quê:**

- Wilson responde: “qual a menor taxa positiva ainda plausível dado o tamanho da amostra?” — amostras pequenas são puxadas para baixo sem fator arbitrário.
- Separar **exibição** (% + labels) de **ordenação** (`confidenceScore`) evita mentir na UI e ainda ranquear com honestidade.
- Paridade TS (`@gamescore/shared`) ↔ C# (`GameScore.Domain`) via golden tests — a regra única não pode divergir entre camadas.

Detalhe matemático e labels: [scoring.md](./scoring.md).

---

### D6 — Redis opcional (cache, Hangfire, rate limit)

**Decisão:** Sem `REDIS_URL` (ou se a conexão falhar): cache e rate limit in-memory; Hangfire `MemoryStorage`. Com Redis: Hangfire + cache Redis, ainda com fallback memory no cache.

**Contexto:** Beta single-instance no Render free precisa subir sem dependência dura. Redis é recomendado antes de réplicas.

**Alternativas:** Redis obrigatório; só memória; fila gerenciada (Service Bus, SQS); Quartz sem Hangfire.

**Por quê:**

- Dev local e beta de um nó funcionam com `docker compose` mínimo (Postgres + Mailpit).
- Drift de cache é preferível a 500 na request do jogador.
- Managed Redis às vezes restringe `KEYS`/`SCAN` — o código evita assumir comandos frágeis.

---

### D7 — Catálogo IGDB sob demanda (preview → import na 1ª review)

**Decisão:** Busca/autocomplete consultam Postgres primeiro. Se o resultado local for “fino” (&lt; 3 na página 1) e a IGDB estiver configurada, a API devolve também `externalItems`. Abrir `/games/ext/:id` é **preview sem escrita**. O jogo entra no banco na **primeira review publicada** (`POST /games/external/:externalId/reviews`). Admin ainda pode importar sob demanda.

**Contexto:** Mirror completo da IGDB é caro, lento e desnecessário para um catálogo que cresce com uso real. Rate limit IGDB (~4 rps) e idempotência `(provider, externalId)` importam.

**Alternativas:** Mirror completo; import ao abrir o preview; só jogos do seed.

**Por quê:**

- Persistência acoplada a **intenção real** (escrever review), não a curiosidade de preview.
- App permanece útil sem credenciais IGDB.
- `Game.editedFields` impede que sync posterior sobrescreva edição humana.

---

### D8 — Reviews como fonte da verdade; stats derivadas rebuildable

**Decisão:** `GameStatistics`, `GameStatisticsPlatform`, `GameActivityDaily` e `GameScoreSnapshot` são caches derivados. Reviews `PUBLISHED` e não deletadas são a fonte da verdade. Soft-delete preserva auditoria.

**Contexto:** Rankings e páginas de jogo precisam de leitura rápida; moderação e bombs precisam poder **reconstruir** números corretos.

**Alternativas:** Agregar só on-read; event sourcing completo; materializar apenas via job noturno.

**Por quê:**

- Recálculo transacional na publicação/edição/remoção mantém consistência imediata.
- Rebuild completo permanece possível se stats corromperem ou regras mudarem.
- Janelas de bomb **confirmadas** entram no recálculo alternativo sem apagar reviews automaticamente.

Princípios também estão no header de `apps/api/prisma/schema.prisma`.

---

### D9 — Anti-abuso com humano no loop (não auto-delete cego)

**Decisão:**

1. **Refresh:** rotação + reuso → revoga todas as sessões; hash no banco.
2. **Review bomb:** pico diário vs mediana de 30 dias do próprio jogo → evento para moderador; stats alternativas podem excluir janelas `CONFIRMED`.
3. **Reputação:** ledger `ReputationEvent` (0–5000) alimenta ranking de reviews e tiers públicos; razões sensíveis só para moderação.
4. **Anti-spam:** sinais (tamanho, padrões, rate, IP) → status de moderação **independente** de visibilidade.

**Contexto:** Review bombs e spam são reais em plataformas de nota; apagar automaticamente gera falsos positivos e destrói evidência.

**Alternativas:** Sem rotação de refresh; delete automático de reviews suspeitas; score de reputação sem ledger.

**Por quê:** Detecção sem punição automática alinha com “instrumento de descoberta” — evidência preservada, abuso tratado com auditoria. Uma review ativa por jogador por jogo (unique parcial) reduz multi-conta trivial no mesmo título.

---

### D10 — Deploy beta: Vercel (web) + Render (API) + Neon (Postgres)

**Decisão:** Separar SSR/frontend (Vercel) do runtime .NET + Hangfire + Docker (Render) e do Postgres gerenciado (Neon). Cookies e CORS tratados explicitamente; SMTP via Resend HTTPS no plano free do Render (SMTP outbound bloqueado).

**Contexto:** Sem domínio customizado no início; depois domínio próprio com proxy `/api` para cookie first-party.

**Alternativas:** Tudo num único PaaS; API na Vercel; subdomínio `api.` no mesmo registrable domain; self-host.

**Por quê:**

- Next na Vercel encaixa no App Router/SSR; API .NET precisa de processo longo e Docker — Render Blueprint (`render.yaml`) cobre isso.
- Neon pooled + `sslmode=require` para serverless-friendly connections.
- O split de origem força decisões conscientes de cookie/CORS (documentadas em [deploy-beta.md](./deploy-beta.md)), em vez de escondê-las até o primeiro bug de “login some no refresh”.

---

## Mapa rápido: evidência → decisão

```text
pnpm + shared/types/config     →  contrato e Wilson únicos (D1)
monólito modular Controllers   →  um processo, fronteiras claras (D2)
Prisma migrate + EF map        →  schema rico + runtime .NET (D3)
API_INTERNAL_URL + refresh     →  SSR + auth XSS-resistente (D4)
Wilson → confidenceScore       →  ranking respeita evidência (D5)
Redis opcional                 →  beta 1 nó sem dependência dura (D6)
IGDB thin → preview → 1ª review → catálogo sob demanda (D7)
GameStatistics rebuildable     →  reviews são SoT (D8)
rotação / bomb / reputação     →  abuso sem auto-delete cego (D9)
Vercel + Render + Neon + /api  →  cookies first-party em produção (D10)
```

---

## Leitura relacionada

- [database.md](./database.md) — constraints e derivados
- [scoring.md](./scoring.md) — fórmula, labels, bombs, reputação
- [api.md](./api.md) — superfície HTTP
- [development.md](./development.md) — ambiente e checklist
- [deploy-beta.md](./deploy-beta.md) — topologia e cookies em produção
