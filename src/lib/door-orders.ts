import "server-only";
import { db } from "./db";
import { verifyQrPayload } from "./tickets";
import { ticketSearchWhere } from "./checkin-search";

// Conferência na porta pensada em COMPRAS, não em ingressos soltos: QR, código de 4 caracteres, nome ou telefone
// levam à compra inteira, e o operador libera todos os ingressos dela ou só os de quem chegou agora.

export type DoorTicket = {
  id: string;
  code: string;
  lot: string;
  seat: string | null;
  status: "valid" | "used" | "canceled";
  usedAt: string | null;
  usedBy: string | null;
};

export type DoorOrder = {
  orderId: string;
  buyer: string;
  /** Só o fim do telefone: ajuda a separar dois compradores com o mesmo nome. */
  phoneEnd: string | null;
  tickets: DoorTicket[];
  /** Ingresso que o cliente apresentou (QR ou código), para destacar na compra. */
  highlightId: string | null;
};

export type DoorSummary = { orderId: string; buyer: string; phoneEnd: string | null; total: number; pending: number };

export type DoorFind =
  | { kind: "order"; order: DoorOrder }
  | { kind: "list"; items: DoorSummary[] }
  | { kind: "error"; message: string };

export type DoorStats = { used: number; total: number };

const CODE = /^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{4}$/;
const MAX_ORDERS = 12;

const phoneEnd = (phone: string | null) => (phone && phone.length >= 4 ? phone.slice(-4) : null);

export async function doorStats(eventId: string): Promise<DoorStats> {
  const [total, used] = await Promise.all([
    db.ticket.count({ where: { eventId, status: { not: "canceled" } } }),
    db.ticket.count({ where: { eventId, status: "used" } }),
  ]);
  return { used, total };
}

export async function doorOrder(eventId: string, orderId: string, highlightId: string | null = null): Promise<DoorOrder | null> {
  const order = await db.order.findUnique({
    where: { id: orderId },
    include: { tickets: { include: { lot: true, seat: true }, orderBy: { createdAt: "asc" } } },
  });
  if (!order || order.eventId !== eventId || order.tickets.length === 0) return null;
  return {
    orderId: order.id,
    buyer: order.buyerName,
    phoneEnd: phoneEnd(order.buyerPhone),
    highlightId,
    tickets: order.tickets.map((t) => ({
      id: t.id,
      code: t.code,
      lot: t.lot.name,
      seat: t.seat ? `${t.seat.row}${t.seat.number}` : null,
      status: t.status,
      usedAt: t.usedAt ? t.usedAt.toISOString() : null,
      usedBy: t.usedBy,
    })),
  };
}

async function orderOfTicket(eventId: string, ticketId: string): Promise<DoorFind> {
  const ticket = await db.ticket.findUnique({ where: { id: ticketId }, select: { orderId: true, eventId: true } });
  if (!ticket || ticket.eventId !== eventId) return { kind: "error", message: "Ingresso não encontrado neste evento." };
  const order = await doorOrder(eventId, ticket.orderId, ticketId);
  return order ? { kind: "order", order } : { kind: "error", message: "Compra não encontrada." };
}

/** QR (v1.…), código de 4 caracteres, nome (sem acento) ou telefone. */
export async function findForDoor(eventId: string, raw: string): Promise<DoorFind> {
  const value = raw.trim();
  if (!value) return { kind: "error", message: "Leia o QR ou digite o código, o nome ou o telefone." };

  if (value.startsWith("v1.")) {
    const qr = verifyQrPayload(value);
    if (!qr) return { kind: "error", message: "QR inválido: a assinatura não confere." };
    if (qr.eventId !== eventId) return { kind: "error", message: "Este ingresso é de outro evento." };
    return orderOfTicket(eventId, qr.ticketId);
  }

  // Um nome curto como "Ruth" também parece código: só vale como código se existir esse ingresso.
  const code = value.toUpperCase().replace(/\s/g, "");
  if (CODE.test(code)) {
    const ticket = await db.ticket.findUnique({ where: { eventId_code: { eventId, code } }, select: { id: true } });
    if (ticket) return orderOfTicket(eventId, ticket.id);
  }

  if (value.replace(/\D/g, "").length < 4 && value.length < 3) {
    return { kind: "error", message: "Digite ao menos 3 letras do nome, 4 números do telefone ou o código de 4 caracteres." };
  }
  const hits = await db.ticket.findMany({
    where: { eventId, ...(await ticketSearchWhere(eventId, value)) },
    select: { orderId: true },
    take: 300,
  });
  const orderIds = [...new Set(hits.map((h) => h.orderId))];
  if (orderIds.length === 0) return { kind: "error", message: `Ninguém encontrado para "${value}".` };
  if (orderIds.length === 1) {
    const order = await doorOrder(eventId, orderIds[0]);
    return order ? { kind: "order", order } : { kind: "error", message: "Compra não encontrada." };
  }

  const orders = await db.order.findMany({
    where: { id: { in: orderIds.slice(0, MAX_ORDERS) } },
    include: { tickets: { select: { status: true } } },
    orderBy: { buyerName: "asc" },
  });
  return {
    kind: "list",
    items: orders.map((o) => ({
      orderId: o.id,
      buyer: o.buyerName,
      phoneEnd: phoneEnd(o.buyerPhone),
      total: o.tickets.filter((t) => t.status !== "canceled").length,
      pending: o.tickets.filter((t) => t.status === "valid").length,
    })),
  };
}
