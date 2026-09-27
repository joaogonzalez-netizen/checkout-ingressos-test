"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { encrypt } from "@/lib/crypto";
import { audit, diff } from "@/lib/audit";
import { fromLocalDateTime } from "@/lib/dates";
import { parseBRL } from "@/lib/money";
import { SLUG_PATTERN } from "@/lib/slug";
import { canPublish, eventChecklist } from "@/lib/event-checklist";
import { UFS, canonicalCity } from "@/lib/localidades";
import { AGE_RATINGS, DEFAULT_ACCESS_RULES } from "@/lib/legal-defaults";
import { resolvePixel, sendCapiEvent } from "@/lib/meta";
import type { Event, Prisma } from "@/generated/prisma/client";

export type StepState = { error?: string; notice?: string; saved?: boolean };

/** Valor mínimo de cobrança aceito pela Asaas. Cortesia gratuita fica para o P2. */
const MIN_PRICE_CENTS = 500;

const SEAT_ROW_LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

function text(form: FormData, key: string) {
  return String(form.get(key) ?? "").trim();
}

async function loadEvent(eventId: string) {
  const event = await db.event.findUnique({ where: { id: eventId }, include: { artist: true } });
  if (!event) throw new Error("Evento não encontrado");
  return event;
}

/**
 * Grava a etapa, audita se o evento já está publicado e decide o redirecionamento.
 * Com aviso (notice), fica na etapa para o usuário ler, mesmo em "Salvar e continuar".
 */
async function finishStep(
  event: Event,
  step: number,
  data: Prisma.EventUncheckedUpdateInput,
  form: FormData,
  userId: string,
  notice?: string,
): Promise<StepState> {
  await db.event.update({
    where: { id: event.id },
    data: { ...data, wizardStep: Math.max(event.wizardStep, step) },
  });
  if (event.status !== "draft") {
    const changes = diff(event as unknown as Record<string, unknown>, data as Record<string, unknown>);
    if (changes) await audit(db, { entity: "event", entityId: event.id, action: `updated_step_${step}`, ...changes, userId });
  }
  revalidatePath(`/admin/events/${event.id}`, "layout");
  if (event.slug) revalidatePath(`/e/${event.slug}`);
  if (!notice && text(form, "intent") === "next") redirect(`/admin/events/${event.id}/edit/${step + 1}`);
  return { saved: true, notice };
}

// Etapa 0 — Artista (sempre a primeira). Cria o rascunho já com os dados herdados do artista.
export async function createDraftEvent(form: FormData) {
  const user = await requireAdmin();
  const artistId = text(form, "artistId");
  const artist = await db.artist.findUnique({ where: { id: artistId } });
  if (!artist) throw new Error("Selecione um artista");
  if (artist.archivedAt) throw new Error("Artista desativado: reative antes de criar eventos");
  const event = await db.event.create({
    data: {
      artistId: artist.id,
      showName: artist.defaultShowName,
      seatingMode: "general",
      accessRules: DEFAULT_ACCESS_RULES,
      vslSubtitle: artist.defaultVslSubtitle,
      wizardStep: 0,
    },
  });
  await audit(db, { entity: "event", entityId: event.id, action: "created", userId: user.id });
  redirect(`/admin/events/${event.id}/edit/1`);
}

// Etapa 1 — Dados do evento
const step1Schema = z.object({
  showName: z.string().min(2, "Informe o nome do espetáculo").max(120),
  state: z.string().refine((v) => UFS.some((u) => u.sigla === v), "Selecione o estado"),
  city: z.string().min(2, "Informe a cidade").max(80),
  venueName: z.string().min(2, "Informe o local").max(120),
  venueAddress: z.string().min(5, "Informe o endereço").max(240),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe a data"),
  time: z.string().regex(/^\d{2}:\d{2}$/, "Informe o horário"),
  doorsTime: z.string().regex(/^(\d{2}:\d{2})?$/),
  endTime: z.string().regex(/^(\d{2}:\d{2})?$/),
  ageRating: z.string().refine((v) => AGE_RATINGS.some((r) => r.value === v), "Selecione a classificação indicativa"),
  ageRatingNote: z.string().max(140),
  slug: z.string().regex(SLUG_PATTERN, "Slug só pode ter letras minúsculas, números e hífen").max(120),
});

