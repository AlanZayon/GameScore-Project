-- CreateEnum
CREATE TYPE "GameRelationKind" AS ENUM ('DLC', 'EXPANSION', 'BUNDLE', 'SIMILAR');

-- CreateTable
CREATE TABLE "game_relations" (
    "id" UUID NOT NULL,
    "gameId" UUID NOT NULL,
    "kind" "GameRelationKind" NOT NULL,
    "provider" "ExternalProvider" NOT NULL,
    "externalId" VARCHAR(100) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "coverImageUrl" VARCHAR(1000),
    "releaseDate" DATE,
    "relatedGameId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "game_relations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "game_relations_gameId_kind_idx" ON "game_relations"("gameId", "kind");

-- CreateIndex
CREATE INDEX "game_relations_relatedGameId_idx" ON "game_relations"("relatedGameId");

-- CreateIndex
CREATE UNIQUE INDEX "game_relations_gameId_provider_externalId_kind_key" ON "game_relations"("gameId", "provider", "externalId", "kind");

-- AddForeignKey
ALTER TABLE "game_relations" ADD CONSTRAINT "game_relations_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_relations" ADD CONSTRAINT "game_relations_relatedGameId_fkey" FOREIGN KEY ("relatedGameId") REFERENCES "games"("id") ON DELETE SET NULL ON UPDATE CASCADE;
