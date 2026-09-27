"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { audit, diff } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth";
import { isValidCNPJ, isValidMobile, onlyDigits } from "@/lib/documents";

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
