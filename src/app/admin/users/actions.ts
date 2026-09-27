"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { requireAdmin, requireUser } from "@/lib/auth";
import { createSession } from "@/lib/session";
import { isStrongPassword } from "@/lib/password-policy";

const BCRYPT_COST = 12;

export type UserFormState = { error?: string; ok?: string };

/** Cadastro por um admin: a senha é temporária e a pessoa troca no primeiro acesso. */
export async function createUser(_prev: UserFormState, form: FormData): Promise<UserFormState> {
  const admin = await requireAdmin();
  const parsed = z
    .object({
      name: z.string().trim().min(3, "Informe o nome completo").max(120),
      email: z.email({ error: "E-mail inválido" }).max(160),
      password: z.string(),
      confirm: z.string(),
    })
    .safeParse(Object.fromEntries(form.entries()));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const { name, password, confirm } = parsed.data;
  const email = parsed.data.email.trim().toLowerCase();

  if (password !== confirm) return { error: "As senhas não conferem." };
  if (!isStrongPassword(password, { name, email })) return { error: "A senha não atende a todas as regras de segurança." };
  if (await db.user.findUnique({ where: { email } })) return { error: "Já existe um usuário com esse e-mail." };

  const user = await db.user.create({
    data: {
      name,
      email,
      role: "admin",
      passwordHash: await bcrypt.hash(password, BCRYPT_COST),
      mustChangePassword: true,
      createdById: admin.id,
    },
  });
  await audit(db, { entity: "user", entityId: user.id, action: "created", after: { name, email, role: "admin" }, userId: admin.id });
  revalidatePath("/admin/users");
  redirect(`/admin/users?criado=${encodeURIComponent(email)}`);
}

/** Desativar derruba todas as sessões na hora (sessionVersion++). */
export async function setUserActive(userId: string, active: boolean) {
  const admin = await requireAdmin();
  if (userId === admin.id && !active) throw new Error("Você não pode desativar o próprio acesso.");
  if (!active) {
    const otherActiveAdmins = await db.user.count({ where: { role: "admin", active: true, NOT: { id: userId } } });
    if (otherActiveAdmins === 0) throw new Error("É preciso ter ao menos um admin ativo.");
  }
  await db.user.update({
    where: { id: userId },
    data: { active, ...(active ? {} : { sessionVersion: { increment: 1 } }), failedLoginCount: 0, lockedUntil: null },
  });
  await audit(db, { entity: "user", entityId: userId, action: active ? "reactivated" : "deactivated", userId: admin.id });
  revalidatePath("/admin/users");
}

/** Redefinição por um admin: nova senha temporária, troca obrigatória e sessões derrubadas. */
export async function resetUserPassword(userId: string, _prev: UserFormState, form: FormData): Promise<UserFormState> {
  const admin = await requireAdmin();
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) return { error: "Usuário não encontrado." };
  const password = String(form.get("password") ?? "");
  if (password !== String(form.get("confirm") ?? "")) return { error: "As senhas não conferem." };
  if (!isStrongPassword(password, { name: user.name, email: user.email })) return { error: "A senha não atende a todas as regras de segurança." };

  await db.user.update({
    where: { id: userId },
    data: {
      passwordHash: await bcrypt.hash(password, BCRYPT_COST),
      mustChangePassword: userId !== admin.id,
      sessionVersion: { increment: 1 },
      failedLoginCount: 0,
      lockedUntil: null,
      passwordChangedAt: new Date(),
    },
  });
  await audit(db, { entity: "user", entityId: userId, action: "password_reset_by_admin", userId: admin.id });
  revalidatePath("/admin/users");
  return { ok: `Senha redefinida. ${user.name} vai criar uma nova no próximo acesso; sessões abertas foram encerradas.` };
}

/** Troca da própria senha (obrigatória no primeiro acesso). Encerra as outras sessões. */
export async function changeOwnPassword(_prev: UserFormState, form: FormData): Promise<UserFormState> {
  const user = await requireUser();
  const current = String(form.get("current") ?? "");
  const password = String(form.get("password") ?? "");
  if (!(await bcrypt.compare(current, user.passwordHash))) return { error: "A senha atual está incorreta." };
  if (password !== String(form.get("confirm") ?? "")) return { error: "As senhas não conferem." };
  if (password === current) return { error: "A nova senha precisa ser diferente da atual." };
  if (!isStrongPassword(password, { name: user.name, email: user.email })) return { error: "A senha não atende a todas as regras de segurança." };

  const updated = await db.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await bcrypt.hash(password, BCRYPT_COST),
      mustChangePassword: false,
      sessionVersion: { increment: 1 },
      passwordChangedAt: new Date(),
    },
  });
  // Nova sessão com a versão nova: esta aba continua logada, as demais caem.
  await createSession({ userId: updated.id, role: updated.role, sv: updated.sessionVersion });
  await audit(db, { entity: "user", entityId: user.id, action: "password_changed", userId: user.id });
  redirect("/admin?senha=1");
}
