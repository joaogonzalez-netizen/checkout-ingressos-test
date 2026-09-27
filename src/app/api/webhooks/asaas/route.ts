import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";
import { safeEqual } from "@/lib/crypto";
import { handleAsaasEvent } from "@/lib/orders";
import type { AsaasWebhookEvent } from "@/lib/asaas";

/**
 * Webhook da Asaas. Autenticidade: header asaas-access-token igual ao token configurado no painel.
 * Idempotente pelo id do evento. Responde 200 rápido; erro 500 faz a Asaas reenviar.
 */
export async function POST(req: NextRequest) {
  const token = req.headers.get("asaas-access-token") ?? "";
  if (!safeEqual(token, env.ASAAS_WEBHOOK_TOKEN)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const evt = (await req.json().catch(() => null)) as AsaasWebhookEvent | null;
  if (!evt?.id || !evt.event) return NextResponse.json({ error: "invalid" }, { status: 400 });

  try {
    const outcome = await handleAsaasEvent(evt);
    return NextResponse.json({ received: true, outcome });
  } catch (err) {
    console.error(`[webhook] falha ao processar ${evt.id} (${evt.event})`, err);
    return NextResponse.json({ error: "processing_failed" }, { status: 500 });
  }
}
