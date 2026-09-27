import "server-only";
import { db } from "./db";
import { env } from "./env";
import { randomToken } from "./crypto";
import { asaas, AsaasError, PAID_STATUSES, type AsaasPayment, type AsaasWebhookEvent } from "./asaas";
import { MAX_TICKETS_PER_ORDER, installmentTotalCents, serviceFeeCents, type InstallmentCount } from "./money";

export { MAX_TICKETS_PER_ORDER };
import { onlyDigits } from "./documents";
import { issueTickets } from "./tickets";
import { audit } from "./audit";
import { resolvePixel, sendCapiEvent } from "./meta";
import type { OrderStatus, Prisma } from "@/generated/prisma/client";

/** Tempo que a poltrona/lote fica reservado enquanto o pagamento não confirma. */
export const HOLD_MINUTES = 15;

export class CheckoutError extends Error {
  constructor(
    message: string,
    readonly code: "not_found" | "sold_out" | "seat_taken" | "invalid" | "payment",
  ) {
    super(message);
  }
}

export type CreateOrderInput = {
  slug: string;
  /** Lote e quantidade (ex.: 2x Inteira + 1x Meia). Em lugar marcado: 1 item com quantidade 1. */
  items: { lotId: string; quantity: number }[];
  seatId: string | null;
  buyerName: string;
  buyerEmail: string;
  buyerCpfCnpj: string;
  buyerPhone: string;
  marketingOptIn: boolean;
  method: "pix" | "credit_card";
  installments: InstallmentCount;
  fbp?: string | null;
  fbc?: string | null;
  clientIp?: string | null;
  userAgent?: string | null;
  sourceUrl?: string | null;
};

export type CreateOrderResult =
  | { orderId: string; accessToken: string; next: { type: "redirect"; url: string } }
  | {
      orderId: string;
      accessToken: string;
      next: { type: "pix"; qrImage: string; payload: string; expiresAt: string; devPayUrl?: string };
    };

type Tx = Prisma.TransactionClient;

/** Reserva cada item de forma atômica. Retorna false se algum lote não tiver saldo (nada fica reservado: o chamador aborta a transação). */
async function reserveItems(tx: Tx, items: { lotId: string; quantity: number }[]) {
  for (const item of items) {
    const ok = await tx.$executeRaw`
      UPDATE ticket_lots SET reserved = reserved + ${item.quantity}
      WHERE id = ${item.lotId} AND reserved + ${item.quantity} <= quantity`;
    if (ok !== 1) return item.lotId;
  }
  return null;
}

async function unreserveItems(tx: Tx, items: { lotId: string; quantity: number }[], alsoSold = false) {
  for (const item of items) {
    if (alsoSold) {
      await tx.$executeRaw`
        UPDATE ticket_lots SET sold = GREATEST(sold - ${item.quantity}, 0), reserved = GREATEST(reserved - ${item.quantity}, 0)
        WHERE id = ${item.lotId}`;
    } else {
      await tx.$executeRaw`UPDATE ticket_lots SET reserved = GREATEST(reserved - ${item.quantity}, 0) WHERE id = ${item.lotId}`;
    }
  }
}

