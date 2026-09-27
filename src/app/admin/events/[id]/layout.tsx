import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { env } from "@/lib/env";
import { formatDateTime } from "@/lib/dates";
import { NavLink } from "../../NavLink";
import { EVENT_STATUS_LABEL } from "../labels";
import { getEvent } from "./data";

export default async function EventLayout({ children, params }: LayoutProps<"/admin/events/[id]">) {
  await requireAdmin();
  const { id } = await params;
  const event = await getEvent(id);
  const base = `/admin/events/${id}`;
  const publicUrl = event.slug ? `${env.APP_URL}/e/${event.slug}` : null;

  return (
    <>
      <div className="bo-event-head">
        <div>
          <Link href={`/admin/artists/${event.artistId}`} className="small">
            {event.artist.name}
          </Link>
          <h1>
            {event.showName ?? "Rascunho sem nome"} <span className={`bo-badge ${event.status}`}>{EVENT_STATUS_LABEL[event.status]}</span>
            {event.archivedAt && (
              <>
                {" "}
                <span className="bo-badge archived">Arquivado</span>
              </>
            )}
          </h1>
          <div className="muted small">
            {[formatDateTime(event.startsAt), event.venueName, event.city && `${event.city}/${event.state}`].filter(Boolean).join(" · ") ||
              "Dados do evento ainda não preenchidos"}
          </div>
          {publicUrl && event.status === "published" && (
            <div className="small" style={{ marginTop: 6 }}>
              <a href={publicUrl} target="_blank" rel="noreferrer">
                {publicUrl}
              </a>
            </div>
          )}
        </div>
        <div className="bo-actions">
          <Link href={`${base}/edit/1`} className="bo-btn">
            Editar evento
          </Link>
        </div>
      </div>
      <div className="bo-event-layout">
        <nav className="bo-subnav">
          <NavLink href={base} exact>
            Visão geral
          </NavLink>
          <NavLink href={`${base}/edit`}>Editar (etapas)</NavLink>
          <NavLink href={`${base}/orders`}>Participantes</NavLink>
          <NavLink href={`${base}/checkin`}>Conferência</NavLink>
          <span title="P2">Financeiro</span>
        </nav>
        <div style={{ minWidth: 0 }}>{children}</div>
      </div>
    </>
  );
}
