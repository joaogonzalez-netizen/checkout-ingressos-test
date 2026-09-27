import type { EventStatus, LotCategory, OrderStatus } from "@/generated/prisma/client";

export const EVENT_STATUS_LABEL: Record<EventStatus, string> = {
  draft: "Rascunho",
  published: "Publicado",
  closed: "Vendas encerradas",
};

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  pending: "Aguardando",
  paid: "Pago",
  failed: "Recusado",
  expired: "Expirado",
  canceled: "Cancelado",
  refunded: "Estornado",
};

export const LOT_CATEGORY_LABEL: Record<LotCategory, string> = {
  inteira: "Inteira",
  meia: "Meia-entrada",
  solidario: "Solidário",
  promocional: "Promocional",
  cortesia: "Cortesia",
};

export const WIZARD_STEPS = [
  { step: 0, label: "Artista" },
  { step: 1, label: "Dados do evento" },
  { step: 2, label: "Página" },
  { step: 3, label: "Ingressos" },
  { step: 4, label: "Lugares" },
  { step: 5, label: "Rastreamento" },
  { step: 6, label: "Revisão e publicação" },
] as const;
