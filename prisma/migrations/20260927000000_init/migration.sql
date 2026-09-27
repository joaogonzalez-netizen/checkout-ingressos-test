-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('admin', 'producer', 'supervisor', 'operator');

-- CreateEnum
CREATE TYPE "EventStatus" AS ENUM ('draft', 'published', 'closed');

-- CreateEnum
CREATE TYPE "SeatingMode" AS ENUM ('seated', 'general');

-- CreateEnum
CREATE TYPE "LotCategory" AS ENUM ('inteira', 'meia', 'solidario', 'promocional', 'cortesia');

-- CreateEnum
CREATE TYPE "SeatStatus" AS ENUM ('available', 'blocked', 'held', 'sold');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('pending', 'paid', 'failed', 'expired', 'canceled', 'refunded');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('credit_card', 'pix');

-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('valid', 'used', 'canceled');

-- CreateEnum
CREATE TYPE "ValidationMethod" AS ENUM ('qr', 'code', 'manual', 'list');

-- CreateEnum
CREATE TYPE "MediaKind" AS ENUM ('video_9x16', 'cover', 'gallery', 'og_image', 'thumbnail');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'admin',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "artists" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "logo_url" TEXT,
    "colors" JSONB NOT NULL,
    "back_link_url" TEXT,
    "meta_pixel_id" TEXT,
    "meta_capi_token" TEXT,
    "default_show_name" TEXT,
    "default_vsl_subtitle" TEXT,
    "default_og_image_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "artists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "events" (
    "id" TEXT NOT NULL,
    "artist_id" TEXT NOT NULL,
    "show_name" TEXT,
    "city" TEXT,
    "state" TEXT,
    "venue_name" TEXT,
    "venue_address" TEXT,
    "starts_at" TIMESTAMP(3),
    "doors_open_at" TIMESTAMP(3),
    "slug" TEXT,
    "status" "EventStatus" NOT NULL DEFAULT 'draft',
    "vsl_headline" TEXT,
    "vsl_subtitle" TEXT,
    "vsl_cta_label" TEXT,
    "og_image_url" TEXT,
    "seating_mode" "SeatingMode",
    "seat_rows" INTEGER,
    "seats_per_row" INTEGER,
    "meta_pixel_override" TEXT,
    "meta_capi_token_override" TEXT,
    "wizard_step" INTEGER NOT NULL DEFAULT 0,
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_media" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "kind" "MediaKind" NOT NULL,
    "url" TEXT NOT NULL,
    "poster_url" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "event_media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticket_lots" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "LotCategory" NOT NULL,
    "price_cents" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "sold" INTEGER NOT NULL DEFAULT 0,
    "reserved" INTEGER NOT NULL DEFAULT 0,
    "sales_start_at" TIMESTAMP(3),
    "sales_end_at" TIMESTAMP(3),
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ticket_lots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seats" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "row" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "status" "SeatStatus" NOT NULL DEFAULT 'available',
    "order_id" TEXT,

    CONSTRAINT "seats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" TEXT NOT NULL,
    "access_token" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "lot_id" TEXT NOT NULL,
    "seat_id" TEXT,
    "status" "OrderStatus" NOT NULL DEFAULT 'pending',
    "payment_method" "PaymentMethod" NOT NULL,
    "installments" INTEGER NOT NULL DEFAULT 1,
    "buyer_name" TEXT NOT NULL,
    "buyer_email" TEXT NOT NULL,
    "buyer_cpf_cnpj" TEXT NOT NULL,
    "ticket_cents" INTEGER NOT NULL,
    "fee_cents" INTEGER NOT NULL,
    "total_cents" INTEGER NOT NULL,
    "asaas_customer_id" TEXT,
    "asaas_payment_id" TEXT,
    "invoice_url" TEXT,
    "pix_payload" TEXT,
    "pix_qr_image" TEXT,
    "hold_expires_at" TIMESTAMP(3) NOT NULL,
    "paid_at" TIMESTAMP(3),
    "accepted_terms_at" TIMESTAMP(3) NOT NULL,
    "fbp" TEXT,
    "fbc" TEXT,
    "client_ip" TEXT,
    "user_agent" TEXT,
    "source_url" TEXT,
    "capi_purchase_sent_at" TIMESTAMP(3),
    "last_reconciled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tickets" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "lot_id" TEXT NOT NULL,
    "seat_id" TEXT,
    "code" TEXT NOT NULL,
    "qr_payload" TEXT NOT NULL,
    "status" "TicketStatus" NOT NULL DEFAULT 'valid',
    "used_at" TIMESTAMP(3),
    "used_by" TEXT,
    "validation_method" "ValidationMethod",
    "manual_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "checkin_access" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "pin_hash" TEXT NOT NULL,
    "created_by" TEXT NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "checkin_access_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_events" (
    "id" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "payment_id" TEXT,
    "payload" JSONB NOT NULL,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMP(3),

    CONSTRAINT "webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "artists_slug_key" ON "artists"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "events_slug_key" ON "events"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "seats_event_id_row_number_key" ON "seats"("event_id", "row", "number");

-- CreateIndex
CREATE UNIQUE INDEX "orders_asaas_payment_id_key" ON "orders"("asaas_payment_id");

-- CreateIndex
CREATE INDEX "orders_event_id_status_idx" ON "orders"("event_id", "status");

-- CreateIndex
CREATE INDEX "orders_status_hold_expires_at_idx" ON "orders"("status", "hold_expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "tickets_qr_payload_key" ON "tickets"("qr_payload");

-- CreateIndex
CREATE UNIQUE INDEX "tickets_event_id_code_key" ON "tickets"("event_id", "code");

-- CreateIndex
CREATE INDEX "audit_log_entity_entity_id_idx" ON "audit_log"("entity", "entity_id");

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_artist_id_fkey" FOREIGN KEY ("artist_id") REFERENCES "artists"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_media" ADD CONSTRAINT "event_media_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_lots" ADD CONSTRAINT "ticket_lots_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seats" ADD CONSTRAINT "seats_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_lot_id_fkey" FOREIGN KEY ("lot_id") REFERENCES "ticket_lots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_seat_id_fkey" FOREIGN KEY ("seat_id") REFERENCES "seats"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_lot_id_fkey" FOREIGN KEY ("lot_id") REFERENCES "ticket_lots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_seat_id_fkey" FOREIGN KEY ("seat_id") REFERENCES "seats"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checkin_access" ADD CONSTRAINT "checkin_access_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