export async function saveStep1(eventId: string, _prev: StepState, form: FormData): Promise<StepState> {
  const user = await requireAdmin();
  const event = await loadEvent(eventId);
  const parsed = step1Schema.safeParse(Object.fromEntries(["showName", "city", "state", "venueName", "venueAddress", "date", "time", "doorsTime", "endTime", "ageRating", "ageRatingNote", "slug"].map((k) => [k, text(form, k)])));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const v = parsed.data;
  const city = canonicalCity(v.state, v.city);
  if (!city) return { error: `"${v.city}" não é um município de ${v.state}. Escolha a cidade na lista.` };

  const startsAt = fromLocalDateTime(v.date, v.time);
  if (!startsAt) return { error: "Data ou horário inválido" };
  if (startsAt <= new Date()) return { error: "A data do evento não pode estar no passado." };
  const doorsOpenAt = v.doorsTime ? fromLocalDateTime(v.date, v.doorsTime) : null;
  if (doorsOpenAt && doorsOpenAt > startsAt) return { error: "A abertura dos portões precisa ser antes do início." };
  // Término antes do início = passou da meia-noite: vai para o dia seguinte.
  let endsAt = v.endTime ? fromLocalDateTime(v.date, v.endTime) : null;
  if (endsAt && endsAt <= startsAt) endsAt = new Date(endsAt.getTime() + 24 * 60 * 60_000);

  const clash = await db.event.findFirst({ where: { slug: v.slug, NOT: { id: event.id } } });
  if (clash) return { error: "Esse slug já está em uso por outro evento." };
  if (event.status === "published" && event.slug && event.slug !== v.slug) {
    return { error: "O link de um evento publicado não pode mudar: os anúncios já apontam para ele." };
  }

  const data = {
    showName: v.showName,
    city,
    state: v.state,
    venueName: v.venueName,
    venueAddress: v.venueAddress,
    startsAt,
    doorsOpenAt,
    endsAt,
    ageRating: v.ageRating,
    ageRatingNote: v.ageRatingNote || null,
    slug: v.slug,
  };
  // Com o evento publicado, mudança de data, horário ou local exige avisar os compradores (envio em P2).
  const logistics =
    event.status !== "draft" &&
    (event.startsAt?.getTime() !== startsAt.getTime() || event.venueName !== v.venueName || event.venueAddress !== v.venueAddress);
  const notice = logistics
    ? "Data, horário ou local mudou. Avise os compradores: o envio automático desse aviso entra no P2."
    : undefined;
  return finishStep(event, 1, data, form, user.id, notice);
}

// Etapa 2 — Página (textos; header, vídeo e og:image sobem direto pela rota de mídia)
export async function saveStep2(eventId: string, _prev: StepState, form: FormData): Promise<StepState> {
  const user = await requireAdmin();
  const event = await loadEvent(eventId);
  const vslHeadline = text(form, "vslHeadline");
  if (vslHeadline.length < 4) return { error: "Informe a headline da VSL." };
  return finishStep(
    event,
    2,
    {
      vslHeadline: vslHeadline.slice(0, 160),
      vslSubtitle: text(form, "vslSubtitle").slice(0, 400) || null,
      vslCtaLabel: text(form, "vslCtaLabel").slice(0, 60) || null,
      description: text(form, "description").slice(0, 5000) || null,
      accessRules: text(form, "accessRules").slice(0, 3000) || null,
    },
    form,
    user.id,
  );
}

// Etapa 3 — Ingressos (lotes)
const lotSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(2, "Todo lote precisa de nome").max(80),
  description: z.string().trim().max(300).optional(),
  category: z.enum(["inteira", "meia", "solidario", "promocional", "cortesia"]),
  price: z.string(),
  quantity: z.coerce.number().int().min(1, "Quantidade mínima: 1"),
  salesStart: z.string(),
  salesEnd: z.string(),
});

