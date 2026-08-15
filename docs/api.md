# API

Base URL in development: `http://localhost:3001`

OpenAPI / Swagger UI: `http://localhost:3001/api/docs`

Every error is `{ code, message }` plus an optional `details` map and `requestId`. Clients switch on `code` and localise it themselves.

## Auth

| Method | Path | Notes |
| --- | --- | --- |
| POST | `/auth/register` | Sets httpOnly refresh cookie |
| POST | `/auth/login` | Email or username |
| POST | `/auth/refresh` | Rotates the refresh cookie |
| POST | `/auth/logout` | Revokes the current refresh token |
| GET | `/auth/me` | Bearer access token |

Replaying a rotated refresh token revokes **every** session for that account.

## Catalogue

`GET /games`, `GET /games/:slug`, `GET /games/:slug/statistics`, `GET /platforms`, `GET /genres`, `GET /search`, `GET /search/autocomplete`, `GET /search/external/:externalId`, `POST /games/external/:externalId/reviews`, `POST /search/import`


## Reviews

`GET|POST /games/:slug/reviews`, `GET|PATCH|DELETE /reviews/:id`, `POST|DELETE /reviews/:id/vote`, `POST /reviews/:id/report`

## Rankings

`GET /home`, `GET /rankings/top-rated`, `GET /rankings/trending`, `GET /rankings/new-releases`, `GET /rankings/popular`

Top rated orders by `confidenceScore` and requires `RANKING_MINIMUM_REVIEWS`.

## Users

`GET /users/:username`, `GET /users/:username/reviews`

## Admin

Moderators can moderate reviews, reports and review-bomb events. Admins can also edit games, import from IGDB, and change roles. Every action writes an `AuditLog` row.

## Health

`GET /health` returns `{ status, checks.database, features }`.
