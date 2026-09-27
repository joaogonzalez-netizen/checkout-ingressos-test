import "server-only";
import { randomInt } from "node:crypto";
import { db } from "./db";
import { env } from "./env";
import { randomToken } from "./crypto";
import { serviceFeeCents } from "./money";
import { markOrderPaid } from "./orders";

// Só para testar a Conferência em desenvolvimento (modo simulado, sem Asaas real).

const FIRST = ["Ana", "Bruno", "Carla", "Diego", "Elisa", "Felipe", "Gabriela", "Heitor", "Isabela", "João", "Larissa", "Marcos", "Natália", "Otávio", "Paula", "Rafael", "Sofia", "Tiago", "Vitória", "Yuri"];
const LAST = ["Silva", "Souza", "Oliveira", "Santos", "Lima", "Pereira", "Costa", "Ferreira", "Almeida", "Ribeiro", "Carvalho", "Gomes"];

function fakeCpf() {
  const n = Array.from({ length: 9 }, () => randomInt(10));
  const d = (len: number) => {
    const sum = n.slice(0, len).reduce((acc, v, i) => acc + v * (len + 1 - i), 0);
    const r = (sum * 10) % 11;
    return r === 10 ? 0 : r;
  };
  n.push(d(9));
  n.push(d(10));
  return n.join("");
}

/**
 * Cria pedidos pagos de teste pelo mesmo caminho do checkout: reserva atômica de lote/poltrona e
 * markOrderPaid() (que emite o ingresso). Não passa pela Asaas.
 */
export async function createTestAttendees(eventId: string, count: number) {
  if (!env.ASAAS_MOCK) throw new Error("Disponível só em desenvolvimento, no modo simulado");
  const event = await db.event.findUniqueOrThrow({ where: { id: eventId }, include: { lots: true } });
  let created = 0;

  for (let i = 0; i < count; i++) {
    const lot = event.lots.sort((a, b) => a.position - b.position).find((l) => l.reserved < l.quantity);
    if (!lot) break;
    const name = `${FIRST[randomInt(FIRST.length)]} ${LAST[randomInt(LAST.length)]}`;
    const feeCents = serviceFeeCents(lot.priceCents);

    const order = await db.$transaction(async (tx) => {
      const reserved = await tx.$executeRaw`
        UPDATE ticket_lots SET reserved = reserved + 1 WHERE id = ${lot.id} AND reserved < quantity`;
      if (reserved !== 1) return null;
      let seatId: string | null = null;
      if (event.seatingMode === "seated") {
        const free = await tx.seat.findMany({ where: { eventId, status: "available" }, select: { id: true } });
        if (!free.length) throw new Error("sem poltronas");
        seatId = free[randomInt(free.length)].id;
      }
      const o = await tx.order.create({
        data: {
          accessToken: randomToken(),
          eventId,
          lotId: lot.id,
          seatId,
          paymentMethod: "pix",
          buyerName: name,
          buyerEmail: `${name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, ".")}.${randomToken(3).toLowerCase()}@teste.local`,
          buyerCpfCnpj: fakeCpf(),
          buyerPhone: `479${String(randomInt(10_000_000, 99_999_999))}`,
          ticketCents: lot.priceCents,
          feeCents,
          totalCents: lot.priceCents + feeCents,
          holdExpiresAt: new Date(Date.now() + 60_000),
          acceptedTermsAt: new Date(),
          asaasPaymentId: `pay_test_${randomToken(8)}`,
          items: { create: [{ lotId: lot.id, quantity: 1, unitCents: lot.priceCents, feeCents }] },
        },
      });
      if (seatId) {
        const held = await tx.$executeRaw`
          UPDATE seats SET status = 'held', order_id = ${o.id} WHERE id = ${seatId} AND status = 'available'`;
        if (held !== 1) throw new Error("poltrona ocupada");
      }
      return o;
    }).catch(() => null);

    if (!order) break;
    await markOrderPaid(order.id);
    lot.reserved++;
    created++;
  }
  return created;
}
