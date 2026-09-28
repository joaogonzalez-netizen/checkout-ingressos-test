"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { audit, diff } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth";
import { isValidCNPJ, isValidMobile, onlyDigits } from "@/lib/documents";
import { env } from "@/lib/env";
import { deleteObject } from "@/lib/storage";

export type SettingsState = { error?: string; saved?: boolean };

export async function saveSettings(_prev: SettingsState, form: FormData): Promise<SettingsState> {
  const user = await requireAdmin();
  const text = (k: string) => String(form.get(k) ?? "").trim() || null;
  const data = {
    sellerName: text("sellerName"),
    sellerCnpj: text("sellerCnpj") ? onlyDigits(text("sellerCnpj")!) : null,
    sellerAddress: text("sellerAddress"),
    contactEmail: text("contactEmail")?.toLowerCase() ?? null,
    contactWhatsapp: text("contactWhatsapp") ? onlyDigits(text("contactWhatsapp")!) : null,
    halfPriceText: text("halfPriceText"),
    cancellationText: text("cancellationText"),
    feeText: text("feeText"),
  };
  if (data.sellerCnpj && !isValidCNPJ(data.sellerCnpj)) return { error: "CNPJ inválido." };
  if (data.contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.contactEmail)) return { error: "E-mail de contato inválido." };
  if (data.contactWhatsapp && !isValidMobile(data.contactWhatsapp)) return { error: "WhatsApp inválido: use DDD + número de celular." };

  const before = await db.platformSettings.findUnique({ where: { id: "default" } });
  await db.platformSettings.upsert({ where: { id: "default" }, create: { id: "default", ...data }, update: data });
  const changes = before ? diff(before as unknown as Record<string, unknown>, data) : { before: null, after: data };
  if (changes) await audit(db, { entity: "settings", entityId: "default", action: "updated", ...changes, userId: user.id });
  revalidatePath("/", "layout");
  return { saved: true };
}

export type ResetState = { error?: string; done?: string };

/**
 * Só no ambiente de teste: apaga artistas, eventos, pedidos, ingressos e mídias para recomeçar.
 * Mantém usuários, configurações e o log de auditoria.
 */
export async function resetDemoData(_prev: ResetState, form: FormData): Promise<ResetState> {
  const user = await requireAdmin();
  if (!env.ASAAS_MOCK) return { error: "Disponível só no ambiente de teste." };
  if (String(form.get("confirm") ?? "").trim().toUpperCase() !== "LIMPAR") return { error: 'Digite LIMPAR para confirmar.' };

  const [artists, events, media] = await Promise.all([
    db.artist.findMany({ select: { logoKey: true, defaultCoverKey: true, defaultCoverMobileKey: true, defaultOgImageKey: true } }),
    db.event.findMany({ select: { ogImageKey: true } }),
    db.eventMedia.findMany({ select: { storageKey: true, posterKey: true } }),
  ]);
  const keys = [
    ...artists.flatMap((a) => [a.logoKey, a.defaultCoverKey, a.defaultCoverMobileKey, a.defaultOgImageKey]),
    ...events.map((e) => e.ogImageKey),
    ...media.flatMap((m) => [m.storageKey, m.posterKey]),
  ];
  const counts = { artistas: artists.length, eventos: events.length, pedidos: await db.order.count() };

  await db.$transaction([
    db.ticket.deleteMany(),
    db.orderItem.deleteMany(),
    db.order.deleteMany(),
    db.webhookEvent.deleteMany(),
    db.mockPayment.deleteMany(),
    db.event.deleteMany(), // lotes, poltronas, mídias e acessos de check-in saem em cascata
    db.artist.deleteMany(),
  ]);
  await Promise.all(keys.map((k) => deleteObject(k)));
  await audit(db, { entity: "settings", entityId: "default", action: "demo_data_reset", after: counts, userId: user.id });
  revalidatePath("/", "layout");
  return { done: `Dados de teste apagados: ${counts.artistas} artista(s), ${counts.eventos} evento(s) e ${counts.pedidos} pedido(s).` };
}
