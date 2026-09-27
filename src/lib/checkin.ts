import "server-only";
import { db } from "./db";
import { audit } from "./audit";
import { verifyQrPayload } from "./tickets";
import type { ValidationMethod } from "@/generated/prisma/client";

// Conferência de ingressos. QR, código e lista caem todos em checkIn(): um único UPDATE condicional
// decide o "já usado", então trocar de caminho não permite reusar um ingresso (Arquitetura).

export type CheckinResult =
  | { ok: true; ticketId: string; code: string; buyer: string; lot: string; seat: string | null }
  | { ok: false; reason: "invalid" | "wrong_event" | "used" | "canceled"; message: string; usedAt?: Date | null; usedBy?: string | null };

const CODE = /^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{4}$/;

/** Aceita o código de 4 caracteres ou o conteúdo do QR (v1.<ticket>.<evento>.<assinatura>). */
export async function resolveEntry(eventId: string, raw: string): Promise<{ ticketId: string; method: ValidationMethod } | CheckinResult> {
  const value = raw.trim();
  if (value.startsWith("v1.")) {
    const qr = verifyQrPayload(value);
    if (!qr) return { ok: false, reason: "invalid", message: "QR inválido: assinatura não confere." };
    if (qr.eventId !== eventId) return { ok: false, reason: "wrong_event", message: "Este ingresso é de outro evento." };
    return { ticketId: qr.ticketId, method: "qr" };
  }
  const code = value.toUpperCase().replace(/\s/g, "");
  if (!CODE.test(code)) return { ok: false, reason: "invalid", message: "Código inválido. São 4 caracteres, sem 0, O, 1, I ou L." };
  const ticket = await db.ticket.findUnique({ where: { eventId_code: { eventId, code } } });
  if (!ticket) return { ok: false, reason: "invalid", message: `Nenhum ingresso com o código ${code} neste evento.` };
  return { ticketId: ticket.id, method: "code" };
}

export async function checkIn(input: {
  eventId: string;
  ticketId: string;
  method: ValidationMethod;
  usedBy: string;
  userId: string;
  reason?: string;
}): Promise<CheckinResult> {
  const updated = await db.ticket.updateMany({
    where: { id: input.ticketId, eventId: input.eventId, status: "valid" },
    data: {
      status: "used",
      usedAt: new Date(),
      usedBy: input.usedBy,
      validationMethod: input.method,
      manualReason: input.reason ?? null,
    },
  });
  const ticket = await db.ticket.findUnique({
    where: { id: input.ticketId },
    include: { order: true, lot: true, seat: true },
  });
  if (!ticket || ticket.eventId !== input.eventId) return { ok: false, reason: "invalid", message: "Ingresso não encontrado neste evento." };

  const ok = updated.count === 1;
  await audit(db, {
    entity: "ticket",
    entityId: ticket.id,
    action: ok ? "checked_in" : "checkin_rejected",
    after: { method: input.method, status: ticket.status, reason: input.reason ?? null },
    userId: input.userId,
  });

  if (!ok) {
    if (ticket.status === "canceled") return { ok: false, reason: "canceled", message: "Ingresso cancelado (pedido estornado)." };
    return { ok: false, reason: "used", message: "Ingresso já utilizado.", usedAt: ticket.usedAt, usedBy: ticket.usedBy };
  }
  return {
    ok: true,
    ticketId: ticket.id,
    code: ticket.code,
    buyer: ticket.order.buyerName,
    lot: ticket.lot.name,
    seat: ticket.seat ? `${ticket.seat.row}${ticket.seat.number}` : null,
  };
}

/** Desfaz um check-in feito por engano. Motivo obrigatório; fica no log com o estado anterior. */
export async function undoCheckIn(input: { eventId: string; ticketId: string; reason: string; userId: string }) {
  const before = await db.ticket.findUnique({ where: { id: input.ticketId } });
  if (!before || before.eventId !== input.eventId || before.status !== "used") return false;
  const updated = await db.ticket.updateMany({
    where: { id: input.ticketId, status: "used" },
    data: { status: "valid", usedAt: null, usedBy: null, validationMethod: null, manualReason: null },
  });
  if (updated.count !== 1) return false;
  await audit(db, {
    entity: "ticket",
    entityId: input.ticketId,
    action: "checkin_undone",
    before: { usedAt: before.usedAt?.toISOString(), usedBy: before.usedBy, method: before.validationMethod },
    after: { reason: input.reason },
    userId: input.userId,
  });
  return true;
}
