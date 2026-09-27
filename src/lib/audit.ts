import "server-only";
import { db } from "./db";
import type { Prisma } from "@/generated/prisma/client";

type Tx = Prisma.TransactionClient | typeof db;

/** BO-11: toda edição de evento publicado e toda validação de ingresso ficam no log. */
export async function audit(
  tx: Tx,
  entry: { entity: string; entityId: string; action: string; before?: unknown; after?: unknown; userId?: string | null },
) {
  await tx.auditLog.create({
    data: {
      entity: entry.entity,
      entityId: entry.entityId,
      action: entry.action,
      before: (entry.before ?? undefined) as Prisma.InputJsonValue | undefined,
      after: (entry.after ?? undefined) as Prisma.InputJsonValue | undefined,
      userId: entry.userId ?? null,
    },
  });
}

/** Retorna só os campos que mudaram, para gravar before/after enxutos. */
export function diff<T extends Record<string, unknown>>(before: T, after: Partial<T>) {
  const b: Record<string, unknown> = {};
  const a: Record<string, unknown> = {};
  for (const key of Object.keys(after)) {
    const prev = before[key] instanceof Date ? (before[key] as Date).toISOString() : before[key];
    const next = after[key] instanceof Date ? (after[key] as Date).toISOString() : after[key];
    if (JSON.stringify(prev) !== JSON.stringify(next)) {
      b[key] = prev;
      a[key] = next;
    }
  }
  return Object.keys(a).length ? { before: b, after: a } : null;
}
