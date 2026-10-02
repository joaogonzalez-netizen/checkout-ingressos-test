import "server-only";
import { db } from "./db";
import type { Prisma } from "@/generated/prisma/client";

const ACCENTED = "áàâãäéèêëíìîïóòôõöúùûüç";
const PLAIN = "aaaaaeeeeiiiiooooouuuuc";
const unaccent = (v: string) => [...v.toLowerCase()].map((c) => PLAIN[ACCENTED.indexOf(c)] ?? c).join("");
/** % e _ são curingas no LIKE: escapa para buscar o caractere literal. */
const likeLiteral = (v: string) => v.replace(/[\\%_]/g, (c) => `\\${c}`);

/** Busca única: nome (sem diferenciar acento), e-mail ou telefone; também código do ingresso ou nº do pedido. */
export async function ticketSearchWhere(eventId: string, q: string): Promise<Prisma.TicketWhereInput> {
  if (!q) return {};
  const digits = q.replace(/\D/g, "");
  // Na portaria ninguém digita acento: "natalia" precisa achar "Natália". SQL próprio porque o
  // "contains" do Prisma não escapa % e _ (buscar "%" traria todo mundo).
  const pattern = `%${likeLiteral(unaccent(q))}%`;
  const byText = await db.$queryRaw<{ id: string }[]>`
    SELECT t.id FROM tickets t JOIN orders o ON o.id = t.order_id
    WHERE t.event_id = ${eventId}
      AND (translate(lower(o.buyer_name), ${ACCENTED}, ${PLAIN}) LIKE ${pattern} OR lower(o.buyer_email) LIKE ${pattern})`;
  return {
    OR: [
      { id: { in: byText.map((r) => r.id) } },
      ...(digits.length >= 4 ? [{ order: { buyerPhone: { contains: digits } } }] : []),
      { code: q.toUpperCase().replace(/\s/g, "") },
      ...(/^[a-z0-9]{4,}$/i.test(q) ? [{ orderId: { endsWith: q.toLowerCase() } }] : []),
    ],
  };
}

