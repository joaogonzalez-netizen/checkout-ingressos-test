import type { Artist, Event, Seat, TicketLot } from "@/generated/prisma/client";
import { canonicalCity } from "./localidades";

export type ChecklistItem = { step: number; label: string; done: boolean };

type FullEvent = Event & { artist: Artist; lots: TicketLot[]; seats: Pick<Seat, "status">[] };

/** O evento só pode ser publicado quando todas as etapas obrigatórias do wizard estão completas. */
export function eventChecklist(e: FullEvent): ChecklistItem[] {
  const hasSeats = e.seats.some((s) => s.status !== "blocked");
  const lotsTotal = e.lots.reduce((a, l) => a + l.quantity, 0);
  return [
    { step: 1, label: "Nome do espetáculo", done: !!e.showName },
    { step: 1, label: "Estado e cidade (lista oficial)", done: !!e.state && !!e.city && canonicalCity(e.state, e.city) === e.city },
    { step: 1, label: "Local e endereço", done: !!e.venueName && !!e.venueAddress },
    { step: 1, label: "Data e horário no futuro", done: !!e.startsAt && e.startsAt > new Date() },
    { step: 1, label: "Classificação indicativa", done: !!e.ageRating },
    { step: 1, label: "Slug da URL", done: !!e.slug },
    { step: 2, label: "Headline da VSL", done: !!e.vslHeadline },
    { step: 2, label: "Imagem de compartilhamento (og:image)", done: !!(e.ogImageUrl || e.artist.defaultOgImageUrl) },
    { step: 3, label: "Limite de ingressos definido", done: !!e.ticketLimit && e.ticketLimit > 0 },
    { step: 3, label: "Ao menos um lote", done: e.lots.length > 0 },
    { step: 3, label: "Soma dos lotes dentro do limite", done: !!e.ticketLimit && lotsTotal <= e.ticketLimit },
    { step: 4, label: "Tipo de lugar definido", done: !!e.seatingMode },
    { step: 4, label: "Mapa de poltronas gerado", done: e.seatingMode !== "seated" || hasSeats },
  ];
}

export function canPublish(items: ChecklistItem[]) {
  return items.every((i) => i.done);
}
