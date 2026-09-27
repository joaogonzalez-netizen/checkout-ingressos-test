import "server-only";
import { createHash } from "node:crypto";
import { decrypt } from "./crypto";

// Conversions API do Meta. O mesmo event_id é usado no pixel do navegador para deduplicar.
const GRAPH_VERSION = "v21.0";

export type PixelConfig = { pixelId: string; capiToken: string | null };

type EventWithArtist = {
  metaPixelOverride: string | null;
  metaCapiTokenOverride: string | null;
  artist: { metaPixelId: string | null; metaCapiTokenEnc: string | null };
};

/** Pixel do evento sobrescreve o do artista (herança do PRD). */
export function resolvePixel(event: EventWithArtist): PixelConfig | null {
  if (event.metaPixelOverride) {
    return {
      pixelId: event.metaPixelOverride,
      capiToken: event.metaCapiTokenOverride ? decrypt(event.metaCapiTokenOverride) : null,
    };
  }
  if (event.artist.metaPixelId) {
    return {
      pixelId: event.artist.metaPixelId,
      capiToken: event.artist.metaCapiTokenEnc ? decrypt(event.artist.metaCapiTokenEnc) : null,
    };
  }
  return null;
}

function sha256(value: string) {
  return createHash("sha256").update(value.trim().toLowerCase()).digest("hex");
}

export type CapiEvent = {
  name: "PageView" | "ViewContent" | "InitiateCheckout" | "AddPaymentInfo" | "Purchase";
  eventId: string;
  sourceUrl?: string | null;
  email?: string | null;
  phone?: string | null;
  externalId?: string | null;
  clientIp?: string | null;
  userAgent?: string | null;
  fbp?: string | null;
  fbc?: string | null;
  valueCents?: number;
  contentIds?: string[];
};

export async function sendCapiEvent(
  pixel: PixelConfig,
  event: CapiEvent,
  opts: { testEventCode?: string } = {},
): Promise<{ ok: boolean; error?: string }> {
  if (!pixel.capiToken) return { ok: false, error: "Token da Conversions API não configurado" };

  const userData: Record<string, unknown> = {};
  if (event.email) userData.em = [sha256(event.email)];
  // Meta espera o telefone com código do país, só dígitos.
  if (event.phone) userData.ph = [sha256(`55${event.phone}`)];
  if (event.externalId) userData.external_id = [sha256(event.externalId)];
  if (event.clientIp) userData.client_ip_address = event.clientIp;
  if (event.userAgent) userData.client_user_agent = event.userAgent;
  if (event.fbp) userData.fbp = event.fbp;
  if (event.fbc) userData.fbc = event.fbc;

  const payload: Record<string, unknown> = {
    data: [
      {
        event_name: event.name,
        event_time: Math.floor(Date.now() / 1000),
        event_id: event.eventId,
        action_source: "website",
        event_source_url: event.sourceUrl ?? undefined,
        user_data: userData,
        custom_data:
          event.valueCents !== undefined
            ? { currency: "BRL", value: event.valueCents / 100, content_ids: event.contentIds, content_type: "product" }
            : undefined,
      },
    ],
  };
  if (opts.testEventCode) payload.test_event_code = opts.testEventCode;

  try {
    const res = await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/${encodeURIComponent(pixel.pixelId)}/events?access_token=${encodeURIComponent(pixel.capiToken)}`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload), cache: "no-store" },
    );
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      return { ok: false, error: body?.error?.message ?? `Meta respondeu ${res.status}` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Falha de rede" };
  }
}
