import "@/app/admin/admin.css";
import { notFound } from "next/navigation";
import { env } from "@/lib/env";
import { mockGetPayment } from "@/lib/asaas";
import { formatBRL } from "@/lib/money";
import { simulatePayment } from "./actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Pagamento de teste", robots: { index: false } };

/** Fatura simulada (dev ou DEMO_MODE): substitui a tela de pagamento da Asaas. */
export default async function MockInvoice({ params }: PageProps<"/dev/asaas/[paymentId]">) {
  if (!env.ASAAS_MOCK) notFound();
  const { paymentId } = await params;
  const payment = await mockGetPayment(paymentId);
  if (!payment) notFound();
  const pix = payment.billingType === "PIX";
  const pending = payment.status === "PENDING" && !payment.deleted;

  return (
    <div className="bo bo-login">
      <div className="bo-card bo-login-card" style={{ maxWidth: 440 }}>
        <p className="bo-demo-banner" style={{ margin: "0 0 14px" }}>🧪 Ambiente de teste · nenhum valor é cobrado</p>
        <div className="bo-brand">{pix ? "Pagamento via Pix" : "Pagamento com cartão"}</div>
        <h1 style={{ fontSize: 30, margin: "6px 0 2px" }}>{formatBRL(Math.round(payment.value * 100))}</h1>
        <p className="muted small" style={{ marginBottom: 18 }}>
          Cobrança <code>{payment.id}</code> · {pending ? "aguardando pagamento" : `status ${payment.status.toLowerCase()}`}
        </p>
        {pending ? (
          <form action={simulatePayment} className="bo-form">
            <input type="hidden" name="paymentId" value={payment.id} />
            <button className="bo-btn bo-btn-primary" name="outcome" value="PAYMENT_CONFIRMED">
              ✓ Aprovar pagamento
            </button>
            {!pix && (
              <button className="bo-btn bo-btn-danger" name="outcome" value="PAYMENT_REPROVED_BY_RISK_ANALYSIS">
                ✕ Recusar cartão
              </button>
            )}
            <button className="bo-btn" name="outcome" value="PAYMENT_OVERDUE">
              ⏱ Deixar vencer
            </button>
            <p className="bo-hint">Cada botão envia o mesmo aviso que a Asaas mandaria (webhook) e leva ao pedido.</p>
          </form>
        ) : (
          <p className="bo-success">Esta cobrança já foi processada.</p>
        )}
      </div>
    </div>
  );
}