export async function createOrder(input: CreateOrderInput): Promise<CreateOrderResult> {
  const event = await db.event.findUnique({
    where: { slug: input.slug },
    include: { lots: true, artist: true },
  });
  if (!event || event.status !== "published") throw new CheckoutError("Evento indisponível", "not_found");

  // Junta repetidos e descarta quantidade zero.
  const merged = new Map<string, number>();
  for (const i of input.items) if (i.quantity > 0) merged.set(i.lotId, (merged.get(i.lotId) ?? 0) + i.quantity);
  const requested = [...merged].map(([lotId, quantity]) => ({ lotId, quantity }));
  const count = requested.reduce((a, i) => a + i.quantity, 0);
  if (count === 0) throw new CheckoutError("Selecione ao menos um ingresso", "invalid");
  if (count > MAX_TICKETS_PER_ORDER) throw new CheckoutError(`Máximo de ${MAX_TICKETS_PER_ORDER} ingressos por compra`, "invalid");

  const now = new Date();
  const lines = requested.map((i) => {
    const lot = event.lots.find((l) => l.id === i.lotId);
    if (!lot) throw new CheckoutError("Lote inválido", "invalid");
    if ((lot.salesStartAt && lot.salesStartAt > now) || (lot.salesEndAt && lot.salesEndAt < now)) {
      throw new CheckoutError(`"${lot.name}" não está à venda agora`, "sold_out");
    }
    return { lot, quantity: i.quantity, unitCents: lot.priceCents, feeCents: serviceFeeCents(lot.priceCents) };
  });

  if (event.seatingMode === "seated") {
    if (!input.seatId) throw new CheckoutError("Escolha uma poltrona", "invalid");
    if (count !== 1) throw new CheckoutError("Com lugar marcado, a compra é de 1 ingresso por poltrona", "invalid");
  } else if (input.seatId) {
    throw new CheckoutError("Evento sem lugar marcado", "invalid");
  }
  if (input.method === "pix" && input.installments !== 1) throw new CheckoutError("Pix é sempre à vista", "invalid");

  const ticketCents = lines.reduce((a, l) => a + l.unitCents * l.quantity, 0);
  const feeCents = lines.reduce((a, l) => a + l.feeCents * l.quantity, 0);
  const baseCents = ticketCents + feeCents;
  const totalCents = input.method === "credit_card" ? installmentTotalCents(baseCents, input.installments) : baseCents;
  const accessToken = randomToken();

  // 1) Reserva atômica de todos os itens (e da poltrona): ou sai tudo, ou nada.
  const order = await db.$transaction(async (tx) => {
    const failedLot = await reserveItems(tx, requested);
    if (failedLot) {
      const lot = event.lots.find((l) => l.id === failedLot)!;
      throw new CheckoutError(`Não há ingressos suficientes em "${lot.name}". Diminua a quantidade.`, "sold_out");
    }

    const created = await tx.order.create({
      data: {
        accessToken,
        eventId: event.id,
        lotId: lines.length === 1 ? lines[0].lot.id : null,
        seatId: input.seatId,
        paymentMethod: input.method,
        installments: input.installments,
        buyerName: input.buyerName.trim(),
        buyerEmail: input.buyerEmail.trim().toLowerCase(),
        buyerCpfCnpj: onlyDigits(input.buyerCpfCnpj),
        buyerPhone: onlyDigits(input.buyerPhone),
        marketingOptIn: input.marketingOptIn,
        ticketCents,
        feeCents,
        totalCents,
        holdExpiresAt: new Date(now.getTime() + HOLD_MINUTES * 60_000),
        acceptedTermsAt: now,
        fbp: input.fbp,
        fbc: input.fbc,
        clientIp: input.clientIp,
        userAgent: input.userAgent,
        sourceUrl: input.sourceUrl,
        items: {
          create: lines.map((l) => ({ lotId: l.lot.id, quantity: l.quantity, unitCents: l.unitCents, feeCents: l.feeCents })),
        },
      },
    });

    if (input.seatId) {
      const held = await tx.$executeRaw`
        UPDATE seats SET status = 'held', order_id = ${created.id}
        WHERE id = ${input.seatId} AND event_id = ${event.id} AND status = 'available'`;
      if (held !== 1) throw new CheckoutError("Essa poltrona acabou de ser escolhida por outra pessoa", "seat_taken");
    }
    return created;
  });

  // 2) Cobrança na Asaas, fora da transação (chamada externa).
  const client = asaas();
  try {
    const customer = await client.createCustomer({
      name: order.buyerName,
      email: order.buyerEmail,
      cpfCnpj: order.buyerCpfCnpj,
      mobilePhone: order.buyerPhone ?? undefined,
    });
    const payment = await client.createPayment({
      customerId: customer.id,
      method: input.method,
      totalCents,
      installments: input.installments,
      description: `${event.showName} · ${lines.map((l) => `${l.quantity}x ${l.lot.name}`).join(", ")}`.slice(0, 500),
      externalReference: order.id,
      successUrl: orderUrl(order.id, accessToken),
    });

    if (input.method === "pix") {
      const qr = await client.getPixQrCode(payment.id);
      await db.order.update({
        where: { id: order.id },
        data: {
          asaasCustomerId: customer.id,
          asaasPaymentId: payment.id,
          pixPayload: qr.payload,
          pixQrImage: qr.encodedImage,
        },
      });
      return {
        orderId: order.id,
        accessToken,
        next: {
          type: "pix",
          qrImage: qr.encodedImage,
          payload: qr.payload,
          expiresAt: order.holdExpiresAt.toISOString(),
          devPayUrl: env.ASAAS_MOCK ? payment.invoiceUrl : undefined,
        },
      };
    }

    await db.order.update({
      where: { id: order.id },
      data: { asaasCustomerId: customer.id, asaasPaymentId: payment.id, invoiceUrl: payment.invoiceUrl },
    });
    return { orderId: order.id, accessToken, next: { type: "redirect", url: payment.invoiceUrl! } };
  } catch (err) {
    await releaseOrder(order.id, "failed");
    const message = err instanceof AsaasError ? err.message : "Não foi possível iniciar o pagamento";
    throw new CheckoutError(message, "payment");
  }
}

