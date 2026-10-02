import Link from "next/link";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { formatDateTime, fromLocalDateTime, todayLocal } from "@/lib/dates";
import { EVENT_STATUS_LABEL } from "./labels";
import { ArchiveButton } from "./ArchiveButton";

export const metadata = { title: "Eventos · Backoffice" };

const PAGE_SIZE = 30;
type Tab = "proximos" | "passados" | "arquivados";

/**
 * Lista pensada para centenas de eventos por ano: abas por período, busca, filtro por artista e paginação.
 * Próximos = ainda vão acontecer (ou sem data); Passados = já aconteceram; Arquivados = fora do dia a dia.
 */
export default async function EventsPage({ searchParams }: PageProps<"/admin/events">) {
  await requireAdmin();
  const sp = await searchParams;
  const str = (v: string | string[] | undefined) => (typeof v === "string" ? v.trim() : "");
  const tab: Tab = sp.aba === "arquivados" ? "arquivados" : sp.aba === "passados" ? "passados" : "proximos";
  const query = str(sp.q);
  const artistId = str(sp.artista);
  const page = Math.max(1, Number.parseInt(str(sp.p), 10) || 1);

  const startOfToday = fromLocalDateTime(todayLocal(), "00:00") ?? new Date();
  const base: Prisma.EventWhereInput = {
    ...(artistId ? { artistId } : {}),
    ...(query
      ? {
          OR: [
            { showName: { contains: query, mode: "insensitive" } },
            { city: { contains: query, mode: "insensitive" } },
            { venueName: { contains: query, mode: "insensitive" } },
            { artist: { name: { contains: query, mode: "insensitive" } } },
          ],
        }
      : {}),
  };
  const byTab: Record<Tab, Prisma.EventWhereInput> = {
    proximos: { archivedAt: null, OR: [{ startsAt: { gte: startOfToday } }, { startsAt: null }] },
    passados: { archivedAt: null, startsAt: { lt: startOfToday } },
    arquivados: { archivedAt: { not: null } },
  };
  const where = (t: Tab): Prisma.EventWhereInput => ({ AND: [base, byTab[t]] });

  const [counts, total, artists] = await Promise.all([
    Promise.all((["proximos", "passados", "arquivados"] as const).map((t) => db.event.count({ where: where(t) }))),
    db.event.count({ where: where(tab) }),
    db.artist.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  const [proximosCount, passadosCount, arquivadosCount] = counts;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const current = Math.min(page, pages);

  const events = await db.event.findMany({
    where: where(tab),
    orderBy:
      tab === "arquivados"
        ? [{ archivedAt: "desc" }]
        : tab === "passados"
          ? [{ startsAt: "desc" }]
          : [{ startsAt: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }],
    include: { artist: true, lots: { select: { sold: true, quantity: true } } },
    skip: (current - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
  });

  const href = (over: { aba?: Tab; p?: number }) => {
    const params = new URLSearchParams();
    const nextTab = over.aba ?? tab;
    if (nextTab !== "proximos") params.set("aba", nextTab);
    if (query) params.set("q", query);
    if (artistId) params.set("artista", artistId);
    if (over.p && over.p > 1) params.set("p", String(over.p));
    const qs = params.toString();
    return qs ? `/admin/events?${qs}` : "/admin/events";
  };
  const filtered = !!(query || artistId);
  const artistName = artists.find((a) => a.id === artistId)?.name;
  const from = total === 0 ? 0 : (current - 1) * PAGE_SIZE + 1;
  const to = Math.min(current * PAGE_SIZE, total);

  return (
    <>
      <div className="bo-page-head">
        <div>
          <h1>Eventos</h1>
          <p className="muted">{artistName ? `Eventos de ${artistName}.` : "Todo evento nasce de um artista."}</p>
        </div>
        <Link href={artistId ? `/admin/events/new?artistId=${artistId}` : "/admin/events/new"} className="bo-btn bo-btn-primary">
          + Novo evento
        </Link>
      </div>

      <nav className="bo-tabs" aria-label="Período dos eventos">
        <Link href={href({ aba: "proximos" })} aria-current={tab === "proximos" ? "page" : undefined}>
          Próximos <span>{proximosCount}</span>
        </Link>
        <Link href={href({ aba: "passados" })} aria-current={tab === "passados" ? "page" : undefined}>
          Passados <span>{passadosCount}</span>
        </Link>
        <Link href={href({ aba: "arquivados" })} aria-current={tab === "arquivados" ? "page" : undefined}>
          Arquivados <span>{arquivadosCount}</span>
        </Link>
      </nav>

      <div className="bo-card">
        <form className="bo-actions" style={{ marginBottom: 14 }} role="search">
          {tab !== "proximos" && <input type="hidden" name="aba" value={tab} />}
          <input
            className="bo-input"
            style={{ flex: 1, minWidth: 220 }}
            name="q"
            placeholder="Buscar por show, cidade, local ou artista"
            defaultValue={query}
            aria-label="Buscar eventos"
          />
          <select className="bo-input" style={{ width: "auto", maxWidth: 240 }} name="artista" defaultValue={artistId} aria-label="Filtrar por artista">
            <option value="">Todos os artistas</option>
            {artists.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
          <button className="bo-btn">Filtrar</button>
          {filtered && (
            <Link href={tab === "proximos" ? "/admin/events" : `/admin/events?aba=${tab}`} className="small">
              Limpar filtros
            </Link>
          )}
        </form>

        {events.length === 0 ? (
          <div className="bo-empty">
            {filtered ? (
              "Nenhum evento encontrado com esses filtros."
            ) : tab === "arquivados" ? (
              "Nenhum evento arquivado."
            ) : tab === "passados" ? (
              "Nenhum evento passado."
            ) : (
              <>
                Nenhum evento por vir. <Link href="/admin/events/new">Criar um evento</Link>.
              </>
            )}
          </div>
        ) : (
          <>
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
                    const totalTickets = e.lots.reduce((a, l) => a + l.quantity, 0);
                    return (
                      <tr key={e.id}>
                        <td>
                          <Link href={e.status === "draft" && !e.archivedAt ? `/admin/events/${e.id}/edit` : `/admin/events/${e.id}`}>
                            <b>{e.showName ?? "Rascunho sem nome"}</b>
                          </Link>
                          <div className="small muted">{[e.city && `${e.city}/${e.state}`, e.venueName].filter(Boolean).join(" · ")}</div>
                        </td>
                        <td>{e.artist.name}</td>
                        <td>{formatDateTime(e.startsAt) || <span className="muted">—</span>}</td>
                        <td>{totalTickets ? `${sold} / ${totalTickets}` : <span className="muted">—</span>}</td>
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
            {pages > 1 && (
              <nav className="bo-pager" aria-label="Páginas">
                <span className="small muted">
                  {from}–{to} de {total}
                </span>
                <span className="bo-actions">
                  {current > 1 ? (
                    <Link className="bo-btn bo-btn-sm" href={href({ p: current - 1 })}>
                      ← Anterior
                    </Link>
                  ) : (
                    <span className="bo-btn bo-btn-sm" aria-disabled="true" style={{ opacity: 0.45 }}>
                      ← Anterior
                    </span>
                  )}
                  <span className="small">
                    Página {current} de {pages}
                  </span>
                  {current < pages ? (
                    <Link className="bo-btn bo-btn-sm" href={href({ p: current + 1 })}>
                      Próxima →
                    </Link>
                  ) : (
                    <span className="bo-btn bo-btn-sm" aria-disabled="true" style={{ opacity: 0.45 }}>
                      Próxima →
                    </span>
                  )}
                </span>
              </nav>
            )}
          </>
        )}
      </div>
    </>
  );
}
