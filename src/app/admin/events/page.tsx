import Link from "next/link";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { formatDateTime } from "@/lib/dates";
import { EVENT_STATUS_LABEL } from "./labels";
import { ArchiveButton } from "./ArchiveButton";

export const metadata = { title: "Eventos · Backoffice" };

export default async function EventsPage({ searchParams }: PageProps<"/admin/events">) {
  await requireAdmin();
  const { aba } = await searchParams;
  const archivedTab = aba === "arquivados";
  const [activeCount, archivedCount] = await Promise.all([
    db.event.count({ where: { archivedAt: null } }),
    db.event.count({ where: { archivedAt: { not: null } } }),
  ]);
  const events = await db.event.findMany({
    where: { archivedAt: archivedTab ? { not: null } : null },
    orderBy: archivedTab ? [{ archivedAt: "desc" }] : [{ startsAt: "asc" }, { createdAt: "desc" }],
    include: { artist: true, lots: { select: { sold: true, quantity: true } } },
  });

  return (
    <>
      <div className="bo-page-head">
        <div>
          <h1>Eventos</h1>
          <p className="muted">Todo evento nasce de um artista.</p>
        </div>
        <Link href="/admin/events/new" className="bo-btn bo-btn-primary">
          + Novo evento
        </Link>
      </div>
      <nav className="bo-tabs" aria-label="Filtrar eventos">
        <Link href="/admin/events" aria-current={!archivedTab ? "page" : undefined}>
          Ativos <span>{activeCount}</span>
        </Link>
        <Link href="/admin/events?aba=arquivados" aria-current={archivedTab ? "page" : undefined}>
          Arquivados <span>{archivedCount}</span>
        </Link>
      </nav>
      <div className="bo-card">
        {events.length === 0 ? (
          <div className="bo-empty">
            {archivedTab ? "Nenhum evento arquivado." : "Nenhum evento ativo. Comece cadastrando um artista."}
          </div>
        ) : (
          <div className="bo-table-wrap">
            <table className="bo-table">
              <thead>
                <tr>
                  <th>Evento</th>
                  <th>Artista</th>
                  <th>Data</th>
                  <th>Vendidos</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {events.map((e) => {
                  const sold = e.lots.reduce((a, l) => a + l.sold, 0);
                  const total = e.lots.reduce((a, l) => a + l.quantity, 0);
                  return (
                    <tr key={e.id}>
                      <td>
                        <Link href={`/admin/events/${e.id}`}>
                          <b>{e.showName ?? "Rascunho sem nome"}</b>
                        </Link>
                        <div className="small muted">
                          {[e.city && `${e.city}/${e.state}`, e.venueName].filter(Boolean).join(" · ")}
                        </div>
                      </td>
                      <td>{e.artist.name}</td>
                      <td>{formatDateTime(e.startsAt) || <span className="muted">—</span>}</td>
                      <td>{total ? `${sold} / ${total}` : <span className="muted">—</span>}</td>
                      <td>
                        <span className={`bo-badge ${e.status}`}>{EVENT_STATUS_LABEL[e.status]}</span>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <ArchiveButton eventId={e.id} archived={!!e.archivedAt} published={e.status === "published"} small />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
