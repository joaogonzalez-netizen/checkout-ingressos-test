import "server-only";
import bcrypt from "bcryptjs";
import { randomInt } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { db } from "./db";
import { env } from "./env";
import { audit } from "./audit";
import { hmac, randomToken } from "./crypto";

// Conferência da portaria: um link por evento (/conferencia/<token>) + PIN de 6 números.
// A equipe não tem conta de admin: entra com o PIN, diz o nome, e só enxerga/valida ingressos daquele evento.

export const DOOR_COOKIE = "door";
const DOOR_TTL_SECONDS = 60 * 60 * 14;
const MAX_PIN_ATTEMPTS = 8;
const LOCK_MINUTES = 10;
/** O link vale até 24 h depois do fim do evento (ou do início, se não houver horário de término). */
const GRACE_MS = 24 * 60 * 60 * 1000;

export function doorUrl(token: string) {
  return `${env.APP_URL}/conferencia/${token}`;
}

function newPin() {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

/** Impressão digital do PIN: trocar o PIN invalida na hora as sessões abertas. */
function pinFingerprint(pinHash: string) {
  return hmac(env.SESSION_SECRET, `door-pin:${pinHash}`).slice(0, 16);
}

/** Um link ativo por evento: criar outro desativa o anterior. Devolve o PIN em texto, que só aparece agora. */
export async function createDoorAccess(eventId: string, userId: string) {
  const pin = newPin();
  const access = await db.$transaction(async (tx) => {
    await tx.checkinAccess.updateMany({ where: { eventId, revokedAt: null }, data: { revokedAt: new Date() } });
    return tx.checkinAccess.create({
      data: { eventId, token: randomToken(18), pinHash: await bcrypt.hash(pin, 10), createdBy: userId },
    });
  });
  await audit(db, { entity: "event", entityId: eventId, action: "door_link_created", userId });
  return { access, pin };
}

export async function rotateDoorPin(eventId: string, userId: string) {
  const current = await db.checkinAccess.findFirst({ where: { eventId, revokedAt: null }, orderBy: { createdAt: "desc" } });
  if (!current) return null;
  const pin = newPin();
  await db.checkinAccess.update({
    where: { id: current.id },
    data: { pinHash: await bcrypt.hash(pin, 10), failedAttempts: 0, lockedUntil: null },
  });
  await audit(db, { entity: "event", entityId: eventId, action: "door_pin_rotated", userId });
  return { access: current, pin };
}

export async function revokeDoorAccess(eventId: string, userId: string) {
  const res = await db.checkinAccess.updateMany({ where: { eventId, revokedAt: null }, data: { revokedAt: new Date() } });
  if (res.count) await audit(db, { entity: "event", entityId: eventId, action: "door_link_revoked", userId });
}

export function doorExpiresAt(event: { startsAt: Date | null; endsAt: Date | null }) {
  const base = event.endsAt ?? event.startsAt;
  return base ? new Date(base.getTime() + GRACE_MS) : null;
}

/** Link ativo: existe, não foi desativado, o evento não é rascunho e ainda não passou das 24 h pós-evento. */
export async function findUsableAccess(token: string) {
  if (!/^[A-Za-z0-9_-]{10,64}$/.test(token)) return null;
  const access = await db.checkinAccess.findUnique({ where: { token }, include: { event: true } });
  if (!access || access.revokedAt || access.event.status === "draft") return null;
  const expires = doorExpiresAt(access.event);
  if (expires && expires < new Date()) return null;
  return access;
}

export type PinResult = { ok: true; access: NonNullable<Awaited<ReturnType<typeof findUsableAccess>>> } | { ok: false; error: string };

export async function verifyDoorPin(token: string, pin: string): Promise<PinResult> {
  const access = await findUsableAccess(token);
  if (!access) return { ok: false, error: "Este link de conferência não está ativo." };
  if (access.lockedUntil && access.lockedUntil > new Date()) {
    const mins = Math.ceil((access.lockedUntil.getTime() - Date.now()) / 60_000);
    return { ok: false, error: `Muitas tentativas erradas. Tente de novo em ${mins} min.` };
  }
  const ok = /^\d{6}$/.test(pin) && (await bcrypt.compare(pin, access.pinHash));
  if (!ok) {
    const failed = access.failedAttempts + 1;
    const lock = failed >= MAX_PIN_ATTEMPTS;
    await db.checkinAccess.update({
      where: { id: access.id },
      data: { failedAttempts: lock ? 0 : failed, lockedUntil: lock ? new Date(Date.now() + LOCK_MINUTES * 60_000) : null },
    });
    return { ok: false, error: lock ? `Muitas tentativas erradas. Bloqueado por ${LOCK_MINUTES} min.` : "PIN incorreto." };
  }
  if (access.failedAttempts > 0) await db.checkinAccess.update({ where: { id: access.id }, data: { failedAttempts: 0, lockedUntil: null } });
  return { ok: true, access };
}

// --- sessão da portaria (cookie próprio, nunca vale como sessão de admin) ---

type DoorPayload = { typ: "door"; aid: string; eid: string; pf: string; name: string };

function key() {
  return new TextEncoder().encode(env.SESSION_SECRET);
}

export async function createDoorSession(access: { id: string; eventId: string; pinHash: string }, name: string) {
  const token = await new SignJWT({ typ: "door", aid: access.id, eid: access.eventId, pf: pinFingerprint(access.pinHash), name } satisfies DoorPayload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${DOOR_TTL_SECONDS}s`)
    .sign(key());
  (await cookies()).set(DOOR_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/conferencia",
    maxAge: DOOR_TTL_SECONDS,
  });
}

export async function clearDoorSession() {
  (await cookies()).delete({ name: DOOR_COOKIE, path: "/conferencia" });
}

/** Sessão válida para este link: cookie assinado + link ainda ativo + PIN que não mudou. */
export async function readDoorSession(token: string) {
  const raw = (await cookies()).get(DOOR_COOKIE)?.value;
  if (!raw) return null;
  let payload: Partial<DoorPayload>;
  try {
    payload = (await jwtVerify(raw, key(), { algorithms: ["HS256"] })).payload as Partial<DoorPayload>;
  } catch {
    return null;
  }
  if (payload.typ !== "door" || typeof payload.aid !== "string" || typeof payload.name !== "string") return null;
  const access = await findUsableAccess(token);
  if (!access || access.id !== payload.aid || access.eventId !== payload.eid || pinFingerprint(access.pinHash) !== payload.pf) return null;
  return { access, event: access.event, eventId: access.eventId, name: payload.name };
}
