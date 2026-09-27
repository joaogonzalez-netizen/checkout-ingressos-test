import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { authorizeAdminApi, badRequest } from "@/lib/admin-api";
import { ImageError, processImage } from "@/lib/image-processing";
import { deleteObject, mediaUrl, putObject } from "@/lib/storage";
import { randomToken } from "@/lib/crypto";
import type { ImageKind } from "@/lib/media-rules";

// Imagens do artista: logo e os padrões herdados pelos eventos (header e og:image).
const COLUMNS = {
  logo: { url: "logoUrl", key: "logoKey" },
  cover: { url: "defaultCoverUrl", key: "defaultCoverKey" },
  cover_mobile: { url: "defaultCoverMobileUrl", key: "defaultCoverMobileKey" },
  og_image: { url: "defaultOgImageUrl", key: "defaultOgImageKey" },
} as const satisfies Record<ImageKind, { url: string; key: string }>;

function isKind(v: string | null): v is ImageKind {
  return !!v && v in COLUMNS;
}

export async function POST(req: NextRequest, ctx: RouteContext<"/api/admin/artists/[id]/media">) {
  const auth = await authorizeAdminApi();
  if ("error" in auth) return auth.error;
  const { id } = await ctx.params;
  const artist = await db.artist.findUnique({ where: { id } });
  if (!artist) return NextResponse.json({ error: "Artista não encontrado." }, { status: 404 });

  const form = await req.formData().catch(() => null);
  const kind = String(form?.get("kind") ?? "");
  const file = form?.get("file");
  if (!isKind(kind)) return badRequest("Tipo de imagem inválido.");
  if (!(file instanceof File) || file.size === 0) return badRequest("Selecione um arquivo.");

  let img;
  try {
    img = await processImage(file, kind);
  } catch (err) {
    if (err instanceof ImageError) return badRequest(err.message);
    throw err;
  }
  const key = `artists/${id}/${kind}-${randomToken(8)}.${img.ext}`;
  await putObject(key, img.data);
  const col = COLUMNS[kind];
  const url = mediaUrl(key);
  try {
    await db.artist.update({ where: { id }, data: { [col.url]: url, [col.key]: key } });
  } catch (err) {
    await deleteObject(key); // não deixa arquivo órfão no storage
    throw err;
  }
  await deleteObject(artist[col.key]);
  await audit(db, { entity: "artist", entityId: id, action: `image_${kind}_uploaded`, before: { url: artist[col.url] }, after: { url }, userId: auth.user.id });
  return NextResponse.json({ url, warning: img.warning }, { status: 201 });
}

export async function DELETE(req: NextRequest, ctx: RouteContext<"/api/admin/artists/[id]/media">) {
  const auth = await authorizeAdminApi();
  if ("error" in auth) return auth.error;
  const { id } = await ctx.params;
  const kind = req.nextUrl.searchParams.get("kind");
  if (!isKind(kind)) return badRequest("Tipo de imagem inválido.");
  const artist = await db.artist.findUnique({ where: { id } });
  if (!artist) return NextResponse.json({ error: "Artista não encontrado." }, { status: 404 });
  const col = COLUMNS[kind];
  await db.artist.update({ where: { id }, data: { [col.url]: null, [col.key]: null } });
  await deleteObject(artist[col.key]);
  await audit(db, { entity: "artist", entityId: id, action: `image_${kind}_removed`, before: { url: artist[col.url] }, userId: auth.user.id });
  return NextResponse.json({ removed: true });
}
