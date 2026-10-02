-- Link de conferência da portaria: token secreto no endereço + bloqueio por PIN errado.
-- A tabela ainda não tinha uso; o UPDATE só garante o NOT NULL caso exista alguma linha.
ALTER TABLE "checkin_access"
  ADD COLUMN "token" TEXT,
  ADD COLUMN "failed_attempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "locked_until" TIMESTAMP(3);

UPDATE "checkin_access" SET "token" = md5(random()::text || "id") WHERE "token" IS NULL;

ALTER TABLE "checkin_access" ALTER COLUMN "token" SET NOT NULL;

CREATE UNIQUE INDEX "checkin_access_token_key" ON "checkin_access"("token");
