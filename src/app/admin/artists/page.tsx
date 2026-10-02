import Link from "next/link";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { parsePalette } from "@/lib/palette";

export const metadata = { title: "Artistas · Backoffice" };

export default async function ArtistsPage({ searchParams }: PageProps<"/admin/artists">) {
  await requireAdmin();
  const { q, desativados, deleted } = await searchParams;
  const query = typeof q === "string" ? q.trim() : "";
  const showArchived = desativados === "1";
  const archivedCount = await db.artist.count({ where: { archivedAt: { not: null } } });
  const artists = await db.artist.findMany({
    where: {
      ...(query ? { name: { contains: query, mode: "insensitive" } } : {}),
      ...(showArchived ? {} : { archivedAt: null }),
    },
    orderBy: { name: "asc" },
    include: { _count: { select: { events: true } } },
  });

  return (
    <>
      <div className="bo-page-head">
        <div>
          <h1>Artistas</h1>
          <p className="muted">Marca, cores, pixel e textos cadastrados uma vez e herdados por todos os shows. As imagens são de cada evento.</p>
        </div>
        <Link href="/admin/artists/new" className="bo-btn bo-btn-primary">
          + Novo artista
        </Link>
      </div>
      {deleted && <p className="bo-success" style={{ marginBottom: 16 }}>Artista excluído.</p>}
      <div className="bo-card">
        <form className="bo-actions" style={{ marginBottom: 14 }}>
          <input className="bo-input" style={{ flex: 1, minWidth: 220 }} name="q" placeholder="Buscar por nome" defaultValue={query} />
          {archivedCount > 0 && (
            <label className="small" style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <input type="checkbox" name="desativados" value="1" defaultChecked={showArchived} /> Mostrar desativados ({archivedCount})
            </label>
          )}
          <button className="bo-btn">Filtrar</button>
        </form>
        {artists.length === 0 ? (
          <div className="bo-empty">{query ? "Nenhum artista encontrado." : "Nenhum artista cadastrado ainda."}</div>
        ) : (
          <div className="bo-table-wrap">
            <table className="bo-table">
              <thead>
                <tr>
                  <th>Artista</th>
                  <th>Cores</th>
                  <th>Pixel</th>
                  <th>Eventos</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {artists.map((a) => {
                  const p = parsePalette(a.colors);
                  return (
                    <tr key={a.id}>
                      <td>
                        <Link href={`/admin/artists/${a.id}`}>
                          <b>{a.name}</b>
                        </Link>
                        {a.archivedAt && (
                          <>
                            {" "}
                            <span className="bo-badge archived">Desativado</span>
                          </>
                        )}
                      </td>
                      <td>
                        <span style={{ display: "inline-flex", gap: 4 }}>
                          {[p.primary, p.secondary, p.accent, p.background].map((c, i) => (
                            <i key={i} style={{ width: 16, height: 16, borderRadius: 4, background: c, border: "1px solid #0002" }} />
                          ))}
                        </span>
                      </td>
                      <td>{a.metaPixelId ? <code>{a.metaPixelId}</code> : <span className="muted">—</span>}</td>
                      <td>{a._count.events}</td>
                      <td style={{ textAlign: "right" }}>
                        {!a.archivedAt && (
                          <Link href={`/admin/events/new?artistId=${a.id}`} className="bo-btn bo-btn-sm">
                            Novo evento
                          </Link>
                        )}
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
