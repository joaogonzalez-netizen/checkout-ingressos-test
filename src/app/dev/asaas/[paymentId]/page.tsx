import { notFound } from "next/navigation";
import { env } from "@/lib/env";
import { mockGetPayment } from "@/lib/asaas";
import { formatBRL } from "@/lib/money";
import { simulatePayment } from "./actions";

export const dynamic = "force-dynamic";

/** Fatura simulada da Asaas. Só existe em modo simulado (sem ASAAS_API_KEY, fora de produção). */
export default async function MockInvoice({ params }: PageProps<"/dev/asaas/[paymentId]">) {
  if (!env.ASAAS_MOCK) notFound();
  const { paymentId } = await params;
  const payment = mockGetPayment(paymentId);
  if (!payment) notFound();

  return (
    <main style={{ maxWidth: 420, margin: "60px auto", padding: 24, fontFamily: "system-ui", border: "1px dashed #999", borderRadius: 12 }}>
      <p style={{ fontSize: 12, color: "#a15c00", fontWeight: 700 }}>ASAAS SIMULADA · ambiente de desenvolvimento</p>
      <h1 style={{ fontSize: 20 }}>{payment.billingType === "PIX" ? "Pix" : "Cartão de crédito"}</h1>
      <p>
        Cobrança <code>{payment.id}</code> · {formatBRL(Math.round(payment.value * 100))} · status <b>{payment.status}</b>
      </p>
      <form action={simulatePayment} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input type="hidden" name="paymentId" value={payment.id} />
        <button name="outcome" value="PAYMENT_CONFIRMED">Aprovar pagamento</button>
        {payment.billingType !== "PIX" && (
          <button name="outcome" value="PAYMENT_REPROVED_BY_RISK_ANALYSIS">Recusar cartão</button>
        )}
        <button name="outcome" value="PAYMENT_OVERDUE">Deixar vencer</button>
      </form>
    </main>
  );
}
