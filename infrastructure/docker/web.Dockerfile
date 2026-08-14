# GameScore web image.
FROM node:24-bookworm-slim AS builder

ARG NEXT_PUBLIC_API_URL=http://localhost:3001
ARG NEXT_PUBLIC_SITE_URL=http://localhost:3000

ENV PNPM_HOME="/pnpm" \
    PATH="/pnpm:$PATH" \
    CI=true \
    NEXT_TELEMETRY_DISABLED=1 \
    NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL} \
    NEXT_PUBLIC_SITE_URL=${NEXT_PUBLIC_SITE_URL}

RUN corepack enable

WORKDIR /app

COPY . .

RUN pnpm install --frozen-lockfile
RUN pnpm --filter "@gamescore/shared" --filter "@gamescore/types" build
RUN pnpm --filter "@gamescore/web" build

WORKDIR /app/apps/web

ENV NODE_ENV=production
EXPOSE 3000

CMD ["pnpm", "start"]
