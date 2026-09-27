import "server-only";
import { env } from "./env";
import { randomToken } from "./crypto";

// Cliente da API v3 da Asaas (https://docs.asaas.com).
// PENDENTE (Arquitetura): homologar com a Asaas o payload exato do webhook antes de ir a produção.
//
// Cartão: a cobrança é criada sem dados de cartão e o comprador paga na fatura hospedada da Asaas
// (invoiceUrl). Assim nenhum dado de cartão passa pelo nosso backend (requisito de PCI do PRD).

export type AsaasPaymentStatus =
  | "PENDING"
  | "RECEIVED"
  | "CONFIRMED"
  | "OVERDUE"
  | "REFUNDED"
  | "RECEIVED_IN_CASH"
  | "REFUND_REQUESTED"
  | "REFUND_IN_PROGRESS"
  | "CHARGEBACK_REQUESTED"
  | "CHARGEBACK_DISPUTE"
  | "AWAITING_CHARGEBACK_REVERSAL"
  | "DUNNING_REQUESTED"
  | "DUNNING_RECEIVED"
  | "AWAITING_RISK_ANALYSIS";

export type AsaasPayment = {
  id: string;
  status: AsaasPaymentStatus;
  value: number;
  billingType: "PIX" | "CREDIT_CARD" | string;
  externalReference?: string | null;
  installment?: string | null;
  invoiceUrl?: string;
  deleted?: boolean;
};

export type AsaasWebhookEvent = {
  id: string;
  event: string;
  dateCreated?: string;
  payment?: AsaasPayment;
};

export type PixQrCode = { encodedImage: string; payload: string; expirationDate?: string };

type CreatePaymentInput = {
  customerId: string;
  method: "pix" | "credit_card";
  totalCents: number;
  installments: number;
  description: string;
  externalReference: string;
  successUrl: string;
};

export interface AsaasClient {
  createCustomer(input: { name: string; email: string; cpfCnpj: string; mobilePhone?: string }): Promise<{ id: string }>;
  createPayment(input: CreatePaymentInput): Promise<AsaasPayment>;
  getPixQrCode(paymentId: string): Promise<PixQrCode>;
  getPayment(paymentId: string): Promise<AsaasPayment>;
  deletePayment(paymentId: string): Promise<boolean>;
}

export class AsaasError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly details?: unknown,
  ) {
    super(message);
  }
}

function dueDateToday(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

class HttpAsaasClient implements AsaasClient {
  private base = env.ASAAS_ENV === "production" ? "https://api.asaas.com/v3" : "https://api-sandbox.asaas.com/v3";

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const res = await fetch(`${this.base}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "checkout-ingressos",
        access_token: env.ASAAS_API_KEY,
        ...init.headers,
      },
      cache: "no-store",
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      const description = body?.errors?.[0]?.description ?? `Asaas respondeu ${res.status}`;
      throw new AsaasError(description, res.status, body);
    }
    return body as T;
  }

  createCustomer(input: { name: string; email: string; cpfCnpj: string; mobilePhone?: string }) {
    return this.request<{ id: string }>("/customers", {
      method: "POST",
      // O e-mail do ingresso é nosso; a Asaas não precisa notificar o comprador.
      body: JSON.stringify({ ...input, notificationDisabled: true }),
    });
  }

  createPayment(input: CreatePaymentInput) {
    const value = input.totalCents / 100;
    const body: Record<string, unknown> = {
      customer: input.customerId,
      billingType: input.method === "pix" ? "PIX" : "CREDIT_CARD",
      dueDate: dueDateToday(),
      description: input.description,
      externalReference: input.externalReference,
      callback: { successUrl: input.successUrl, autoRedirect: true },
    };
    if (input.method === "credit_card" && input.installments > 1) {
      body.installmentCount = input.installments;
      body.totalValue = value;
    } else {
      body.value = value;
    }
    return this.request<AsaasPayment>("/payments", { method: "POST", body: JSON.stringify(body) });
  }

  getPixQrCode(paymentId: string) {
    return this.request<PixQrCode>(`/payments/${paymentId}/pixQrCode`);
  }

  getPayment(paymentId: string) {
    return this.request<AsaasPayment>(`/payments/${paymentId}`);
  }

  async deletePayment(paymentId: string) {
    const res = await this.request<{ deleted: boolean }>(`/payments/${paymentId}`, { method: "DELETE" });
    return res.deleted;
  }
}

// ---------------------------------------------------------------------------
// Modo simulado (sem ASAAS_API_KEY, fora de produção). Guarda as cobranças em memória
// e expõe uma "fatura" local em /dev/asaas/[paymentId] para aprovar ou recusar.

type MockStore = Map<string, AsaasPayment>;
const globalForMock = globalThis as unknown as { asaasMock?: MockStore };
const mockStore: MockStore = (globalForMock.asaasMock ??= new Map());

// PNG 1x1 transparente: o QR real vem da Asaas.
const PLACEHOLDER_QR =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

class MockAsaasClient implements AsaasClient {
  async createCustomer() {
    return { id: `cus_mock_${randomToken(6)}` };
  }

  async createPayment(input: CreatePaymentInput) {
    const id = `pay_mock_${randomToken(8)}`;
    const payment: AsaasPayment = {
      id,
      status: "PENDING",
      value: input.totalCents / 100,
      billingType: input.method === "pix" ? "PIX" : "CREDIT_CARD",
      externalReference: input.externalReference,
      invoiceUrl: `${env.APP_URL}/dev/asaas/${id}`,
    };
    mockStore.set(id, payment);
    return payment;
  }

  async getPixQrCode(paymentId: string) {
    return { encodedImage: PLACEHOLDER_QR, payload: `00020126MOCKPIX${paymentId}` };
  }

  async getPayment(paymentId: string) {
    const payment = mockStore.get(paymentId);
    if (!payment) throw new AsaasError("Cobrança simulada não encontrada", 404);
    return payment;
  }

  async deletePayment(paymentId: string) {
    const payment = mockStore.get(paymentId);
    if (!payment || payment.status !== "PENDING") return false;
    payment.deleted = true;
    return true;
  }
}

export function mockSetStatus(paymentId: string, status: AsaasPaymentStatus): AsaasPayment | null {
  const payment = mockStore.get(paymentId);
  if (!payment) return null;
  payment.status = status;
  return payment;
}

export function mockGetPayment(paymentId: string): AsaasPayment | null {
  return mockStore.get(paymentId) ?? null;
}

export function asaas(): AsaasClient {
  return env.ASAAS_MOCK ? new MockAsaasClient() : new HttpAsaasClient();
}

export const PAID_STATUSES: AsaasPaymentStatus[] = ["CONFIRMED", "RECEIVED", "RECEIVED_IN_CASH"];
