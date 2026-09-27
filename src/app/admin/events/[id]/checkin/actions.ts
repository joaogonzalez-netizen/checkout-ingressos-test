"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { checkIn, resolveEntry, undoCheckIn, type CheckinResult } from "@/lib/checkin";
import { createTestAttendees } from "@/lib/dev-fixtures";

export type ValidateState = { result?: CheckinResult; at?: number };

function operatorLabel(user: { name: string; email: string }) {
  return user.name && user.name !== "Admin" ? user.name : user.email;
}

/** Caixa "Validar entrada": código de 4 caracteres ou QR (colado ou lido por leitor USB). */
export async function validateEntry(eventId: string, _prev: ValidateState, form: FormData): Promise<ValidateState> {
  const user = await requireAdmin();
  const entry = await resolveEntry(eventId, String(form.get("entry") ?? ""));
  const result = "ok" in entry ? entry : await checkIn({ eventId, ticketId: entry.ticketId, method: entry.method, usedBy: operatorLabel(user), userId: user.id });
  revalidatePath(`/admin/events/${eventId}/checkin`);
  return { result, at: Date.now() };
}

/** Botão "Fazer check-in" da lista. v1: só admin (a regra "só Supervisor" entra com os perfis). */
export async function checkInFromList(eventId: string, ticketId: string) {
  const user = await requireAdmin();
  await checkIn({ eventId, ticketId, method: "list", usedBy: operatorLabel(user), userId: user.id });
  revalidatePath(`/admin/events/${eventId}/checkin`);
}

export async function undoFromList(eventId: string, ticketId: string, form: FormData) {
  const user = await requireAdmin();
  const reason = String(form.get("reason") ?? "").trim();
  if (reason.length < 3) return;
  await undoCheckIn({ eventId, ticketId, reason, userId: user.id });
  revalidatePath(`/admin/events/${eventId}/checkin`);
}

export async function generateTestAttendees(eventId: string) {
  await requireAdmin();
  await createTestAttendees(eventId, 10);
  revalidatePath(`/admin/events/${eventId}`, "layout");
}
