import type { Palette } from "@/lib/palette";

export type TemplateSeat = { id: string; number: number; taken: boolean };
export type TemplateSeatRow = { row: string; seats: TemplateSeat[] };

export type TemplateLot = {
  id: string;
  name: string;
  priceCents: number;
  /** false quando esgotado ou fora do período de venda. */
  available: boolean;
  /** Quantos ainda podem ser comprados neste lote. */
  remaining: number;
  /** "Vendas até 02/10/2026", ou null quando o lote não tem data final. */
  salesEndLabel: string | null;
  description: string | null;
  isHalfPrice: boolean;
};

/** Dados da operação e textos legais (Configurações), iguais em todas as páginas. */
export type TemplateSeller = {
  name: string | null;
  cnpj: string | null;
  address: string | null;
  email: string | null;
  whatsapp: string | null;
  halfPriceText: string;
  cancellationText: string;
  feeText: string;
};

export type TemplateCover = { desktop: string; mobile: string | null };
export type TemplateVideo = { url: string; poster: string | null };

export type TemplateData = {
  slug: string;
  artistName: string;
  logoUrl: string | null;
  backLinkUrl: string | null;
  palette: Palette;
  showName: string;
  city: string;
  state: string;
  venueName: string;
  venueAddress: string;
  /** 20/11/2026 (resumo) */
  dateLabel: string;
  /** sexta-feira, 20 de novembro de 2026 */
  longDateLabel: string;
  /** 20h */
  timeLabel: string;
  /** 19h, ou vazio */
  doorsLabel: string;
  /** 22h, ou vazio */
  endLabel: string;
  /** "16 anos", "Livre" ou null */
  ageRatingLabel: string | null;
  ageRatingNote: string | null;
  description: string;
  accessRules: string;
  mapUrl: string;
  vslHeadline: string;
  vslSubtitle: string;
  vslCtaLabel: string;
  cover: TemplateCover | null;
  video: TemplateVideo | null;
  seated: boolean;
  /** Máximo de ingressos por compra (somando os lotes). */
  maxPerOrder: number;
  seatRows: TemplateSeatRow[];
  lots: TemplateLot[];
  seller: TemplateSeller;
  termsUrl: string;
  privacyUrl: string;
  pixelEnabled: boolean;
};
