import "server-only";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { createReadStream } from "node:fs";
import path from "node:path";
import { del, put } from "@vercel/blob";
import { randomToken } from "./crypto";

// Storage de mídia com dois modos:
// - Vercel Blob (produção): ativo quando BLOB_READ_WRITE_TOKEN existe. URLs públicas na CDN do Blob.
// - Disco local (dev): grava em ./.uploads e serve por /media/<key>. Na Vercel o disco não persiste.

const ROOT = path.join(process.cwd(), ".uploads");

export function usesBlob() {
  return !!process.env.BLOB_READ_WRITE_TOKEN;
}

function resolveKey(key: string) {
  const full = path.join(ROOT, key);
  if (!full.startsWith(ROOT + path.sep)) throw new Error("Chave de storage inválida");
  return full;
}

export function mediaUrl(key: string) {
  return `/media/${key}`;
}

export function newKey(eventId: string, prefix: string, ext: string) {
  return `events/${eventId}/${prefix}-${randomToken(8)}.${ext}`;
}

/** Grava o arquivo e devolve a URL pública. */
export async function putObject(key: string, data: Buffer, contentType: string): Promise<string> {
  if (usesBlob()) {
    const blob = await put(key, data, { access: "public", contentType, addRandomSuffix: false, cacheControlMaxAge: 31536000 });
    return blob.url;
  }
  const full = resolveKey(key);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, data);
  return mediaUrl(key);
}

/** Aceita a chave (pathname) ou a URL do Blob. */
export async function deleteObject(keyOrUrl: string | null | undefined) {
  if (!keyOrUrl) return;
  if (usesBlob()) {
    await del(keyOrUrl).catch((err) => console.error("[storage] falha ao apagar", keyOrUrl, err));
    return;
  }
  await rm(resolveKey(keyOrUrl), { force: true });
}

// Leitura só existe no modo local (rota /media). No Blob a CDN serve direto.
export async function objectSize(key: string): Promise<number | null> {
  try {
    return (await stat(resolveKey(key))).size;
  } catch {
    return null;
  }
}

export function objectStream(key: string, range?: { start: number; end: number }) {
  return createReadStream(resolveKey(key), range);
}

export async function readObject(key: string) {
  return readFile(resolveKey(key));
}
