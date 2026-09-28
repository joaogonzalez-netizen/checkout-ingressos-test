import { NextResponse, type NextRequest } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { db } from "@/lib/db";
import { authorizeAdminApi } from "@/lib/admin-api";
import { usesBlob } from "@/lib/storage";
import { VIDEO_MAX_BYTES, VIDEO_TYPES } from "@/lib/media-rules";

/**
 * Token de upload direto navegador → Vercel Blob, só para o vídeo (até 100 MB; as funções da Vercel
 * aceitam no máximo 4,5 MB por requisição). O registro do vídeo acontece depois, na rota de mídia.
 */
export async function POST(req: NextRequest, ctx: RouteContext<"/api/admin/events/[id]/media/upload-token">) {
  if (!usesBlob()) return NextResponse.json({ error: "Upload direto indisponível neste ambiente." }, { status: 400 });
  const { id } = await ctx.params;
  const body = (await req.json()) as HandleUploadBody;
  try {
    const result = await handleUpload({
      request: req,
      body,
      onBeforeGenerateToken: async (pathname) => {
        const auth = await authorizeAdminApi();
        if ("error" in auth) throw new Error("Sem permissão.");
        if (!(await db.event.findUnique({ where: { id }, select: { id: true } }))) throw new Error("Evento não encontrado.");
        if (!pathname.startsWith(`events/${id}/video-`)) throw new Error("Caminho de upload inválido.");
        return { allowedContentTypes: VIDEO_TYPES, maximumSizeInBytes: VIDEO_MAX_BYTES, addRandomSuffix: true };
      },
    });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Falha no upload." }, { status: 400 });
  }
}