function parseLocalDateTime(value: string) {
  if (!value) return null;
  const [date, time] = value.split("T");
  return fromLocalDateTime(date, time?.slice(0, 5) ?? "");
}

export async function saveStep3(eventId: string, _prev: StepState, form: FormData): Promise<StepState> {
  const user = await requireAdmin();
  const event = await loadEvent(eventId);
  let raw: unknown;
  try {
    raw = JSON.parse(text(form, "lots") || "[]");
  } catch {
    return { error: "Não foi possível ler os lotes." };
  }
  const parsed = z.array(lotSchema).min(1, "Cadastre ao menos um lote.").safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  // Limite total do evento: obrigatório, e a soma dos lotes não pode passar dele.
  const ticketLimit = Number(text(form, "ticketLimit"));
  if (!Number.isInteger(ticketLimit) || ticketLimit < 1) return { error: "Informe o limite de ingressos do evento." };
  const lotsTotal = parsed.data.reduce((a, l) => a + l.quantity, 0);
  if (lotsTotal > ticketLimit) {
    return { error: `A soma dos lotes (${lotsTotal}) passa do limite de ${ticketLimit} ingressos. Reduza as quantidades ou aumente o limite.` };
  }

  const existing = await db.ticketLot.findMany({ where: { eventId } });
  const byId = new Map(existing.map((l) => [l.id, l]));
  const rows: (Omit<Prisma.TicketLotUncheckedCreateInput, "eventId"> & { id?: string })[] = [];
  for (const [position, l] of parsed.data.entries()) {
    const priceCents = parseBRL(l.price);
    if (priceCents === null) return { error: `Preço inválido no lote "${l.name}".` };
    if (priceCents < MIN_PRICE_CENTS) {
      return { error: `O lote "${l.name}" precisa custar ao menos R$ 5,00 (mínimo da Asaas). Cortesia gratuita entra no P2.` };
    }
    const salesStartAt = parseLocalDateTime(l.salesStart);
    const salesEndAt = parseLocalDateTime(l.salesEnd);
    if (salesStartAt && salesEndAt && salesEndAt <= salesStartAt) return { error: `Período de venda inválido no lote "${l.name}".` };
    const prev = l.id ? byId.get(l.id) : undefined;
    if (l.id && !prev) return { error: "Um lote foi removido por outra pessoa. Recarregue a página." };
    if (prev && prev.reserved > 0) {
      if (l.quantity < prev.reserved) {
        return { error: `O lote "${prev.name}" já tem ${prev.reserved} ingresso(s) vendido(s) ou reservado(s); a quantidade não pode ficar abaixo disso.` };
      }
      if (priceCents < prev.priceCents) return { error: `O lote "${prev.name}" já tem vendas; o preço não pode ser reduzido.` };
    }
    rows.push({ id: l.id, name: l.name, description: l.description || null, category: l.category, priceCents, quantity: l.quantity, salesStartAt, salesEndAt, position });
  }
  const keptIds = new Set(rows.map((r) => r.id).filter(Boolean));
  const removed = existing.filter((l) => !keptIds.has(l.id));
  const blocked = removed.find((l) => l.reserved > 0);
  if (blocked) return { error: `O lote "${blocked.name}" já tem vendas e não pode ser removido.` };
  // Mesmo sem venda ativa, um lote que aparece em pedido (expirado, recusado) fica no histórico.
  const inHistory = removed.length
    ? await db.orderItem.findFirst({ where: { lotId: { in: removed.map((l) => l.id) } }, include: { lot: true } })
    : null;
  if (inHistory) {
    return { error: `O lote "${inHistory.lot.name}" aparece em pedidos antigos e não pode ser removido. Para parar de vender, preencha o "Fim da venda".` };
  }

  await db.$transaction(async (tx) => {
    if (removed.length) await tx.ticketLot.deleteMany({ where: { id: { in: removed.map((l) => l.id) } } });
    for (const { id, ...data } of rows) {
      if (id) await tx.ticketLot.update({ where: { id }, data });
      else await tx.ticketLot.create({ data: { ...data, eventId } });
    }
    if (event.status !== "draft") {
      await audit(tx, {
        entity: "event",
        entityId: eventId,
        action: "updated_lots",
        before: existing.map(({ id, name, priceCents, quantity }) => ({ id, name, priceCents, quantity })),
        after: rows.map(({ id, name, priceCents, quantity }) => ({ id, name, priceCents, quantity })),
        userId: user.id,
      });
    }
  });
  return finishStep(event, 3, { ticketLimit }, form, user.id);
}

