import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";
import { safeEqual } from "@/lib/crypto";
import { expireHolds } from "@/lib/orders";

/** Libera reservas vencidas. Agende a cada minuto (Vercel Cron, com Authorization: Bearer CRON_SECRET). */
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? "";
  if (!env.CRON_SECRET || !safeEqual(auth, `Bearer ${env.CRON_SECRET}`)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.json(await expireHolds());
}
