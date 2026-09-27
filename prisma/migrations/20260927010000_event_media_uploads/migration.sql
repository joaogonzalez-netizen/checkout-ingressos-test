-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "MediaKind" ADD VALUE 'video';
ALTER TYPE "MediaKind" ADD VALUE 'cover_mobile';

-- AlterTable
ALTER TABLE "event_media" ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "duration_seconds" DOUBLE PRECISION,
ADD COLUMN     "height" INTEGER,
ADD COLUMN     "mime" TEXT,
ADD COLUMN     "poster_key" TEXT,
ADD COLUMN     "size_bytes" INTEGER,
ADD COLUMN     "storage_key" TEXT,
ADD COLUMN     "width" INTEGER;

-- CreateIndex
CREATE INDEX "event_media_event_id_kind_idx" ON "event_media"("event_id", "kind");
