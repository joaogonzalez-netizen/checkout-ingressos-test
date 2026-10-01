import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { formatDateTime, toLocalDate, todayLocal } from "@/lib/dates";

export const metadata = { title: "Check-in · Backoffice" };

/** Atalho da portaria: vai direto ao check-in do show de hoje; havendo mais de um, pergunta qual. */
export default async function CheckinHome() {
  await requireAdmin();
  // Vendas encerradas não impedem o check-in: o show ainda vai acontecer.
  const events = await db.event.findMany({
    where: { status: { in: ["published", "closed"] }, archivedAt: null },
    orderBy: { startsAt: "asc" },
    include: { artist: true },
  });
  const today = todayLocal();
  const upcoming = events.filter((e) => e.startsAt && toLocalDate(e.startsAt) >= today);
  const isToday = (d: Date | null) => !!d && toLocalDate(d) === today;
  const tonight = upcoming.filter((e) => isToday(e.startsAt));

  const only = tonight.length === 1 ? tonight[0] : tonight.length === 0 && upcoming.length === 1 ? upcoming[0] : null;
  if (only) redirect(`/admin/events/${only.id}/checkin`);

  return (
    <>
      <div className="bo-page-head">
        <div>
          <h1>Check-in</h1>
          <p className="muted">{upcoming.length ? "Escolha o evento da portaria." : "Nenhum evento com check-in disponível."}</p>
        </div>
      </div>
      <div className="bo-card">
        {upcoming.length === 0 ? (
          <div className="bo-empty">
            O check-in abre para eventos publicados com data de hoje em diante. <Link href="/admin/events">Ver eventos</Link>
          </div>
        ) : (
          <ul className="bo-pick-list">
            {upcoming.map((e) => (
              <li key={e.id}>
                <Link href={`/admin/events/${e.id}/checkin`} className="bo-pick">
                  <span>
                    <b>{e.showName ?? "Evento sem nome"}</b>
                    {isToday(e.startsAt) && <span className="bo-badge published">Hoje</span>}
                    <span className="small muted">
                      {e.artist.name} · {formatDateTime(e.startsAt)}
                      {e.venueName ? ` · ${e.venueName}` : ""}
                    </span>
                  </span>
                  <span className="bo-pick-go">Abrir check-in →</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
