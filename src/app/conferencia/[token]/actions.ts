"use server";

import { redirect } from "next/navigation";
import { checkIn } from "@/lib/checkin";
import { clearDoorSession, createDoorSession, readDoorSession, verifyDoorPin } from "@/lib/door";
import { doorOrder, doorStats, findForDoor, type DoorFind, type DoorOrder, type DoorStats } from "@/lib/door-orders";

export type EnterState = { error?: string; name?: string };

/** Entrada da equipe: nome (fica no registro de cada entrada) + PIN do evento. */
export async function enterDoor(token: string, _prev: EnterState, form: FormData): Promise<EnterState> {
  const name = String(form.get("name") ?? "").trim().replace(/\s+/g, " ");
  const pin = String(form.get("pin") ?? "").replace(/\D/g, "");
  if (name.length < 2) return { error: "Informe seu nome: ele aparece no registro de cada entrada.", name };
  const res = await verifyDoorPin(token, pin);
  if (!res.ok) return { error: res.error, name };
  await createDoorSession(res.access, name.slice(0, 60));
  redirect(`/conferencia/${token}`);
}

export async function leaveDoor(token: string) {
  await clearDoorSession();
  redirect(`/conferencia/${token}`);
}

export type Expired = { expired: true };
export type FindResponse = { find: DoorFind; stats: DoorStats } | Expired;
export type OpenResponse = { order: DoorOrder | null; stats: DoorStats } | Expired;
export type ReleaseResponse =
  | {
      order: DoorOrder | null;
      stats: DoorStats;
      released: { code: string }[];
      rejected: { code: string; reason: "used" | "canceled" | "invalid"; usedAt: string | null; usedBy: string | null }[];
    }
  | Expired;

/** QR, código de 4 caracteres, nome ou telefone → a compra inteira (ou a lista de compras que combinam). */
export async function doorFind(token: string, query: string): Promise<FindResponse> {
  const s = await readDoorSession(token);
  if (!s) return { expired: true };
  return { find: await findForDoor(s.eventId, query.slice(0, 200)), stats: await doorStats(s.eventId) };
}

export async function doorOpen(token: string, orderId: string): Promise<OpenResponse> {
  const s = await readDoorSession(token);
  if (!s) return { expired: true };
  return { order: await doorOrder(s.eventId, orderId), stats: await doorStats(s.eventId) };
}

/**
 * Libera os ingressos marcados da compra. Cada um passa pelo mesmo checkIn() da conferência do admin:
 * um UPDATE condicional decide o "já utilizado", então dois celulares na porta nunca liberam o mesmo ingresso.
 */
export async function doorRelease(token: string, orderId: string, ticketIds: string[], how: "qr" | "code" | "list"): Promise<ReleaseResponse> {
  const s = await readDoorSession(token);
  if (!s) return { expired: true };
  const order = await doorOrder(s.eventId, orderId);
  const ownIds = new Set(order?.tickets.map((t) => t.id) ?? []);
  const ids = [...new Set(ticketIds)].filter((id) => ownIds.has(id)).slice(0, 100);
  const method = how === "qr" || how === "code" ? how : "list";

  const released: { code: string }[] = [];
  const rejected: { code: string; reason: "used" | "canceled" | "invalid"; usedAt: string | null; usedBy: string | null }[] = [];
  for (const ticketId of ids) {
    const r = await checkIn({ eventId: s.eventId, ticketId, method, usedBy: `Porta · ${s.name}`, userId: null });
    if (r.ok) released.push({ code: r.code });
    else {
      const t = order?.tickets.find((x) => x.id === ticketId);
      rejected.push({
        code: t?.code ?? "?",
        reason: r.reason === "used" || r.reason === "canceled" ? r.reason : "invalid",
        usedAt: r.usedAt ? r.usedAt.toISOString() : null,
        usedBy: r.usedBy ?? null,
      });
    }
  }
  return { order: await doorOrder(s.eventId, orderId), stats: await doorStats(s.eventId), released, rejected };
}