// Etapa 4 — Lugares
export async function saveStep4(eventId: string, _prev: StepState, form: FormData): Promise<StepState> {
  const user = await requireAdmin();
  const event = await loadEvent(eventId);
  const mode = text(form, "seatingMode");
  if (mode !== "seated" && mode !== "general") return { error: "Escolha o tipo de lugar." };

  const seats = await db.seat.findMany({ where: { eventId } });
  const locked = seats.filter((s) => s.status === "held" || s.status === "sold");

  if (mode === "general") {
    if (locked.length) return { error: "Já existem poltronas vendidas; o evento não pode deixar de ter lugar marcado." };
    await db.seat.deleteMany({ where: { eventId } });
    return finishStep(event, 4, { seatingMode: "general", seatRows: null, seatsPerRow: null }, form, user.id);
  }

  if (event.seatingMode !== "seated") return { error: "Lugar marcado está desativado por enquanto. Use sem lugar marcado." };

  const rows = Number(text(form, "seatRows"));
  const perRow = Number(text(form, "seatsPerRow"));
  if (!Number.isInteger(rows) || rows < 1 || rows > 26) return { error: "Fileiras: de 1 a 26 (A–Z)." };
  if (!Number.isInteger(perRow) || perRow < 1 || perRow > 60) return { error: "Assentos por fileira: de 1 a 60." };
  let blockedCodes: string[];
  try {
    blockedCodes = z.array(z.string()).parse(JSON.parse(text(form, "blocked") || "[]"));
  } catch {
    return { error: "Não foi possível ler os bloqueios." };
  }
  const blockedSet = new Set(blockedCodes);

  const dimsChanged = event.seatRows !== rows || event.seatsPerRow !== perRow || event.seatingMode !== "seated";
  if (dimsChanged && locked.length) {
    return { error: "Já existem poltronas vendidas ou reservadas; fileiras e assentos não podem mudar." };
  }

  await db.$transaction(async (tx) => {
    if (dimsChanged) {
      await tx.seat.deleteMany({ where: { eventId } });
      const data = [];
      for (let r = 0; r < rows; r++) {
        for (let n = 1; n <= perRow; n++) {
          const row = SEAT_ROW_LETTERS[r];
          data.push({ eventId, row, number: n, status: blockedSet.has(`${row}${n}`) ? ("blocked" as const) : ("available" as const) });
        }
      }
      await tx.seat.createMany({ data });
    } else {
      // Só alterna bloqueio de poltronas livres; vendidas/reservadas não mudam.
      for (const s of seats) {
        if (s.status !== "available" && s.status !== "blocked") continue;
        const next = blockedSet.has(`${s.row}${s.number}`) ? "blocked" : "available";
        if (next !== s.status) await tx.seat.update({ where: { id: s.id }, data: { status: next } });
      }
    }
  });

  const available = await db.seat.count({ where: { eventId, status: { not: "blocked" } } });
  const notice =
    event.ticketLimit && event.ticketLimit > available
      ? `O limite de ${event.ticketLimit} ingressos passa das ${available} poltronas disponíveis. A venda para quando as poltronas acabarem.`
      : undefined;
  return finishStep(event, 4, { seatingMode: "seated", seatRows: rows, seatsPerRow: perRow }, form, user.id, notice);
}

