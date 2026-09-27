import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { after } from "next/server";
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { resolvePixel, sendCapiEvent } from "@/lib/meta";
import { getSettings } from "@/lib/settings";
import { toTemplateData } from "@/lib/template-data";
import { expireHolds } from "@/lib/orders";
import { CheckoutTemplate } from "@/components/checkout/CheckoutTemplate";
import { MetaPixel } from "@/components/checkout/MetaPixel";
import { formatDate } from "@/lib/dates";

export const dynamic = "force-dynamic";

async function loadEvent(slug: string) {
  return db.event.findUnique({
    where: { slug },
    include: { artist: true, lots: true, seats: true, media: true },
  });
}

export async function generateMetadata({ params }: PageProps<"/e/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const event = await loadEvent(slug);
  if (!event || event.status !== "published") return {};
  const title = `Finalizar compra — ${event.artist.name} · ${event.showName}`;
  const description = `${event.city}/${event.state} · ${event.venueName} · ${formatDate(event.startsAt)}`;
  const image = event.ogImageUrl ?? event.artist.defaultOgImageUrl;
  return {
    title,
    description,
    openGraph: { title, description, images: image ? [{ url: image, width: 1200, height: 630 }] : undefined },
  };
}

export default async function EventPage({ params }: PageProps<"/e/[slug]">) {
  const { slug } = await params;
  let event = await loadEvent(slug);
  if (!event || event.status === "draft") notFound();
  if (event.status === "closed") {
    return (
      <main style={{ maxWidth: 520, margin: "80px auto", padding: 24, textAlign: "center" }}>
        <h1 style={{ fontStyle: "italic" }}>{event.showName}</h1>
        <p>As vendas deste evento foram encerradas.</p>
        {event.artist.backLinkUrl && <a href={event.artist.backLinkUrl}>Ver a agenda de {event.artist.name}</a>}
      </main>
    );
  }

  // Libera reservas vencidas deste evento antes de mostrar o mapa (o cron cobre o resto).
  const { released } = await expireHolds({ eventId: event.id });
  if (released > 0) event = (await loadEvent(slug))!;

  const pixel = resolvePixel(event);
  const pageViewEventId = `pageview-${randomUUID()}`;

  if (pixel?.capiToken) {
    const h = await headers();
    const clientIp = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
    const userAgent = h.get("user-agent");
    const sourceUrl = `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}/e/${slug}`;
    after(() => sendCapiEvent(pixel, { name: "PageView", eventId: pageViewEventId, clientIp, userAgent, sourceUrl }));
  }

  return (
    <>
      {pixel && <MetaPixel pixelId={pixel.pixelId} pageViewEventId={pageViewEventId} />}
      <CheckoutTemplate data={toTemplateData(event, { pixelEnabled: !!pixel, settings: await getSettings() })} />
    </>
  );
}
