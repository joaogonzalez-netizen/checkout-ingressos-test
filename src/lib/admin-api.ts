import "server-only";
import { NextResponse } from "next/server";
import { currentUser } from "./auth";

/** Autorização para route handlers do admin (respondem JSON em vez de redirecionar). */
export async function authorizeAdminApi() {
  const user = await currentUser();
  if (!user) return { error: NextResponse.json({ error: "Faça login de novo." }, { status: 401 }) } as const;
  if (user.role !== "admin" || user.mustChangePassword) return { error: NextResponse.json({ error: "Sem permissão." }, { status: 403 }) } as const;
  return { user } as const;
}

export const badRequest = (error: string) => NextResponse.json({ error }, { status: 400 });
