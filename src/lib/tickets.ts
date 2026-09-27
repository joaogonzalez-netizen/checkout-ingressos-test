import "server-only";
import { randomInt, randomUUID } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import { env } from "./env";
import { hmac } from "./crypto";

// Sem 0/O/1/I/L para evitar ambiguidade na digitação (Arquitetura, "Emissão e entrega").
const CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

export function randomTicketCode(): string {
  let code = "";
  for (let i = 0; i < 4; i++) code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return code;
}

/** Payload do QR: v1.<ticketId>.<eventId>.<hmac>. O app de check-in valida offline com o mesmo segredo. */
export function signQrPayload(ticketId: string, eventId: string): string {
  const body = `v1.${ticketId}.${eventId}`;
  return `${body}.${hmac(env.TICKET_HMAC_SECRET, body)}`;
}

export function verifyQrPayload(payload: string): { ticketId: string; eventId: string } | null {
  const [version, ticketId, eventId, signature] = payload.split(".");
  if (version !== "v1" || !ticketId || !eventId || !signature) return null;
  return signQrPayload(ticketId, eventId) === payload ? { ticketId, eventId } : null;
}

/**
 * Emite 1 ingresso por unidade de cada item do pedido (2x Inteira + 1x Meia = 3 ingressos).
 * O código curto é único dentro do evento. A checagem é feita antes do insert, porque um erro
 * de unicidade dentro da transação abortaria o pedido inteiro.
 */
export async function issueTickets(
  tx: Prisma.TransactionClient,
  order: { id: string; eventId: string; seatId: string | null; items: { lotId: string; quantity: number }[] },
) {
  const existing = await tx.ticket.count({ where: { orderId: order.id } });
  if (existing > 0) return;

  for (const item of order.items) {
    for (let n = 0; n < item.quantity; n++) {
      let code = randomTicketCode();
      for (let attempt = 0; attempt < 20; attempt++) {
        const taken = await tx.ticket.findUnique({ where: { eventId_code: { eventId: order.eventId, code } } });
        if (!taken) break;
        code = randomTicketCode();
      }
      const id = randomUUID();
      await tx.ticket.create({
        data: {
          id,
          eventId: order.eventId,
          orderId: order.id,
          lotId: item.lotId,
          // Lugar marcado é sempre 1 ingresso por pedido.
          seatId: order.seatId,
          code,
          qrPayload: signQrPayload(id, order.eventId),
        },
      });
    }
  }
}
