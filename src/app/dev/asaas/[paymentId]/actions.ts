"use server";

import { redirect } from "next/navigation";
import { randomUUID } from "node:crypto";
import { env } from "@/lib/env";
import { mockSetStatus, type AsaasPaymentStatus } from "@/lib/asaas";
import { handleAsaasEvent, orderUrl } from "@/lib/orders";
import { db } from "@/lib/db";

const STATUS_BY_EVENT: Record<string, AsaasPaymentStatus> = {
  PAYMENT_CONFIRMED: "CONFIRMED",
  PAYMENT_REPROVED_BY_RISK_ANALYSIS: "PENDING",
  PAYMENT_OVERDUE: "OVERDUE",
};

/** Simula o webhook que a Asaas enviaria, passando pelo mesmo handler do webhook real. */
export async function simulatePayment(form: FormData) {
  if (!env.ASAAS_MOCK) throw new Error("Disponível só em modo simulado");
  const paymentId = String(form.get("paymentId"));
  const event = String(form.get("outcome"));
  const payment = await mockSetStatus(paymentId, STATUS_BY_EVENT[event] ?? "PENDING");
  if (!payment) throw new Error("Cobrança não encontrada");

  await handleAsaasEvent({ id: `evt_mock_${randomUUID()}`, event, payment });

  const order = payment.externalReference ? await db.order.findUnique({ where: { id: payment.externalReference } }) : null;
  if (order) redirect(orderUrl(order.id, order.accessToken));
}
