import "server-only";
import { cache } from "react";
import { db } from "./db";
import { DEFAULT_CANCELLATION_TEXT, DEFAULT_FEE_TEXT, DEFAULT_HALF_PRICE_TEXT } from "./legal-defaults";

export type PublicSettings = {
  sellerName: string | null;
  sellerCnpj: string | null;
  sellerAddress: string | null;
  contactEmail: string | null;
  contactWhatsapp: string | null;
  halfPriceText: string;
  cancellationText: string;
  feeText: string;
  homeEventSlug: string | null;
};

/** Configurações da operação com os textos padrão aplicados quando vazios. */
export const getSettings = cache(async (): Promise<PublicSettings> => {
  const s = await db.platformSettings.findUnique({ where: { id: "default" } });
  return {
    sellerName: s?.sellerName ?? null,
    sellerCnpj: s?.sellerCnpj ?? null,
    sellerAddress: s?.sellerAddress ?? null,
    contactEmail: s?.contactEmail ?? null,
    contactWhatsapp: s?.contactWhatsapp ?? null,
    halfPriceText: s?.halfPriceText || DEFAULT_HALF_PRICE_TEXT,
    cancellationText: s?.cancellationText || DEFAULT_CANCELLATION_TEXT,
    feeText: s?.feeText || DEFAULT_FEE_TEXT,
    homeEventSlug: s?.homeEventSlug ?? null,
  };
});
