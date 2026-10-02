import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { parsePalette } from "@/lib/palette";
import { fromLocalDateTime, todayLocal } from "@/lib/dates";
import { ArtistForm } from "../ArtistForm";
import { ArtistDangerZone } from "../ArtistDangerZone";

export default async function ArtistPage({ params, searchParams }: PageProps<"/admin/artists/[id]">) {
  await requireAdmin();
  const { id } = await params;
  const { created } = await searchParams;
  const artist = await db.artist.findUnique({ where: { id } });
  if (!artist) notFound();

  // O artista pode ter centenas de eventos por ano: aqui só números; a lista fica em Eventos (filtrada por artista).
  const startOfToday = fromLocalDateTime(todayLocal(), "00:00") ?? new Date();
  const [totalEvents, upcomingEvents, publishedEvents, eventsWithOrders] = await Promise.all([
    db.event.count({ where: { artistId: id } }),
    db.event.count({ where: { artistId: id, archivedAt: null, OR: [{ startsAt: { gte: startOfToday } }, { startsAt: null }] } }),
    db.event.count({ where: { artistId: id, status: "published" } }),
    db.event.count({ where: { artistId: id, orders: { some: {} } } }),
  ]);

  return (
    <>
      <div className="bo-page-head">
        <div>
          <Link href="/admin/artists" className="small">
            ← Artistas
          </Link>
          <h1>
            {artist.name} {artist.archivedAt && <span className="bo-badge archived">Desativado</span>}
          </h1>
        </div>
        {!artist.archivedAt && (
          <Link href={`/admin/events/new?artistId=${artist.id}`} className="bo-btn bo-btn-primary">
            + Novo evento deste artista
          </Link>
        )}
      </div>
      {artist.archivedAt && (
        <p className="bo-warn" style={{ marginBottom: 16 }}>
          Artista desativado: não aparece na lista nem recebe eventos novos. Reative no fim da página.
        </p>
      )}
      {created && <p className="bo-success" style={{ marginBottom: 16 }}>Artista cadastrado. Agora você já pode criar os eventos.</p>}

      <ArtistForm
        initial={{
          id: artist.id,
          name: artist.name,
          slug: artist.slug,
          backLinkUrl: artist.backLinkUrl ?? "",
          images: { logo: artist.logoUrl },
          colors: parsePalette(artist.colors),
          metaPixelId: artist.metaPixelId ?? "",
          hasCapiToken: !!artist.metaCapiTokenEnc,
          defaultShowName: artist.defaultShowName ?? "",
          defaultVslSubtitle: artist.defaultVslSubtitle ?? "",
        }}
      />

      <div className="bo-card" style={{ marginTop: 16 }}>
        <div className="bo-page-head" style={{ marginBottom: 0 }}>
          <div>
            <h2 style={{ marginBottom: 2 }}>Eventos</h2>
            <p className="muted" style={{ margin: 0 }}>
              {totalEvents === 0
                ? "Nenhum evento ainda."
                : `${totalEvents} ${totalEvents === 1 ? "evento" : "eventos"} no total · ${upcomingEvents} ${upcomingEvents === 1 ? "próximo" : "próximos"}`}
            </p>
          </div>
          {totalEvents > 0 && (
            <Link href={`/admin/events?artista=${artist.id}`} className="bo-btn">
              Ver eventos de {artist.name} →
            </Link>
          )}
        </div>
      </div>

      <div style={{ marginTop: 16 }}>
        <ArtistDangerZone
          artistId={artist.id}
          name={artist.name}
          archived={!!artist.archivedAt}
          totalEvents={totalEvents}
          publishedEvents={publishedEvents}
          eventsWithOrders={eventsWithOrders}
        />
      </div>
    </>
  );
}
