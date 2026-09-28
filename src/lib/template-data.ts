import "server-only";
import type { Artist, Event, EventMedia, Seat, TicketLot } from "@/generated/prisma/client";
import type { TemplateCover, TemplateData, TemplateSeatRow, TemplateVideo } from "@/components/checkout/types";
import type { PublicSettings } from "./settings";
import { ageRatingLabel } from "./legal-defaults";
import { parsePalette } from "./palette";
import { formatDate, formatHour, formatLongDate } from "./dates";
import { env } from "./env";
import { MAX_TICKETS_PER_ORDER } from "./money";

type FullEvent = Event & { artist: Artist; lots: TicketLot[]; seats: Seat[]; media?: EventMedia[] };

export function defaultHeadline(artistName: string, city: string) {
  return `${artistName} está chegando em ${city}`;
}

export function buildSeatRows(seats: Pick<Seat, "id" | "row" | "number" | "status">[]): TemplateSeatRow[] {
  const rows = new Map<string, TemplateSeatRow>();
  for (const s of [...seats].sort((a, b) => a.row.localeCompare(b.row) || a.number - b.number)) {
    if (!rows.has(s.row)) rows.set(s.row, { row: s.row, seats: [] });
    rows.get(s.row)!.seats.push({ id: s.id, number: s.number, taken: s.status !== "available" });
  }
  return [...rows.values()];
}

/** Header e vídeo do evento; sem header próprio, herda o header padrão do artista. */
export function templateMedia(
  media: EventMedia[] = [],
  artist: Pick<Artist, "defaultCoverUrl" | "defaultCoverMobileUrl">,
): { cover: TemplateCover | null; video: TemplateVideo | null } {
  const cover = media.find((m) => m.kind === "cover")?.url ?? null;
  const coverMobile = media.find((m) => m.kind === "cover_mobile")?.url ?? null;
  const video = media.find((m) => m.kind === "video");
  // O par desktop/mobile vem de um lugar só, para não misturar a arte do evento com a do artista.
  const own = cover || coverMobile;
  const desktop = own ? (cover ?? coverMobile) : (artist.defaultCoverUrl ?? artist.defaultCoverMobileUrl);
  const mobile = own ? coverMobile : artist.defaultCoverMobileUrl;
  return {
    cover: desktop ? { desktop, mobile: mobile ?? null } : null,
    // Só vídeo em pé (Reels, 9:16) é aceito no upload.
    video: video ? { url: video.url, poster: video.posterUrl } : null,
  };
}

export function mapUrl(parts: (string | null | undefined)[]) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(parts.filter(Boolean).join(", "))}`;
}

export function toTemplateData(e: FullEvent, opts: { pixelEnabled: boolean; settings: PublicSettings }): TemplateData {
  const st = opts.settings;
  const now = new Date();
  const city = e.city ?? "Sua cidade";
  return {
    slug: e.slug ?? e.id,
    artistName: e.artist.name,
    logoUrl: e.artist.logoUrl,
    backLinkUrl: e.artist.backLinkUrl,
    palette: parsePalette(e.artist.colors),
    showName: e.showName ?? e.artist.defaultShowName ?? "Nome do espetáculo",
    city,
    state: e.state ?? "UF",
    venueName: e.venueName ?? "Local",
    venueAddress: e.venueAddress ?? "",
    dateLabel: e.startsAt ? formatDate(e.startsAt) : "Data a definir",
    longDateLabel: e.startsAt ? formatLongDate(e.startsAt) : "Data a definir",
    timeLabel: formatHour(e.startsAt),
    doorsLabel: formatHour(e.doorsOpenAt),
    endLabel: formatHour(e.endsAt),
    ageRatingLabel: ageRatingLabel(e.ageRating),
    ageRatingNote: e.ageRatingNote,
    description: e.description ?? "",
    accessRules: e.accessRules ?? "",
    mapUrl: mapUrl([e.venueName, e.venueAddress, e.city && e.state ? `${e.city} - ${e.state}` : e.city]),
    vslHeadline: e.vslHeadline || defaultHeadline(e.artist.name, city),
    vslSubtitle: e.vslSubtitle ?? e.artist.defaultVslSubtitle ?? "",
    vslCtaLabel: e.vslCtaLabel || "Quero garantir meu ingresso",
    ...templateMedia(e.media, e.artist),
    seated: e.seatingMode === "seated",
    maxPerOrder: MAX_TICKETS_PER_ORDER,
    seatRows: e.seatingMode === "seated" ? buildSeatRows(e.seats) : [],
    lots: [...e.lots]
      .sort((a, b) => a.position - b.position)
      .map((l) => ({
        id: l.id,
        name: l.name,
        priceCents: l.priceCents,
        available:
          l.reserved < l.quantity && (!l.salesStartAt || l.salesStartAt <= now) && (!l.salesEndAt || l.salesEndAt >= now),
        remaining: Math.max(0, l.quantity - l.reserved),
        salesEndLabel: l.salesEndAt ? `Vendas até ${formatDate(l.salesEndAt)}` : null,
        description: l.description,
        isHalfPrice: l.category === "meia",
      })),
    seller: {
      name: st.sellerName,
      cnpj: st.sellerCnpj,
      address: st.sellerAddress,
      email: st.contactEmail,
      whatsapp: st.contactWhatsapp,
      halfPriceText: st.halfPriceText,
      cancellationText: st.cancellationText,
      feeText: st.feeText,
    },
    termsUrl: env.TERMS_URL,
    privacyUrl: env.PRIVACY_URL,
    pixelEnabled: opts.pixelEnabled,
    demo: env.ASAAS_MOCK,
  };
}
