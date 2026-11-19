# Banco de dados

**Idioma:** [Português](./database.md) · [English](./en/database.md)

PostgreSQL 18 é a fonte da verdade. O Prisma 6.19.3 ownership do schema; algumas constraints que o Prisma não consegue declarar ficam na migration inicial como SQL bruto.

Princípios (também no header de `apps/api/prisma/schema.prisma`):

- **Reviews** são a única fonte da verdade. Tudo em `GameStatistics`, `GameActivityDaily` e `GameScoreSnapshot` é derivado e rebuildable.
- **Integridade** é enforced pelo banco (FKs, uniques, checks), não só pelo código da aplicação.
- Reviews usam **soft-delete** para decisões de moderação permanecerem auditáveis.

## Integridade que o Prisma não declara

- Índice unique parcial `reviews (userId, gameId) WHERE deletedAt IS NULL` — uma review ativa por jogador por jogo.
- `games.searchVector` tsvector gerado (name, slug, developer, publisher, summary) com índice GIN.
- Índices GIN `pg_trgm` em name, developer e publisher (lowercased).
- Check constraints em faixa de rating, contagens de votos, caps de reputação e janelas de review bomb.

## Dados derivados

`GameStatistics`, `GameStatisticsPlatform`, `GameActivityDaily` e `GameScoreSnapshot` são totalmente rebuildable a partir de `reviews`. Reviews continuam sendo a fonte da verdade.

`Game.editedFields` registra quais colunas um humano alterou, para o sync IGDB nunca sobrescrever dados editoriais.

Refresh tokens são armazenados apenas como hashes SHA-256.

## Banco de teste

Suítes de integração e e2e usam `TEST_DATABASE_URL` (`gamescore_test`). O global setup do Jest cria o banco se necessário e roda `prisma migrate deploy`.
