# API

**Idioma:** [Português](./api.md) · [English](./en/api.md)

URL base em desenvolvimento: `http://localhost:3001`

OpenAPI / Swagger UI: `http://localhost:3001/api/docs`

Todo erro é `{ code, message }` mais um mapa opcional `details` e `requestId`. Clientes fazem switch em `code` e localizam a mensagem por conta própria.

## Auth

| Método | Path | Notas |
| ------ | ---- | ----- |
| POST | `/auth/register` | Define cookie httpOnly de refresh |
| POST | `/auth/login` | E-mail ou username |
| POST | `/auth/refresh` | Rotaciona o cookie de refresh |
| POST | `/auth/logout` | Revoga o refresh atual |
| GET | `/auth/me` | Bearer access token |
| POST | `/auth/password` | Troca de senha autenticado |
| POST | `/auth/forgot-password` | Sempre 204; nunca revela se o e-mail existe |
| POST | `/auth/reset-password` | Consome token de uma hora |
| POST | `/auth/verify-email` | Consome token de confirmação de 24 horas |
| POST | `/auth/resend-verification` | Sempre 204; nunca revela se o e-mail existe |

Reusar um refresh já rotacionado revoga **todas** as sessões da conta.

## Catálogo

`GET /games`, `GET /games/:slug`, `GET /games/:slug/statistics`, `GET /platforms`, `GET /genres`, `GET /search`, `GET /search/autocomplete`, `GET /search/external/:externalId`, `POST /games/external/:externalId/reviews`, `POST /search/import`

## Reviews

`GET|POST /games/:slug/reviews`, `GET|PATCH|DELETE /reviews/:id`, `POST|DELETE /reviews/:id/vote`, `POST /reviews/:id/report`

## Rankings

`GET /home`, `GET /rankings/top-rated`, `GET /rankings/trending`, `GET /rankings/new-releases`, `GET /rankings/popular`

Top rated ordena por `confidenceScore` e exige `RANKING_MINIMUM_REVIEWS`.

## Users

`GET /users/:username`, `GET /users/:username/reviews`, `GET /users/:username/statistics?range=3m|12m|all`, `GET /users/:username/reputation-events`, `PATCH /users/me`, `GET /users/me/export`, `DELETE /users/me`

`GET /users/:username/statistics` devolve analytics de perfil em cache (breakdown de recomendações, buckets de gênero/plataforma, timeline, horas, resumo de reputação, reviews mais úteis). Gráficos ficam indisponíveis com menos de 3 reviews publicadas.

`GET /users/:username/reputation-events` é um ledger paginado por cursor. Motivos sensíveis de moderação são omitidos para anônimos/players e incluídos para moderadores/admins.

## Admin

Moderadores podem moderar reviews, reports e eventos de review bomb. Admins também editam jogos, importam da IGDB e alteram papéis. Toda ação grava uma linha em `AuditLog`.

## Health

`GET /health` retorna `{ status, checks.database, features }`.
