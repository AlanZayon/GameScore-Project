-- AlterTable
ALTER TABLE "games" ADD COLUMN "trailerYoutubeId" VARCHAR(32);
ALTER TABLE "games" ADD COLUMN "galleryImageUrls" TEXT[] DEFAULT ARRAY[]::TEXT[];
