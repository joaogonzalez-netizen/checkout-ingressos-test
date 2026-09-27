"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { createSession, deleteSession } from "@/lib/session";

// Hash descartável: compara mesmo sem usuário, para não vazar quais e-mails existem pelo tempo de resposta.
const DUMMY_HASH = bcrypt.hashSync("dummy-password", 10);

/** Tentativas erradas seguidas antes do bloqueio, e duração do bloqueio. */
const MAX_FAILED_LOGINS = 5;
const LOCK_MINUTES = 15;

export type LoginState = { error?: string; email?: string };

export async function login(_prev: LoginState, form: FormData): Promise<LoginState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  const next = String(form.get("next") ?? "");
  const generic = { error: "E-mail ou senha incorretos.", email };

  const user = await db.user.findUnique({ where: { email } });
  const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user) return generic;

  if (user.lockedUntil && user.lockedUntil > new Date()) {
    const minutes = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60_000);
    return { error: `Muitas tentativas erradas. Tente de novo em ${minutes} min.`, email };
  }
  if (!ok) {
    const failed = user.failedLoginCount + 1;
    const lock = failed >= MAX_FAILED_LOGINS;
    await db.user.update({
      where: { id: user.id },
      data: { failedLoginCount: lock ? 0 : failed, lockedUntil: lock ? new Date(Date.now() + LOCK_MINUTES * 60_000) : null },
    });
    if (lock) {
      await audit(db, { entity: "user", entityId: user.id, action: "locked_after_failed_logins", after: { minutes: LOCK_MINUTES } });
      return { error: `Muitas tentativas erradas. Conta bloqueada por ${LOCK_MINUTES} min.`, email };
    }
    return generic;
  }
  // Conta desativada responde igual a senha errada: não confirma que o e-mail existe.
  if (!user.active) return generic;

  await db.user.update({ where: { id: user.id }, data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() } });
  await createSession({ userId: user.id, role: user.role, sv: user.sessionVersion });
  if (user.mustChangePassword) redirect("/trocar-senha");
  // Só caminhos internos do backoffice (evita open redirect).
  redirect(/^\/(admin|preview)(\/|$)/.test(next) ? next : "/admin");
}

export async function logout() {
  await deleteSession();
  redirect("/login");
}