// Etapa 5 — Rastreamento
export async function saveStep5(eventId: string, _prev: StepState, form: FormData): Promise<StepState> {
  const user = await requireAdmin();
  const event = await loadEvent(eventId);
  if (text(form, "pixelMode") === "inherit") {
    return finishStep(event, 5, { metaPixelOverride: null, metaCapiTokenOverride: null }, form, user.id);
  }
  const pixelId = text(form, "metaPixelOverride");
  if (!/^\d{6,20}$/.test(pixelId)) return { error: "O Pixel ID tem só números." };
  const token = text(form, "metaCapiTokenOverride");
  return finishStep(
    event,
    5,
    { metaPixelOverride: pixelId, ...(token ? { metaCapiTokenOverride: encrypt(token) } : {}) },
    form,
    user.id,
  );
}

export async function testPixel(eventId: string, _prev: StepState, form: FormData): Promise<StepState> {
  await requireAdmin();
  const event = await loadEvent(eventId);
  const pixel = resolvePixel(event);
  if (!pixel) return { error: "Nenhum Pixel configurado (nem no artista, nem no evento)." };
  const res = await sendCapiEvent(
    pixel,
    { name: "PageView", eventId: `test-${Date.now()}`, sourceUrl: `backoffice/test/${event.id}` },
    { testEventCode: text(form, "testEventCode") || undefined },
  );
  return res.ok
    ? { notice: `PageView de teste enviado para o Pixel ${pixel.pixelId}. Confira em Gerenciador de Eventos → Testar eventos.` }
    : { error: `Falha no teste: ${res.error}` };
}

// Etapa 6 — Publicação
export async function publishEvent(eventId: string, _prev: StepState): Promise<StepState> {
  const user = await requireAdmin();
  const event = await db.event.findUniqueOrThrow({
    where: { id: eventId },
    include: { artist: true, lots: true, seats: { select: { status: true } } },
  });
  const checklist = eventChecklist(event);
  if (!canPublish(checklist)) return { error: "Ainda faltam itens obrigatórios no checklist." };
  await db.event.update({
    where: { id: eventId },
    data: { status: "published", publishedAt: event.publishedAt ?? new Date(), wizardStep: 6 },
  });
  await audit(db, { entity: "event", entityId: eventId, action: "published", userId: user.id });
  revalidatePath(`/admin/events/${eventId}`, "layout");
  redirect(`/admin/events/${eventId}?published=1`);
}

/** Tira a página do ar sem apagar pedidos. */
export async function setEventStatus(eventId: string, status: "draft" | "closed" | "published", _form?: FormData) {
  const user = await requireAdmin();
  const event = await db.event.findUniqueOrThrow({ where: { id: eventId } });
  if (status === "published" && event.status === "draft") throw new Error("Use o checklist da etapa 6 para publicar");
  await db.event.update({ where: { id: eventId }, data: { status } });
  await audit(db, { entity: "event", entityId: eventId, action: `status_${status}`, before: { status: event.status }, after: { status }, userId: user.id });
  revalidatePath(`/admin/events/${eventId}`, "layout");
}

/**
 * Arquivar: tira o evento da lista principal. Se estiver publicado, as vendas são encerradas
 * junto (evento arquivado não pode continuar vendendo sem aparecer na lista). Nada é apagado.
 */
export async function setEventArchived(eventId: string, archived: boolean, _form?: FormData) {
  const user = await requireAdmin();
  const event = await db.event.findUniqueOrThrow({ where: { id: eventId } });
  const closeSales = archived && event.status === "published";
  await db.event.update({
    where: { id: eventId },
    data: { archivedAt: archived ? new Date() : null, ...(closeSales ? { status: "closed" as const } : {}) },
  });
  await audit(db, {
    entity: "event",
    entityId: eventId,
    action: archived ? "archived" : "unarchived",
    before: { status: event.status },
    after: closeSales ? { status: "closed" } : undefined,
    userId: user.id,
  });
  revalidatePath("/admin/events");
  revalidatePath(`/admin/events/${eventId}`, "layout");
  if (event.slug) revalidatePath(`/e/${event.slug}`);
}
