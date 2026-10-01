import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { env } from "@/lib/env";
import { formatDateTime } from "@/lib/dates";
import { NavLink } from "../../NavLink";
import { Icon } from "../../components/Icon";
import { EVENT_STATUS_LABEL } from "../labels";
import { getEvent } from "./data";

/** Um evento = um cabeçalho + 4 abas. Operar (visão geral, vendas, check-in) e configurar ficam em abas separadas. */
export default async function EventLayout({ children, params }: LayoutProps<"/admin/events/[id]">) {
  await requireAdmin();
  const { id } = await params;
  const event = await getEvent(id);
  const base = `/admin/events/${id}`;
  const publicUrl = event.slug ? `${env.APP_URL}/e/${event.slug}` : null;

  return (
    <>
      <header className="bo-event-head">
        <div className="bo-event-top">
          <div>
            <Link href="/admin/events" className="bo-back">
              <Icon name="arrow-left" size={15} /> Eventos
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
              <Link href={`/admin/artists/${event.artistId}`}>{event.artist.name}</Link>
              {" · "}
              {[formatDateTime(event.startsAt), event.venueName, event.city && `${event.city}/${event.state}`].filter(Boolean).join(" · ") ||
                "Dados do evento ainda não preenchidos"}
            </div>
          </div>
          {publicUrl && event.status === "published" && (
            <a href={publicUrl} target="_blank" rel="noreferrer" className="bo-btn bo-btn-sm bo-no-print">
              Ver página <Icon name="external" size={14} />
            </a>
          )}
        </div>
        <nav className="bo-tabs bo-event-tabs" aria-label="Seções do evento">
          <NavLink href={base} exact>
            Visão geral
          </NavLink>
          <NavLink href={`${base}/orders`}>Vendas</NavLink>
          <NavLink href={`${base}/checkin`}>Check-in</NavLink>
          <NavLink href={`${base}/edit`}>Configurar</NavLink>
        </nav>
      </header>
      <div style={{ minWidth: 0 }}>{children}</div>
    </>
  );
}
