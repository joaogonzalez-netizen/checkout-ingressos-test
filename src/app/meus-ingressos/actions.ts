"use server";

import QRCode from "qrcode";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { hmac } from "@/lib/crypto";
import { audit } from "@/lib/audit";
import { onlyDigits } from "@/lib/documents";
import { formatDateTime, toLocalDate, todayLocal } from "@/lib/dates";

export type LookupTicket = {
  id: string;
  code: string;
  lot: string;
  seat: string | null;
  holder: string;
  used: boolean;
  usedAt: string | null;
  qr: string;
};
export type LookupGroup = {
  eventId: string;
  showName: string;
  artist: string;
  when: string;
  venue: string;
  upcoming: boolean;
  tickets: LookupTicket[];
};
export type LookupState = { error?: string; groups?: LookupGroup[] };

const MAX_LOOKUPS = 10; // por IP, a cada 10 minutos
const WINDOW_MS = 10 * 60_000;

/** "Maria Souza Lima" -> "Maria L.": o ingresso mostra só o suficiente para o comprador se reconhecer. */
function shortName(full: string) {
  const parts = full.trim().split(/\s+/);
  return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.` : parts[0];
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Consulta pública de ingressos pagos: exige o CPF/CNPJ ou celular E o e-mail usados na mesma compra. */
export async function lookupTickets(_prev: LookupState, form: FormData): Promise<LookupState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  let digits = onlyDigits(String(form.get("q") ?? ""));
  if (digits.length === 13 && digits.startsWith("55")) digits = digits.slice(2);
  if (digits.length !== 11 && digits.length !== 14) {
    return { error: "Informe o CPF ou o celular com DDD (11 números), ou o CNPJ (14 números)." };
  }

  if (!EMAIL.test(email)) return { error: "Informe o e-mail usado na compra." };

  // Limite de consultas por IP. Guarda só um hash do IP (nunca o documento nem o e-mail digitados) no log.
  const ip = ((await headers()).get("x-forwarded-for") ?? "").split(",")[0].trim() || "desconhecido";
  const key = hmac(env.TICKET_HMAC_SECRET, `ticket-lookup:${ip}`).slice(0, 24);
  const recent = await db.auditLog.count({
    where: { entity: "ticket_lookup", entityId: key, createdAt: { gte: new Date(Date.now() - WINDOW_MS) } },
  });
  if (recent >= MAX_LOOKUPS) return { error: "Muitas consultas seguidas. Aguarde alguns minutos e tente de novo." };
  await audit(db, { entity: "ticket_lookup", entityId: key, action: "search" });

  const tickets = await db.ticket.findMany({
    where: {
      status: { in: ["valid", "used"] },
      // Os dois dados precisam ser do mesmo pedido; quem só sabe o CPF ou o celular de alguém não vê nada.
      order: {
        status: "paid",
        buyerEmail: { equals: email, mode: "insensitive" },
        OR: [{ buyerCpfCnpj: digits }, { buyerPhone: digits }],
      },
    },
    include: { lot: true, seat: true, order: { select: { buyerName: true } }, event: { include: { artist: true } } },
    orderBy: [{ event: { startsAt: "asc" } }, { createdAt: "asc" }],
    take: 40,
  });

  const today = todayLocal();
  const groups = new Map<string, LookupGroup>();
  for (const t of tickets) {
    let g = groups.get(t.eventId);
    if (!g) {
      g = {
        eventId: t.eventId,
        showName: t.event.showName ?? "Evento",
        artist: t.event.artist.name,
        when: formatDateTime(t.event.startsAt),
        venue: [t.event.venueName, t.event.city && `${t.event.city}/${t.event.state}`].filter(Boolean).join(" · "),
        upcoming: !t.event.startsAt || toLocalDate(t.event.startsAt) >= today,
        tickets: [],
      };
      groups.set(t.eventId, g);
    }
    g.tickets.push({
      id: t.id,
      code: t.code,
      lot: t.lot.name,
      seat: t.seat ? `${t.seat.row}${t.seat.number}` : null,
      holder: shortName(t.order.buyerName),
      used: t.status === "used",
      usedAt: t.usedAt ? formatDateTime(t.usedAt) : null,
      qr: await QRCode.toDataURL(t.qrPayload, { margin: 1, width: 320, errorCorrectionLevel: "M" }),
    });
  }

  // Próximos shows primeiro (do mais perto ao mais longe); depois os que já passaram.
  const list = [...groups.values()];
  return { groups: [...list.filter((g) => g.upcoming), ...list.filter((g) => !g.upcoming).reverse()] };
}
