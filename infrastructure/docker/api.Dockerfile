# GameScore API image (ASP.NET Core .NET 10).
#
# Multi-stage: SDK build + runtime. Prisma CLI applies existing SQL migrations
# on start so the shared Postgres schema stays the source of truth.

FROM mcr.microsoft.com/dotnet/sdk:10.0-bookworm-slim AS build
WORKDIR /src
COPY apps/api/GameScore.slnx ./
COPY apps/api/src ./src
COPY apps/api/tests ./tests
RUN dotnet restore GameScore.slnx \
 && dotnet publish src/GameScore.Api/GameScore.Api.csproj -c Release -o /app/publish --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:10.0-bookworm-slim AS runtime
WORKDIR /app

RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates curl \
 && curl -fsSL https://deb.nodesource.com/setup_24.x | bash - \
 && apt-get install -y --no-install-recommends nodejs \
 && rm -rf /var/lib/apt/lists/* \
 && npm install -g prisma@6.19.3

COPY --from=build /app/publish ./
COPY apps/api/prisma ./prisma

ENV ASPNETCORE_URLS=http://0.0.0.0:3001 \
    ASPNETCORE_ENVIRONMENT=Production \
    NODE_ENV=production \
    API_PORT=3001

EXPOSE 3001

CMD ["sh", "-c", "prisma migrate deploy --schema=./prisma/schema.prisma && dotnet GameScore.Api.dll"]
