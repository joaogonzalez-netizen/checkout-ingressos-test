import "server-only";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { createReadStream } from "node:fs";
import path from "node:path";
import { randomToken } from "./crypto";

// Storage de mídia. Em dev grava em ./.uploads e serve por /media/<key>.
// PENDENTE (produção): trocar por storage de objetos + CDN (S3/R2), mantendo a mesma interface.
// Em serverless (Vercel) o disco não persiste, então este driver local só serve para dev.

const ROOT = path.join(process.cwd(), ".uploads");

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

export async function putObject(key: string, data: Buffer) {
  const full = resolveKey(key);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, data);
}

export async function deleteObject(key: string | null | undefined) {
  if (!key) return;
  await rm(resolveKey(key), { force: true });
}

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
