import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { parsePalette } from "@/lib/palette";
import { formatDateTime } from "@/lib/dates";
import { ArtistForm } from "../ArtistForm";
import { ArtistDangerZone } from "../ArtistDangerZone";
import { EVENT_STATUS_LABEL } from "../../events/labels";

export default async function ArtistPage({ params, searchParams }: PageProps<"/admin/artists/[id]">) {
  await requireAdmin();
  const { id } = await params;
  const { created } = await searchParams;
  const artist = await db.artist.findUnique({
    where: { id },
    include: { events: { orderBy: { startsAt: "desc" }, include: { _count: { select: { orders: true } } } } },
  });
  if (!artist) notFound();

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

      <div className="bo-card" style={{ marginBottom: 16 }}>
        <h2>Eventos</h2>
        {artist.events.length === 0 ? (
          <div className="bo-empty">Nenhum evento ainda.</div>
        ) : (
          <table className="bo-table">
            <tbody>
              {artist.events.map((e) => (
                <tr key={e.id}>
                  <td>
                    <Link href={`/admin/events/${e.id}`}>
                      <b>{e.showName ?? "Rascunho sem nome"}</b>
                    </Link>
                    <div className="small muted">
                      {[e.city && `${e.city}/${e.state}`, e.venueName].filter(Boolean).join(" · ")}
                    </div>
                  </td>
                  <td>{formatDateTime(e.startsAt) || <span className="muted">sem data</span>}</td>
                  <td>
                    <span className={`bo-badge ${e.status}`}>{EVENT_STATUS_LABEL[e.status]}</span>
                    {e.archivedAt && (
                      <>
                        {" "}
                        <span className="bo-badge archived">Arquivado</span>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <ArtistForm
        initial={{
          id: artist.id,
          name: artist.name,
          slug: artist.slug,
          backLinkUrl: artist.backLinkUrl ?? "",
          images: {
            logo: artist.logoUrl,
            cover: artist.defaultCoverUrl,
            cover_mobile: artist.defaultCoverMobileUrl,
            og_image: artist.defaultOgImageUrl,
          },
          colors: parsePalette(artist.colors),
          metaPixelId: artist.metaPixelId ?? "",
          hasCapiToken: !!artist.metaCapiTokenEnc,
          defaultShowName: artist.defaultShowName ?? "",
          defaultVslSubtitle: artist.defaultVslSubtitle ?? "",
        }}
      />

      <div style={{ marginTop: 16 }}>
        <ArtistDangerZone
          artistId={artist.id}
          name={artist.name}
          archived={!!artist.archivedAt}
          totalEvents={artist.events.length}
          publishedEvents={artist.events.filter((e) => e.status === "published").length}
          eventsWithOrders={artist.events.filter((e) => e._count.orders > 0).length}
        />
      </div>
    </>
  );
}
