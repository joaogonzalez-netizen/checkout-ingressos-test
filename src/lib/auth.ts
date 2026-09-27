import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { db } from "./db";
import { readSession } from "./session";

/**
 * Usuário da sessão atual, conferido no banco: ativo e com a mesma versão de sessão do token
 * (trocar a senha ou desativar a conta derruba todas as sessões abertas).
 */
export const currentUser = cache(async () => {
  const session = await readSession();
  if (!session) return null;
  const user = await db.user.findUnique({ where: { id: session.userId } });
  if (!user || !user.active || user.sessionVersion !== session.sv) return null;
  return user;
});

/** Qualquer usuário logado, mesmo com troca de senha pendente (usado na própria tela de troca). */
export async function requireUser() {
  const user = await currentUser();
  if (!user) redirect("/login");
  return user;
}

/**
 * Checagem real de acesso ao backoffice (o proxy só faz o redirecionamento otimista).
 * v1: só existe o perfil admin, que faz tudo. Os demais perfis entram com BO-01 completo.
 */
export async function requireAdmin() {
  const user = await requireUser();
  if (user.mustChangePassword) redirect("/trocar-senha");
  if (user.role !== "admin") redirect("/login");
  return user;
}