export function orderUrl(orderId: string, accessToken: string) {
  return `${env.APP_URL}/pedido/${orderId}?t=${accessToken}`;
}

/** Devolve lotes e poltrona ao estoque. Só age em pedido pendente. */
export async function releaseOrder(orderId: string, status: Extract<OrderStatus, "failed" | "expired" | "canceled">) {
  await db.$transaction(async (tx) => {
    const updated = await tx.order.updateMany({ where: { id: orderId, status: "pending" }, data: { status } });
    if (updated.count !== 1) return;
    const items = await tx.orderItem.findMany({ where: { orderId } });
    await unreserveItems(tx, items);
    await tx.$executeRaw`
      UPDATE seats SET status = 'available', order_id = NULL
      WHERE order_id = ${orderId} AND status = 'held'`;
  });
}

/**
 * Pedido vira "pago" somente após a confirmação da Asaas (webhook ou consulta ativa).
 * Nunca antes, para não emitir ingresso de pagamento que ainda pode falhar.
 */
export async function markOrderPaid(orderId: string) {
  const result = await db.$transaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { id: orderId }, include: { items: true } });
    if (!order || order.status === "paid" || order.status === "refunded") return null;

    if (order.status !== "pending") {
      // Pagamento chegou depois de a reserva ter sido liberada: tenta reservar tudo de novo.
      const failedLot = await reserveItems(tx, order.items);
      const seatOk = order.seatId
        ? await tx.$executeRaw`
            UPDATE seats SET status = 'held', order_id = ${order.id}
            WHERE id = ${order.seatId} AND status = 'available'`
        : 1;
      if (failedLot || seatOk !== 1) {
        // Desfaz o que conseguiu reservar antes da falha (itens anteriores ao que falhou).
        const done = failedLot ? order.items.slice(0, order.items.findIndex((i) => i.lotId === failedLot)) : order.items;
        await unreserveItems(tx, done);
        await tx.order.update({ where: { id: order.id }, data: { status: "paid", paidAt: new Date() } });
        await audit(tx, {
          entity: "order",
          entityId: order.id,
          action: "paid_after_release_conflict",
          after: { note: "Pago após expirar e a vaga já foi vendida. Estornar ou realocar manualmente." },
        });
        return null;
      }
    }

    await tx.order.update({ where: { id: order.id }, data: { status: "paid", paidAt: new Date() } });
    for (const item of order.items) {
      await tx.$executeRaw`UPDATE ticket_lots SET sold = sold + ${item.quantity} WHERE id = ${item.lotId}`;
    }
    if (order.seatId) {
      await tx.$executeRaw`UPDATE seats SET status = 'sold', order_id = ${order.id} WHERE id = ${order.seatId}`;
    }
    await issueTickets(tx, order);
    return order;
  });

  if (result) await sendPurchaseEvent(result.id);
}

export async function refundOrder(orderId: string, reason: string) {
  await db.$transaction(async (tx) => {
    const updated = await tx.order.updateMany({ where: { id: orderId, status: "paid" }, data: { status: "refunded" } });
    if (updated.count !== 1) return;
    const tickets = await tx.ticket.updateMany({ where: { orderId }, data: { status: "canceled" } });
    if (tickets.count > 0) {
      await unreserveItems(tx, await tx.orderItem.findMany({ where: { orderId } }), true);
      await tx.$executeRaw`UPDATE seats SET status = 'available', order_id = NULL WHERE order_id = ${orderId}`;
    }
    await audit(tx, { entity: "order", entityId: orderId, action: "refunded", after: { reason } });
  });
}

/** Purchase server-side. event_id = purchase-<orderId>, o mesmo do pixel na página de confirmação. */
async function sendPurchaseEvent(orderId: string) {
  const order = await db.order.findUnique({
    where: { id: orderId },
    include: { event: { include: { artist: true } }, items: true },
  });
  if (!order || order.capiPurchaseSentAt) return;
  const pixel = resolvePixel(order.event);
  if (!pixel) return;
  const res = await sendCapiEvent(pixel, {
    name: "Purchase",
    eventId: `purchase-${order.id}`,
    sourceUrl: order.sourceUrl,
    email: order.buyerEmail,
    phone: order.buyerPhone,
    externalId: order.buyerCpfCnpj,
    clientIp: order.clientIp,
    userAgent: order.userAgent,
    fbp: order.fbp,
    fbc: order.fbc,
    valueCents: order.totalCents,
    contentIds: order.items.map((i) => i.lotId),
  });
  if (res.ok) await db.order.update({ where: { id: order.id }, data: { capiPurchaseSentAt: new Date() } });
  else console.error(`[capi] Purchase do pedido ${order.id} falhou: ${res.error}`);
}

