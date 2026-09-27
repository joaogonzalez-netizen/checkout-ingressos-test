-- AlterTable
ALTER TABLE "artists" ADD COLUMN     "default_cover_key" TEXT,
ADD COLUMN     "default_cover_mobile_key" TEXT,
ADD COLUMN     "default_cover_mobile_url" TEXT,
ADD COLUMN     "default_cover_url" TEXT,
ADD COLUMN     "default_og_image_key" TEXT,
ADD COLUMN     "logo_key" TEXT;

-- AlterTable
ALTER TABLE "events" ADD COLUMN     "og_image_key" TEXT;
