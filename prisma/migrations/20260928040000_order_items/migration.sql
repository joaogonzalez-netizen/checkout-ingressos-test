-- DropForeignKey
ALTER TABLE "orders" DROP CONSTRAINT "orders_lot_id_fkey";

-- AlterTable
ALTER TABLE "orders" ALTER COLUMN "lot_id" DROP NOT NULL;

-- CreateTable
CREATE TABLE "order_items" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "lot_id" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit_cents" INTEGER NOT NULL,
    "fee_cents" INTEGER NOT NULL,

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "order_items_order_id_lot_id_key" ON "order_items"("order_id", "lot_id");

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_lot_id_fkey" FOREIGN KEY ("lot_id") REFERENCES "ticket_lots"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_lot_id_fkey" FOREIGN KEY ("lot_id") REFERENCES "ticket_lots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Pedidos existentes (1 ingresso de 1 lote) viram um item com quantidade 1.
INSERT INTO "order_items" ("id", "order_id", "lot_id", "quantity", "unit_cents", "fee_cents")
SELECT 'oi_' || "id", "id", "lot_id", 1, "ticket_cents", "fee_cents" FROM "orders" WHERE "lot_id" IS NOT NULL;
