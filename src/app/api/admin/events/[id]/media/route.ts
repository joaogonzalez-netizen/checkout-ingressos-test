import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { authorizeAdminApi, badRequest } from "@/lib/admin-api";
import { ImageError, processImage } from "@/lib/image-processing";
import { deleteObject, newKey, putObject, usesBlob } from "@/lib/storage";
import { head } from "@vercel/blob";
import { IMAGE_SPECS, VIDEO_MAX_BYTES, VIDEO_MAX_SECONDS, VIDEO_TYPES, formatDuration, formatMB, isReelsFormat } from "@/lib/media-rules";
import sharp from "sharp";

// Fica fora do matcher do proxy de propósito: o proxy limita o corpo a 10 MB e o vídeo vai até 100 MB.

type Kind = "cover" | "cover_mobile" | "og_image" | "video";
const KINDS: Kind[] = ["cover", "cover_mobile", "og_image", "video"];

/** MP4 e MOV são contêineres ISO BMFF: bytes 4–7 = "ftyp". */
function looksLikeIsoVideo(buf: Buffer) {
  return buf.length > 12 && buf.subarray(4, 8).toString("latin1") === "ftyp";
}

async function loadEvent(id: string) {
  return db.event.findUnique({ where: { id } });
}

/** Remove a mídia atual do tipo (arquivo + registro). og_image fica em colunas do evento. */
async function clearKind(eventId: string, kind: Kind) {
  if (kind === "og_image") {
    const e = await db.event.findUniqueOrThrow({ where: { id: eventId } });
    await db.event.update({ where: { id: eventId }, data: { ogImageUrl: null, ogImageKey: null } });
    await deleteObject(e.ogImageKey);
    return e.ogImageUrl ? [e.ogImageUrl] : [];
  }
  const old = await db.eventMedia.findMany({ where: { eventId, kind } });
  await db.eventMedia.deleteMany({ where: { eventId, kind } });
  await Promise.all(old.flatMap((m) => [deleteObject(m.storageKey), deleteObject(m.posterKey)]));
  return old.map((m) => m.url);
}

