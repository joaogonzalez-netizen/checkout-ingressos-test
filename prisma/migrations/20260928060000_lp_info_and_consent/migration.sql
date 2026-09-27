-- AlterTable
ALTER TABLE "events" ADD COLUMN     "access_rules" TEXT,
ADD COLUMN     "age_rating" TEXT,
ADD COLUMN     "age_rating_note" TEXT,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "ends_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "marketing_opt_in" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "ticket_lots" ADD COLUMN     "description" TEXT;

-- CreateTable
CREATE TABLE "platform_settings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "seller_name" TEXT,
    "seller_cnpj" TEXT,
    "seller_address" TEXT,
    "contact_email" TEXT,
    "contact_whatsapp" TEXT,
    "half_price_text" TEXT,
    "cancellation_text" TEXT,
    "fee_text" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_settings_pkey" PRIMARY KEY ("id")
);
