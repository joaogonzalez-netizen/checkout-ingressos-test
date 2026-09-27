import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { safeEqual } from "@/lib/crypto";
import { reconcileOrder } from "@/lib/orders";

/** Status do pedido para o polling do Pix e da página de confirmação. Exige o token do pedido. */
export async function GET(req: NextRequest, ctx: RouteContext<"/api/checkout/orders/[id]">) {
  const { id } = await ctx.params;
  const token = req.nextUrl.searchParams.get("t") ?? "";
  let order = await db.order.findUnique({ where: { id }, select: { status: true, accessToken: true, createdAt: true } });
  if (!order || !safeEqual(order.accessToken, token)) return NextResponse.json({ error: "not_found" }, { status: 404 });

  // Webhook atrasado: depois de 20 s pendente, consulta a Asaas ativamente.
  if (order.status === "pending" && Date.now() - order.createdAt.getTime() > 20_000) {
    await reconcileOrder(id);
    order = (await db.order.findUnique({ where: { id }, select: { status: true, accessToken: true, createdAt: true } }))!;
  }
  return NextResponse.json({ status: order.status }, { headers: { "Cache-Control": "no-store" } });
}
