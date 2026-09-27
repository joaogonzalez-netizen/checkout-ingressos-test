import Link from "next/link";
import { db } from "@/lib/db";
import { formatBRL } from "@/lib/money";
import { canPublish, eventChecklist } from "@/lib/event-checklist";
import { setEventStatus } from "../actions";
import { LOT_CATEGORY_LABEL } from "../labels";
import { getEvent } from "./data";
import { ArchiveButton } from "../ArchiveButton";

export default async function EventOverview({ params, searchParams }: PageProps<"/admin/events/[id]">) {
  const { id } = await params;
  const { published } = await searchParams;
  const event = await getEvent(id);

  const [paid, pending, conflicts] = await Promise.all([
    db.order.aggregate({ where: { eventId: id, status: "paid" }, _sum: { totalCents: true, ticketCents: true }, _count: true }),
    db.order.count({ where: { eventId: id, status: "pending" } }),
    db.auditLog.findMany({
      where: { entity: "order", action: "paid_after_release_conflict", entityId: { in: (await db.order.findMany({ where: { eventId: id }, select: { id: true } })).map((o) => o.id) } },
    }),
  ]);
  const checklist = eventChecklist(event);
  const ready = canPublish(checklist);
  const seatsAvailable = event.seats.filter((s) => s.status === "available").length;

  return (
    <>
      {published && <p className="bo-success" style={{ marginBottom: 16 }}>Evento publicado! O link público já está no ar.</p>}
      {event.archivedAt && (
        <p className="bo-warn" style={{ marginBottom: 16 }}>
          Evento arquivado: não aparece na lista de eventos ativos. Pedidos e ingressos continuam guardados.
        </p>
      )}
      {conflicts.length > 0 && (
        <p className="bo-error" style={{ marginBottom: 16 }}>
          {conflicts.length} pedido(s) pago(s) depois de a reserva expirar, e a vaga já tinha sido vendida. Estorne ou realoque
          manualmente: {conflicts.map((c) => c.entityId.slice(-8).toUpperCase()).join(", ")}.
        </p>
      )}

      <div className="bo-stats">
        <div className="bo-stat">
          <b>{paid._count}</b>
          <span>ingressos pagos</span>
        </div>
        <div className="bo-stat">
          <b>{formatBRL(paid._sum.totalCents ?? 0)}</b>
          <span>receita bruta (com taxa)</span>
        </div>
        <div className="bo-stat">
          <b>{formatBRL(paid._sum.ticketCents ?? 0)}</b>
          <span>valor de ingressos</span>
        </div>
        <div className="bo-stat">
          <b>{pending}</b>
          <span>aguardando pagamento</span>
        </div>
        {event.seatingMode === "seated" && (
          <div className="bo-stat">
            <b>{seatsAvailable}</b>
            <span>poltronas livres</span>
          </div>
        )}
      </div>

      <div className="bo-card">
        <h2>Vendas por lote</h2>
        {event.lots.length === 0 ? (
          <div className="bo-empty">
            Nenhum lote. <Link href={`/admin/events/${id}/edit/3`}>Cadastrar lotes</Link>
          </div>
        ) : (
          <table className="bo-table">
            <thead>
              <tr>
                <th>Lote</th>
                <th>Categoria</th>
                <th>Preço</th>
                <th>Vendidos</th>
                <th>Reservados</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {event.lots.map((l) => (
                <tr key={l.id}>
                  <td>{l.name}</td>
                  <td>{LOT_CATEGORY_LABEL[l.category]}</td>
                  <td>{formatBRL(l.priceCents)}</td>
                  <td>{l.sold}</td>
                  <td>{l.reserved - l.sold}</td>
                  <td>{l.quantity}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="bo-card">
        <div className="bo-page-head" style={{ marginBottom: 8 }}>
          <h2 style={{ margin: 0 }}>Publicação</h2>
          <ArchiveButton eventId={id} archived={!!event.archivedAt} published={event.status === "published"} small />
        </div>
        {event.status === "draft" && (
          <div className="bo-actions">
            <span className="muted">{ready ? "Tudo pronto para publicar." : "Ainda faltam itens obrigatórios."}</span>
            <Link href={`/admin/events/${id}/edit/6`} className="bo-btn bo-btn-primary">
              Revisar e publicar
            </Link>
          </div>
        )}
        {event.status === "published" && (
          <div className="bo-actions">
            <form action={setEventStatus.bind(null, id, "closed")}>
              <button className="bo-btn">Encerrar vendas</button>
            </form>
            <form action={setEventStatus.bind(null, id, "draft")}>
              <button className="bo-btn bo-btn-danger">Despublicar (tira a página do ar)</button>
            </form>
            <span className="muted small">Os pedidos nunca são apagados.</span>
          </div>
        )}
        {event.status === "closed" && (
          <div className="bo-actions">
            <span className="muted">Vendas encerradas. A página mostra o aviso de encerramento.</span>
            <form action={setEventStatus.bind(null, id, "published")}>
              <button className="bo-btn">Reabrir vendas</button>
            </form>
          </div>
        )}
      </div>
    </>
  );
}
