"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { encrypt } from "@/lib/crypto";
import { isHexColor } from "@/lib/palette";
import { SLUG_PATTERN, slugify } from "@/lib/slug";
import { audit, diff } from "@/lib/audit";
import { deleteObject } from "@/lib/storage";

export type ArtistFormState = { error?: string; saved?: boolean };

const optionalUrl = z
  .string()
  .trim()
  .transform((v) => v || null)
  .refine((v) => v === null || /^https?:\/\//.test(v), "Use um link completo, começando com https://");

const schema = z.object({
  name: z.string().trim().min(2, "Informe o nome do artista").max(80),
  slug: z.string().trim().regex(SLUG_PATTERN, "Slug só pode ter letras minúsculas, números e hífen"),
  backLinkUrl: optionalUrl,
  primary: z.string().refine(isHexColor),
  secondary: z.string().refine(isHexColor),
  accent: z.string().refine(isHexColor),
  background: z.string().refine(isHexColor),
  metaPixelId: z
    .string()
    .trim()
    .transform((v) => v || null)
    .refine((v) => v === null || /^\d{6,20}$/.test(v), "O Pixel ID tem só números"),
  metaCapiToken: z.string().trim(),
  clearCapiToken: z.string().optional(),
  defaultShowName: z.string().trim().max(120).transform((v) => v || null),
  defaultVslSubtitle: z.string().trim().max(400).transform((v) => v || null),
});

export async function saveArtist(artistId: string | null, _prev: ArtistFormState, form: FormData): Promise<ArtistFormState> {
  const user = await requireAdmin();
  const raw = Object.fromEntries(form.entries());
  const parsed = schema.safeParse({ ...raw, slug: raw.slug || slugify(String(raw.name ?? "")) });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  const v = parsed.data;

  const clash = await db.artist.findFirst({ where: { slug: v.slug, NOT: artistId ? { id: artistId } : undefined } });
  if (clash) return { error: "Já existe um artista com esse slug." };

  const data = {
    name: v.name,
    slug: v.slug,
    backLinkUrl: v.backLinkUrl,
    colors: { primary: v.primary, secondary: v.secondary, accent: v.accent, background: v.background },
    metaPixelId: v.metaPixelId,
    defaultShowName: v.defaultShowName,
    defaultVslSubtitle: v.defaultVslSubtitle,
    // Token só é trocado quando um novo é digitado; nunca é devolvido ao formulário.
    ...(v.metaCapiToken ? { metaCapiTokenEnc: encrypt(v.metaCapiToken) } : {}),
    ...(v.clearCapiToken ? { metaCapiTokenEnc: null } : {}),
  };

  if (!artistId) {
    const created = await db.artist.create({ data });
    await audit(db, { entity: "artist", entityId: created.id, action: "created", userId: user.id });
    redirect(`/admin/artists/${created.id}?created=1`);
  }

  const before = await db.artist.findUniqueOrThrow({ where: { id: artistId } });
  await db.artist.update({ where: { id: artistId }, data });
  // O token nunca vai para o log, nem criptografado.
  const safe: Record<string, unknown> = { ...data };
  delete safe.metaCapiTokenEnc;
  const changes = diff(before as unknown as Record<string, unknown>, safe);
  if (changes || v.metaCapiToken || v.clearCapiToken) {
    await audit(db, {
      entity: "artist",
      entityId: artistId,
      action: "updated",
      ...changes,
      after: { ...(changes?.after ?? {}), ...(v.metaCapiToken || v.clearCapiToken ? { metaCapiToken: "(alterado)" } : {}) },
      userId: user.id,
    });
  }
  revalidatePath(`/admin/artists/${artistId}`);
  return { saved: true };
}

// Desativar / reativar / excluir ------------------------------------------------------------

export async function setArtistArchived(artistId: string, archived: boolean) {
  const user = await requireAdmin();
  await db.artist.update({ where: { id: artistId }, data: { archivedAt: archived ? new Date() : null } });
  await audit(db, { entity: "artist", entityId: artistId, action: archived ? "archived" : "unarchived", userId: user.id });
  revalidatePath("/admin/artists");
  revalidatePath(`/admin/artists/${artistId}`);
}

export type DeleteArtistState = { error?: string };

/**
 * Exclusão definitiva. Só quando nenhum evento do artista tem pedido: pedido é registro financeiro
 * (conciliação com a Asaas) e não pode sumir. Nesse caso, a saída é desativar.
 */
export async function deleteArtist(artistId: string, _prev: DeleteArtistState, form: FormData): Promise<DeleteArtistState> {
  const user = await requireAdmin();
  const artist = await db.artist.findUnique({
    where: { id: artistId },
    include: { events: { include: { media: true, _count: { select: { orders: true } } } } },
  });
  if (!artist) return { error: "Artista não encontrado." };
  if (String(form.get("confirmName") ?? "").trim() !== artist.name) {
    return { error: `Digite exatamente "${artist.name}" para confirmar.` };
  }
  const withOrders = artist.events.filter((e) => e._count.orders > 0);
  if (withOrders.length) {
    return { error: `Não dá para excluir: ${withOrders.length} evento(s) já têm pedidos. Desative o artista.` };
  }

  const keys = [
    artist.logoKey,
    artist.defaultCoverKey,
    artist.defaultCoverMobileKey,
    artist.defaultOgImageKey,
    ...artist.events.flatMap((e) => [e.ogImageKey, ...e.media.flatMap((m) => [m.storageKey, m.posterKey])]),
  ];
  // Lotes, poltronas, mídias e acessos de check-in saem em cascata com o evento.
  await db.$transaction([
    db.event.deleteMany({ where: { artistId } }),
    db.artist.delete({ where: { id: artistId } }),
  ]);
  await Promise.all(keys.map((k) => deleteObject(k)));
  await audit(db, {
    entity: "artist",
    entityId: artistId,
    action: "deleted",
    before: { name: artist.name, slug: artist.slug, events: artist.events.map((e) => e.slug ?? e.id) },
    userId: user.id,
  });
  revalidatePath("/admin/artists");
  redirect("/admin/artists?deleted=1");
}