function isPaid(payment: AsaasPayment) {
  return PAID_STATUSES.includes(payment.status);
}

/**
 * Consulta ativa à Asaas: fallback quando o webhook atrasa ou falha (Requisitos não-funcionais).
 * Limitada a uma consulta a cada 15 s por pedido.
 */
export async function reconcileOrder(orderId: string) {
  const order = await db.order.findUnique({ where: { id: orderId } });
  if (!order || order.status !== "pending" || !order.asaasPaymentId) return;
  if (order.lastReconciledAt && Date.now() - order.lastReconciledAt.getTime() < 15_000) return;
  await db.order.update({ where: { id: order.id }, data: { lastReconciledAt: new Date() } });
  try {
    const payment = await asaas().getPayment(order.asaasPaymentId);
    if (isPaid(payment)) await markOrderPaid(order.id);
  } catch (err) {
    console.error(`[asaas] consulta do pedido ${order.id} falhou`, err);
  }
}

/**
 * Libera reservas vencidas. Antes de liberar, confirma com a Asaas que não houve pagamento e
 * apaga a cobrança; se a exclusão falhar, a reserva fica para a próxima rodada.
 */
export async function expireHolds(filter: Prisma.OrderWhereInput = {}) {
  const expired = await db.order.findMany({
    where: { ...filter, status: "pending", holdExpiresAt: { lt: new Date() } },
    take: 50,
  });
  const client = asaas();
  let released = 0;
  for (const order of expired) {
    if (!order.asaasPaymentId) {
      await releaseOrder(order.id, "expired");
      released++;
      continue;
    }
    try {
      const payment = await client.getPayment(order.asaasPaymentId);
      if (isPaid(payment)) {
        await markOrderPaid(order.id);
        continue;
      }
      if (payment.deleted || (await client.deletePayment(order.asaasPaymentId))) {
        await releaseOrder(order.id, "expired");
        released++;
      }
    } catch (err) {
      if (err instanceof AsaasError && err.status === 404) {
        await releaseOrder(order.id, "expired");
        released++;
      } else {
        console.error(`[asaas] expiração do pedido ${order.id} adiada`, err);
      }
    }
  }
  return { checked: expired.length, released };
}

/** Processa um evento de webhook da Asaas de forma idempotente. */
export async function handleAsaasEvent(evt: AsaasWebhookEvent): Promise<"processed" | "duplicate" | "ignored"> {
  const inserted = await db.$executeRaw`
    INSERT INTO webhook_events (id, event, payment_id, payload, received_at)
    VALUES (${evt.id}, ${evt.event}, ${evt.payment?.id ?? null}, ${JSON.stringify(evt)}::jsonb, now())
    ON CONFLICT (id) DO NOTHING`;
  if (inserted === 0) {
    const previous = await db.webhookEvent.findUnique({ where: { id: evt.id } });
    if (previous?.processedAt) return "duplicate";
  }

  const payment = evt.payment;
  const order = payment
    ? await db.order.findFirst({
        where: {
          OR: [
            ...(payment.externalReference ? [{ id: payment.externalReference }] : []),
            { asaasPaymentId: payment.id },
          ],
        },
      })
    : null;

  let outcome: "processed" | "ignored" = "ignored";
  if (order) {
    switch (evt.event) {
      case "PAYMENT_CONFIRMED":
      case "PAYMENT_RECEIVED":
        await markOrderPaid(order.id);
        outcome = "processed";
        break;
      case "PAYMENT_OVERDUE":
        await releaseOrder(order.id, "expired");
        outcome = "processed";
        break;
      case "PAYMENT_DELETED":
        await releaseOrder(order.id, "canceled");
        outcome = "processed";
        break;
      case "PAYMENT_REPROVED_BY_RISK_ANALYSIS":
      case "PAYMENT_CREDIT_CARD_CAPTURE_REFUSED":
        await releaseOrder(order.id, "failed");
        outcome = "processed";
        break;
      case "PAYMENT_REFUNDED":
      case "PAYMENT_CHARGEBACK_REQUESTED":
        await refundOrder(order.id, evt.event);
        outcome = "processed";
        break;
    }
  }

  await db.webhookEvent.update({ where: { id: evt.id }, data: { processedAt: new Date() } });
  return outcome;
}
