import "server-only";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Variável de ambiente ausente: ${name}`);
  return value;
}

// Lido sob demanda para não quebrar o build quando uma variável só existe em runtime.
export const env = {
  get DATABASE_URL() {
    return required("DATABASE_URL");
  },
  get APP_URL() {
    return (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  },
  get SESSION_SECRET() {
    return required("SESSION_SECRET");
  },
  get ENCRYPTION_KEY() {
    return required("ENCRYPTION_KEY");
  },
  get TICKET_HMAC_SECRET() {
    return required("TICKET_HMAC_SECRET");
  },
  get CRON_SECRET() {
    return process.env.CRON_SECRET ?? "";
  },
  get ASAAS_API_KEY() {
    return process.env.ASAAS_API_KEY ?? "";
  },
  get ASAAS_ENV() {
    return process.env.ASAAS_ENV === "production" ? "production" : "sandbox";
  },
  get ASAAS_WEBHOOK_TOKEN() {
    return required("ASAAS_WEBHOOK_TOKEN");
  },
  get TERMS_URL() {
    return process.env.TERMS_URL ?? "#";
  },
  get PRIVACY_URL() {
    return process.env.PRIVACY_URL ?? "#";
  },
  /** Pagamento disponível: chave da Asaas configurada ou modo simulado (dev). */
  get PAYMENTS_ENABLED() {
    return !!process.env.ASAAS_API_KEY || (process.env.NODE_ENV !== "production");
  },
  /** Sem chave da Asaas o app simula as cobranças (só fora de produção). */
  get ASAAS_MOCK() {
    return !process.env.ASAAS_API_KEY && process.env.NODE_ENV !== "production";
  },
};
