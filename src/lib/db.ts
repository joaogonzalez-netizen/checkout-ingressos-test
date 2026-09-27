import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { env } from "./env";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient() {
  // PGlite (banco de dev) tem uma única sessão compartilhada por todas as conexões:
  // com DATABASE_POOL_MAX=1 as queries são serializadas e as transações não se misturam.
  const max = Number(process.env.DATABASE_POOL_MAX) || undefined;
  const adapter = new PrismaPg({ connectionString: env.DATABASE_URL, max });
  return new PrismaClient({ adapter });
}

// Em dev o cliente fica no globalThis para sobreviver ao HMR. Se o Prisma foi regenerado
// (schema novo), a classe muda e o cliente antigo é descartado.
const cached = globalForPrisma.prisma;
export const db = cached instanceof PrismaClient ? cached : createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
