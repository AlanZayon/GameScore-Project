# GameScore API image.
#
# Debian slim rather than Alpine: both the Prisma query engine and the Argon2
# native binding have first-class glibc builds, which removes a whole class of
# "works on my machine" problems.
FROM node:24-bookworm-slim AS builder

ENV PNPM_HOME="/pnpm" \
    PATH="/pnpm:$PATH" \
    CI=true

RUN corepack enable \
    && apt-get update \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY . .

RUN pnpm install --frozen-lockfile
RUN pnpm --filter "@gamescore/shared" --filter "@gamescore/types" build
RUN pnpm --filter "@gamescore/api" prisma:generate
RUN pnpm --filter "@gamescore/api" build

WORKDIR /app/apps/api

ENV NODE_ENV=production
EXPOSE 3001

# Migrations are applied on start-up so a fresh volume yields a working schema.
CMD ["sh", "-c", "./node_modules/.bin/prisma migrate deploy && node dist/main.js"]
