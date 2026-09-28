-- CreateTable
CREATE TABLE "mock_payments" (
    "id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "value" DOUBLE PRECISION NOT NULL,
    "billing_type" TEXT NOT NULL,
    "external_reference" TEXT,
    "deleted" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mock_payments_pkey" PRIMARY KEY ("id")
);
