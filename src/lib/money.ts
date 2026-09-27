// Regras de preço fixas da plataforma (Nível 1 do PRD de Backoffice).

/** Máximo de ingressos numa compra (somando todos os lotes). */
export const MAX_TICKETS_PER_ORDER = 10;

/** Taxa de serviço: 10% sobre o valor do ingresso (decisão de 27/09/2026). */
export const SERVICE_FEE_RATE = 0.1;

/**
 * Juros ao mês aplicados no 12x. PENDENTE: confirmar a taxa com o financeiro;
 * 2,99% a.m. é só um valor de referência.
 */
export const INSTALLMENT_12X_MONTHLY_RATE = 0.0299;

export const INSTALLMENT_OPTIONS = [
  { count: 1, interest: false },
  { count: 2, interest: false },
  { count: 3, interest: false },
  { count: 6, interest: false },
  { count: 12, interest: true },
] as const;

export type InstallmentCount = (typeof INSTALLMENT_OPTIONS)[number]["count"];

export function isInstallmentCount(n: number): n is InstallmentCount {
  return INSTALLMENT_OPTIONS.some((o) => o.count === n);
}

export function serviceFeeCents(ticketCents: number): number {
  return Math.round(ticketCents * SERVICE_FEE_RATE);
}

/** Total cobrado no cartão para N parcelas (Price/tabela para o 12x com juros). */
export function installmentTotalCents(baseCents: number, count: InstallmentCount): number {
  const option = INSTALLMENT_OPTIONS.find((o) => o.count === count)!;
  if (!option.interest) return baseCents;
  const i = INSTALLMENT_12X_MONTHLY_RATE;
  const pmt = (baseCents * i) / (1 - Math.pow(1 + i, -count));
  return Math.round(pmt) * count;
}

export function formatBRL(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** "120,00" | "120" | "120.5" -> centavos. Retorna null se inválido. */
export function parseBRL(input: string): number | null {
  const clean = input.trim().replace(/[R$\s]/g, "");
  if (!clean) return null;
  const normalized = clean.includes(",") ? clean.replace(/\./g, "").replace(",", ".") : clean;
  const value = Number(normalized);
  if (!Number.isFinite(value) || value < 0) return null;
  return Math.round(value * 100);
}
