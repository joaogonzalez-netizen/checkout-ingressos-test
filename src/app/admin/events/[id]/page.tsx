import Link from "next/link";
import { db } from "@/lib/db";
import { formatBRL } from "@/lib/money";
import { canPublish, eventChecklist } from "@/lib/event-checklist";
import { LOT_CATEGORY_LABEL } from "../labels";
import { env } from "@/lib/env";
import { getEvent } from "./data";

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
  const missing = checklist.filter((c) => !c.done).length;
  const nextStep = Math.min(Math.max(event.wizardStep + 1, 1), 6);
  const seatsAvailable = event.seats.filter((s) => s.status === "available").length;

  return (
    <>
      {published && <p className="bo-success" style={{ marginBottom: 16 }}>Evento publicado! O link público já está no ar.</p>}
      {event.archivedAt && (
        <p className="bo-warn" style={{ marginBottom: 16 }}>
          Evento arquivado: não aparece na lista de eventos ativos. Para desarquivar, vá em Configurar → Publicação.
        </p>
      )}
      {conflicts.length > 0 && (
        <p className="bo-error" style={{ marginBottom: 16 }}>
          {conflicts.length} pedido(s) pago(s) depois de a reserva expirar, e a vaga já tinha sido vendida. Estorne ou realoque
          manualmente: {conflicts.map((c) => c.entityId.slice(-8).toUpperCase()).join(", ")}.
        </p>
      )}

      <section className="bo-status-strip" aria-label="Situação do evento">
        {event.status === "draft" && (
          <>
            <p>
              <b>Rascunho</b>
              <span className="muted">
                {" · "}
                {ready ? "tudo pronto para publicar" : `faltam ${missing} ${missing === 1 ? "item obrigatório" : "itens obrigatórios"} para publicar`}
              </span>
            </p>
            <Link href={`/admin/events/${id}/edit/${ready ? 6 : nextStep}`} className="bo-btn bo-btn-primary">
              {ready ? "Revisar e publicar" : "Continuar configuração"}
            </Link>
          </>
        )}
        {event.status === "published" && (
          <p>
            <b>No ar</b>
            <span className="muted"> · vendas abertas</span>
            {event.slug && (
              <>
                {" · "}
                <a href={`${env.APP_URL}/e/${event.slug}`} target="_blank" rel="noreferrer">
                  {env.APP_URL.replace(/^https?:\/\//, "")}/e/{event.slug}
                </a>
              </>
            )}
          </p>
        )}
        {event.status === "closed" && (
          <>
            <p>
              <b>Vendas encerradas</b>
              <span className="muted"> · a página mostra o aviso de encerramento</span>
            </p>
            <Link href={`/admin/events/${id}/edit/6`} className="bo-btn">
              Gerenciar publicação
            </Link>
          </>
        )}
      </section>

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
    </>
  );
}