export async function POST(req: NextRequest, ctx: RouteContext<"/api/admin/events/[id]/media">) {
  const auth = await authorizeAdminApi();
  if ("error" in auth) return auth.error;
  const { id } = await ctx.params;
  const event = await loadEvent(id);
  if (!event) return NextResponse.json({ error: "Evento não encontrado." }, { status: 404 });

  const form = await req.formData().catch(() => null);
  if (!form) return badRequest("Envio inválido.");
  const kind = String(form.get("kind") ?? "") as Kind;
  if (!KINDS.includes(kind)) return badRequest("Tipo de mídia inválido.");
  const file = form.get("file");
  if (kind !== "video" && (!(file instanceof File) || file.size === 0)) return badRequest("Selecione um arquivo.");

  let url: string;
  let warning: string | undefined;
  // Arquivos gravados nesta requisição; apagados se o registro no banco falhar.
  const written: string[] = [];
  const put = async (key: string, data: Buffer, contentType: string) => {
    const url = await putObject(key, data, contentType);
    written.push(key);
    return url;
  };

  try {
    if (kind === "video") {
      const width = Number(form.get("width"));
      const height = Number(form.get("height"));
      const duration = Number(form.get("duration"));
      if (!(width > 0 && height > 0)) return badRequest("Não foi possível ler as dimensões do vídeo.");
      if (!isReelsFormat(width, height)) return badRequest(`O vídeo tem ${width} × ${height}. Use o formato Reels: em pé, 9:16 (1080 × 1920).`);
      // A duração vem da leitura do navegador; o servidor confere o limite.
      if (!(duration > 0) || duration > VIDEO_MAX_SECONDS + 0.5) return badRequest(`O vídeo precisa ter até ${formatDuration(VIDEO_MAX_SECONDS)}.`);

      let key: string;
      let videoUrl: string;
      let mime: string;
      let size: number;
      const blobUrl = String(form.get("blobUrl") ?? "");
      if (blobUrl) {
        // Na Vercel o vídeo sobe direto do navegador para o Blob (limite de 4,5 MB por requisição
        // nas funções). Aqui só conferimos o arquivo que chegou e registramos.
        if (!usesBlob()) return badRequest("Upload direto indisponível neste ambiente.");
        const info = await head(blobUrl).catch(() => null);
        if (!info || !info.pathname.startsWith(`events/${id}/video-`)) return badRequest("Vídeo não encontrado no storage.");
        const cleanup = () => deleteObject(info.url);
        if (!VIDEO_TYPES.includes(info.contentType)) return (await cleanup(), badRequest("Use MP4 (H.264) ou MOV."));
        if (info.size > VIDEO_MAX_BYTES) return (await cleanup(), badRequest(`O vídeo tem ${formatMB(info.size)}; o limite é ${formatMB(VIDEO_MAX_BYTES)}.`));
        const headBytes = Buffer.from(await (await fetch(info.url, { headers: { Range: "bytes=0-15" } })).arrayBuffer());
        if (!looksLikeIsoVideo(headBytes)) return (await cleanup(), badRequest("O arquivo não parece ser um vídeo MP4/MOV."));
        key = info.url;
        videoUrl = info.url;
        mime = info.contentType;
        size = info.size;
        written.push(info.url);
      } else {
        const file = form.get("file");
        if (!(file instanceof File) || file.size === 0) return badRequest("Selecione um arquivo.");
        if (!VIDEO_TYPES.includes(file.type)) return badRequest("Use MP4 (H.264) ou MOV.");
        if (file.size > VIDEO_MAX_BYTES) return badRequest(`O vídeo tem ${formatMB(file.size)}; o limite é ${formatMB(VIDEO_MAX_BYTES)}.`);
        const data = Buffer.from(await file.arrayBuffer());
        if (!looksLikeIsoVideo(data)) return badRequest("O arquivo não parece ser um vídeo MP4/MOV.");
        key = newKey(id, "video", file.type === "video/quicktime" ? "mov" : "mp4");
        videoUrl = await put(key, data, file.type);
        mime = file.type;
        size = data.length;
      }

      let posterKey: string | null = null;
      let posterUrl: string | null = null;
      const poster = form.get("poster");
      if (poster instanceof File && poster.size > 0 && poster.size <= 5 * 1024 * 1024) {
        try {
          const img = await sharp(Buffer.from(await poster.arrayBuffer())).resize({ width: 1080, withoutEnlargement: true }).webp({ quality: 80 }).toBuffer();
          posterKey = newKey(id, "poster", "webp");
          posterUrl = await put(posterKey, img, "image/webp");
        } catch {
          posterKey = null;
        }
      }
      await clearKind(id, "video");
      const media = await db.eventMedia.create({
        data: {
          eventId: id,
          kind: "video",
          storageKey: key,
          url: videoUrl,
          posterKey,
          posterUrl,
          mime,
          sizeBytes: size,
          width,
          height,
          durationSeconds: duration,
        },
      });
      url = media.url;
    } else {
      if (!(file instanceof File)) return badRequest("Selecione um arquivo.");
      let img;
      try {
        img = await processImage(file, kind);
      } catch (err) {
        if (err instanceof ImageError) return badRequest(err.message);
        throw err;
      }
      warning = img.warning;
      const key = newKey(id, kind, img.ext);
      url = await put(key, img.data, img.mime);
      await clearKind(id, kind);
      if (kind === "og_image") {
        await db.event.update({ where: { id }, data: { ogImageUrl: url, ogImageKey: key } });
      } else {
        await db.eventMedia.create({
          data: { eventId: id, kind, storageKey: key, url, mime: img.mime, sizeBytes: img.data.length, width: img.width, height: img.height },
        });
      }
    }
  } catch (err) {
    await Promise.all(written.map((k) => deleteObject(k)));
    throw err;
  }

  if (event.status !== "draft") {
    await audit(db, { entity: "event", entityId: id, action: `media_${kind}_uploaded`, after: { url }, userId: auth.user.id });
  }
  return NextResponse.json({ url, warning }, { status: 201 });
}

export async function DELETE(req: NextRequest, ctx: RouteContext<"/api/admin/events/[id]/media">) {
  const auth = await authorizeAdminApi();
  if ("error" in auth) return auth.error;
  const { id } = await ctx.params;
  const event = await loadEvent(id);
  if (!event) return NextResponse.json({ error: "Evento não encontrado." }, { status: 404 });
  const kind = req.nextUrl.searchParams.get("kind") as Kind;
  if (!KINDS.includes(kind)) return badRequest("Tipo de mídia inválido.");
  const removed = await clearKind(id, kind);
  if (removed.length && event.status !== "draft") {
    await audit(db, { entity: "event", entityId: id, action: `media_${kind}_removed`, before: { url: removed[0] }, userId: auth.user.id });
  }
  return NextResponse.json({ removed: removed.length, spec: IMAGE_SPECS[kind as keyof typeof IMAGE_SPECS]?.title });
}
