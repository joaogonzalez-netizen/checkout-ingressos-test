import Link from "next/link";
import { db } from "@/lib/db";
import { formatBRL } from "@/lib/money";
import { formatCpfCnpj, formatPhone } from "@/lib/documents";
import { ORDER_STATUS_LABEL } from "../events/labels";

const METHOD = { pix: "Pix", credit_card: "Cartão" } as const;

type Search = { q?: string | string[]; status?: string | string[] };

/** Lista de pedidos com busca. Sem `eventId` procura em todos os eventos (menu Vendas). */
export async function OrdersView({ eventId, search, title }: { eventId?: string; search: Search; title?: string }) {
  const { q, status } = search;
  const query = typeof q === "string" ? q.trim() : "";
  const statusFilter = typeof status === "string" && status in ORDER_STATUS_LABEL ? (status as keyof typeof ORDER_STATUS_LABEL) : undefined;
  const digits = query.replace(/\D/g, "");

  const orders = await db.order.findMany({
    where: {
      ...(eventId ? { eventId } : {}),
      status: statusFilter,
      ...(query
        ? {
            OR: [
              { buyerName: { contains: query, mode: "insensitive" } },
              { buyerEmail: { contains: query, mode: "insensitive" } },
              { id: { endsWith: query.toLowerCase() } },
              ...(digits.length >= 3 ? [{ buyerCpfCnpj: { contains: digits } }, { buyerPhone: { contains: digits } }] : []),
              { tickets: { some: { code: query.toUpperCase() } } },
            ],
          }
        : {}),
    },
    include: { items: { include: { lot: true } }, seat: true, tickets: true, event: { select: { id: true, showName: true, city: true } } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return (
    <div className="bo-card">
      {title && <h2>{title}</h2>}
      <form className="bo-actions" style={{ marginBottom: 14 }}>
        <input className="bo-input" style={{ flex: 1, minWidth: 220 }} name="q" placeholder="Nome, e-mail, telefone, CPF, código do ingresso ou nº do pedido" defaultValue={query} />
        <select className="bo-input" style={{ width: "auto" }} name="status" defaultValue={statusFilter ?? ""}>
          <option value="">Todos os status</option>
          {Object.entries(ORDER_STATUS_LABEL).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <button className="bo-btn">Filtrar</button>
      </form>
      {orders.length === 0 ? (
        <div className="bo-empty">Nenhum pedido encontrado.</div>
      ) : (
        <div className="bo-table-wrap">
          <table className="bo-table">
            <thead>
              <tr>
                <th>Pedido</th>
                {!eventId && <th>Evento</th>}
                <th>Comprador</th>
                <th>Ingresso</th>
                <th>Códigos</th>
                <th>Pagamento</th>
                <th>Total</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id}>
                  <td>
                    <code>{o.id.slice(-8).toUpperCase()}</code>
                    <div className="small muted">{o.createdAt.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}</div>
                  </td>
                  {!eventId && (
                    <td>
                      <Link href={`/admin/events/${o.event.id}`}>{o.event.showName ?? "Rascunho"}</Link>
                      {o.event.city && <div className="small muted">{o.event.city}</div>}
                    </td>
                  )}
                  <td>
                    {o.buyerName}
                    <div className="small muted">
                      {o.buyerEmail} · {formatCpfCnpj(o.buyerCpfCnpj)}
                      {o.buyerPhone ? ` · ${formatPhone(o.buyerPhone)}` : ""}
                      {o.marketingOptIn && <span className="bo-chip" style={{ marginLeft: 6 }}>aceita comunicações</span>}
                    </div>
                  </td>
                  <td>
                    {o.items.map((i) => `${i.quantity}x ${i.lot.name}`).join(", ")}
                    {o.seat && <div className="small muted">Poltrona {o.seat.row}{o.seat.number}</div>}
                  </td>
                  <td>
                    {o.tickets.length ? o.tickets.map((t) => <code key={t.id} style={{ marginRight: 4 }}>{t.code}</code>) : <span className="muted">—</span>}
                  </td>
                  <td>
                    {METHOD[o.paymentMethod]}
                    {o.installments > 1 ? ` ${o.installments}x` : ""}
                    {o.asaasPaymentId && <div className="small muted">{o.asaasPaymentId}</div>}
                  </td>
                  <td>{formatBRL(o.totalCents)}</td>
                  <td>
                    <span className={`bo-badge ${o.status}`}>{ORDER_STATUS_LABEL[o.status]}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
