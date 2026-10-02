import Link from "next/link";
import { notFound } from "next/navigation";
import { toLocalDate, toLocalTime, todayLocal } from "@/lib/dates";
import { suggestEventSlug } from "@/lib/slug";
import { getSettings } from "@/lib/settings";
import { usesBlob } from "@/lib/storage";
import { defaultHeadline, toTemplateData } from "@/lib/template-data";
import { eventChecklist, canPublish } from "@/lib/event-checklist";
import { formatBRL } from "@/lib/money";
import { DEFAULT_ACCESS_RULES } from "@/lib/legal-defaults";
import { saveStep1, saveStep2, saveStep3, saveStep4, saveStep5 } from "../../../actions";
import { WIZARD_STEPS } from "../../../labels";
import { getEvent } from "../../data";
import { StepForm } from "../StepForm";
import { Step1Fields } from "./Step1Fields";
import { Step2Page } from "./Step2Page";
import { Step3Lots } from "./Step3Lots";
import { Step4Seats } from "./Step4Seats";
import { Step5Pixel } from "./Step5Pixel";
import { Step6Review } from "./Step6Review";
import { PublicationCard } from "./PublicationCard";

function isoLocal(d: Date | null) {
  return d ? `${toLocalDate(d)}T${toLocalTime(d)}` : "";
}

export default async function EditStep({ params }: PageProps<"/admin/events/[id]/edit/[step]">) {
  const { id, step: stepParam } = await params;
  const step = Number(stepParam);
  if (!Number.isInteger(step) || step < 1 || step > 6) notFound();
  const event = await getEvent(id);

  let body: React.ReactNode;
  if (step === 1) {
    body = (
      <StepForm action={saveStep1.bind(null, id)} eventId={id} step={1}>
        <Step1Fields
          artistSlug={event.artist.slug}
          published={event.status !== "draft"}
          minDate={todayLocal()}
          initial={{
            showName: event.showName ?? event.artist.defaultShowName ?? "",
            city: event.city ?? "",
            state: event.state ?? "",
            venueName: event.venueName ?? "",
            venueAddress: event.venueAddress ?? "",
            date: toLocalDate(event.startsAt),
            time: toLocalTime(event.startsAt) || "20:00",
            doorsTime: toLocalTime(event.doorsOpenAt),
            endTime: toLocalTime(event.endsAt),
            ageRating: event.ageRating ?? "",
            ageRatingNote: event.ageRatingNote ?? "",
            slug: event.slug ?? "",
            suggestedSlug: event.city && event.startsAt ? suggestEventSlug(event.artist.slug, event.city, toLocalDate(event.startsAt)) : "",
          }}
        />
      </StepForm>
    );
  } else if (step === 2) {
    const media = (kind: string) => event.media.find((m) => m.kind === kind) ?? null;
    const video = media("video");
    body = (
      <Step2Page
        eventId={id}
        directVideoUpload={usesBlob()}
        action={saveStep2.bind(null, id)}
        base={toTemplateData(event, { pixelEnabled: false, settings: await getSettings() })}
        initial={{
          vslHeadline: event.vslHeadline ?? defaultHeadline(event.artist.name, event.city ?? "{cidade}"),
          vslSubtitle: event.vslSubtitle ?? event.artist.defaultVslSubtitle ?? "",
          vslCtaLabel: event.vslCtaLabel ?? "Quero garantir meu ingresso",
          description: event.description ?? "",
          accessRules: event.accessRules ?? DEFAULT_ACCESS_RULES,
        }}
        media={{
          cover: media("cover")?.url ?? null,
          coverMobile: media("cover_mobile")?.url ?? null,
          ogImage: event.ogImageUrl,
          video: video
            ? { url: video.url, posterUrl: video.posterUrl, width: video.width ?? 16, height: video.height ?? 9, duration: video.durationSeconds ?? 0 }
            : null,
        }}
      />
    );
  } else if (step === 3) {
    body = (
      <Step3Lots
        eventId={id}
        action={saveStep3.bind(null, id)}
        initialLimit={event.ticketLimit}
        initial={event.lots.map((l) => ({
          key: l.id,
          id: l.id,
          name: l.name,
          description: l.description ?? "",
          category: l.category,
          price: (l.priceCents / 100).toFixed(2).replace(".", ","),
          quantity: String(l.quantity),
          salesStart: isoLocal(l.salesStartAt),
          salesEnd: isoLocal(l.salesEndAt),
          reserved: l.reserved,
          sold: l.sold,
          minPriceLabel: l.reserved > 0 ? formatBRL(l.priceCents) : null,
        }))}
      />
    );
  } else if (step === 4) {
    body = (
      <Step4Seats
        eventId={id}
        action={saveStep4.bind(null, id)}
        initial={{
          seatingMode: event.seatingMode,
          rows: event.seatRows ?? 8,
          perRow: event.seatsPerRow ?? 10,
          seats: event.seats.map((s) => ({ code: `${s.row}${s.number}`, status: s.status })),
          ticketLimit: event.ticketLimit,
        }}
      />
    );
  } else if (step === 5) {
    body = (
      <Step5Pixel
        eventId={id}
        action={saveStep5.bind(null, id)}
        artist={{ name: event.artist.name, pixelId: event.artist.metaPixelId, hasToken: !!event.artist.metaCapiTokenEnc }}
        initial={{ override: event.metaPixelOverride ?? "", hasOverrideToken: !!event.metaCapiTokenOverride }}
      />
    );
  } else {
    const checklist = eventChecklist(event);
    body = <Step6Review eventId={id} status={event.status} checklist={checklist} ready={canPublish(checklist)} />;
  }

  return (
    <>
      <nav className="bo-steps" aria-label="Etapas da configuração">
        {WIZARD_STEPS.filter((s) => s.step > 0).map((s) => (
          <Link
            key={s.step}
            href={`/admin/events/${id}/edit/${s.step}`}
            aria-current={s.step === step ? "step" : undefined}
            className={`bo-step${s.step === step ? " current" : s.step <= event.wizardStep ? " done" : ""}`}
          >
            {s.step}. {s.label}
          </Link>
        ))}
      </nav>
      {body}
      {step === 6 && <PublicationCard eventId={id} status={event.status} archived={!!event.archivedAt} />}
    </>
  );
}
