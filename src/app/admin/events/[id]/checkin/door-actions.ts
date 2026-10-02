"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createDoorAccess, doorUrl, revokeDoorAccess, rotateDoorPin } from "@/lib/door";
import { db } from "@/lib/db";

export type DoorLinkState = { pin?: string; url?: string; error?: string };

async function usableEvent(eventId: string) {
  const event = await db.event.findUnique({ where: { id: eventId }, select: { status: true } });
  return event && event.status !== "draft" ? event : null;
}

/** Cria o link da portaria (desativa o anterior). O PIN em texto só é mostrado agora. */
export async function createDoorLink(eventId: string, _prev: DoorLinkState): Promise<DoorLinkState> {
  const user = await requireAdmin();
  if (!(await usableEvent(eventId))) return { error: "Publique o evento antes de criar o link da portaria." };
  const { access, pin } = await createDoorAccess(eventId, user.id);
  revalidatePath(`/admin/events/${eventId}/checkin`);
  return { pin, url: doorUrl(access.token) };
}

/** Novo PIN: quem estava conectado com o PIN antigo é desconectado na hora. */
export async function rotateDoorPinAction(eventId: string, _prev: DoorLinkState): Promise<DoorLinkState> {
  const user = await requireAdmin();
  const res = await rotateDoorPin(eventId, user.id);
  if (!res) return { error: "Não há link ativo. Crie um link primeiro." };
  revalidatePath(`/admin/events/${eventId}/checkin`);
  return { pin: res.pin, url: doorUrl(res.access.token) };
}

export async function revokeDoorLink(eventId: string) {
  const user = await requireAdmin();
  await revokeDoorAccess(eventId, user.id);
  revalidatePath(`/admin/events/${eventId}/checkin`);
}
