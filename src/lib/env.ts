import "server-only";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Variável de ambiente ausente: ${name}`);
  return value;
}

// Lido sob demanda para não quebrar o build quando uma variável só existe em runtime.
export const env = {
  /**
   * Banco do app. SUPA_POSTGRES_URL (Supabase via Vercel, transaction pooler) tem prioridade sobre
   * DATABASE_URL, que o Neon ainda ocupa enquanto fica como reserva.
   */
  get DATABASE_URL() {
    return process.env.SUPA_POSTGRES_URL || required("DATABASE_URL");
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
  /**
   * Ambiente de demonstração (DEMO_MODE=1): pagamentos sempre simulados, mesmo em produção,
   * faixa "Ambiente de teste" nas páginas e ferramentas de teste liberadas.
   */
  get DEMO_MODE() {
    return process.env.DEMO_MODE === "1";
  },
  /** Cobranças simuladas: modo demo, ou dev sem chave da Asaas. Nunca em produção real. */
  get ASAAS_MOCK() {
    return this.DEMO_MODE || (!process.env.ASAAS_API_KEY && process.env.NODE_ENV !== "production");
  },
  /** Pagamento disponível: simulado ou com chave da Asaas. */
  get PAYMENTS_ENABLED() {
    return this.ASAAS_MOCK || !!process.env.ASAAS_API_KEY;
  },
};
