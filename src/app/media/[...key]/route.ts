import { Readable } from "node:stream";
import type { NextRequest } from "next/server";
import { objectSize, objectStream } from "@/lib/storage";

const TYPES: Record<string, string> = {
  webp: "image/webp",
  jpg: "image/jpeg",
  png: "image/png",
  mp4: "video/mp4",
  mov: "video/quicktime",
};

/** Serve arquivos do storage local. Suporta Range, exigido pelo Safari/iOS para tocar vídeo. */
export async function GET(req: NextRequest, ctx: RouteContext<"/media/[...key]">) {
  const { key: parts } = await ctx.params;
  const key = parts.join("/");
  const size = await objectSize(key).catch(() => null);
  if (size === null) return new Response("Not found", { status: 404 });

  const type = TYPES[key.split(".").pop() ?? ""] ?? "application/octet-stream";
  // Chaves têm sufixo aleatório: o conteúdo de uma chave nunca muda.
  const headers: Record<string, string> = {
    "Content-Type": type,
    "Accept-Ranges": "bytes",
    "Cache-Control": "public, max-age=31536000, immutable",
  };

  const range = req.headers.get("range")?.match(/^bytes=(\d*)-(\d*)$/);
  if (range) {
    let start = range[1] ? Number(range[1]) : size - Number(range[2]);
    let end = range[1] && range[2] ? Number(range[2]) : size - 1;
    if (!range[1]) end = size - 1;
    start = Math.max(0, start);
    end = Math.min(end, size - 1);
    if (start > end) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
    const stream = Readable.toWeb(objectStream(key, { start, end })) as ReadableStream;
    return new Response(stream, {
      status: 206,
      headers: { ...headers, "Content-Range": `bytes ${start}-${end}/${size}`, "Content-Length": String(end - start + 1) },
    });
  }
  const stream = Readable.toWeb(objectStream(key)) as ReadableStream;
  return new Response(stream, { headers: { ...headers, "Content-Length": String(size) } });
}
