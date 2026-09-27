import { NextResponse, type NextRequest } from "next/server";
import { after } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { resolvePixel, sendCapiEvent } from "@/lib/meta";

const schema = z.object({
  slug: z.string().min(1),
  name: z.enum(["ViewContent", "InitiateCheckout", "AddPaymentInfo"]),
  eventId: z.string().min(1).max(100),
  sourceUrl: z.string().max(1000).nullish(),
  fbp: z.string().max(200).nullish(),
  fbc: z.string().max(200).nullish(),
});

/** Reforço server-side dos eventos de funil disparados no navegador (mesmo event_id). */
export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return new NextResponse(null, { status: 204 });
  const input = parsed.data;

  const event = await db.event.findUnique({ where: { slug: input.slug }, include: { artist: true } });
  const pixel = event?.status === "published" ? resolvePixel(event) : null;
  if (pixel?.capiToken) {
    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
    const userAgent = req.headers.get("user-agent");
    after(() => sendCapiEvent(pixel, { ...input, clientIp, userAgent }));
  }
  return new NextResponse(null, { status: 204 });
}
