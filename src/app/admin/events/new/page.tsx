import Link from "next/link";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { createDraftEvent } from "../actions";
import { WIZARD_STEPS } from "../labels";

export const metadata = { title: "Novo evento · Backoffice" };

/** Etapa 0 — obrigatória e sempre a primeira: escolher o artista. */
export default async function NewEventPage({ searchParams }: PageProps<"/admin/events/new">) {
  await requireAdmin();
  const { q, artistId } = await searchParams;
  const query = typeof q === "string" ? q.trim() : "";
  const artists = await db.artist.findMany({
    where: { archivedAt: null, ...(query ? { name: { contains: query, mode: "insensitive" } } : {}) },
    orderBy: { name: "asc" },
  });

  return (
    <>
      <div className="bo-page-head">
        <div>
          <Link href="/admin/events" className="small">
            ← Eventos
          </Link>
          <h1>Novo evento</h1>
        </div>
      </div>
      <div className="bo-steps">
        {WIZARD_STEPS.map((s) => (
          <span key={s.step} className={`bo-step${s.step === 0 ? " current" : ""}`}>
            {s.step}. {s.label}
          </span>
        ))}
      </div>
      <div className="bo-card">
        <h2>De qual artista é este show?</h2>
        <p className="muted small" style={{ marginTop: -6 }}>
          A página já nasce com as cores, o pixel e os textos do artista.
        </p>
        <form style={{ margin: "12px 0" }}>
          <input className="bo-input" name="q" placeholder="Buscar artista por nome" defaultValue={query} />
        </form>
        {artists.length === 0 ? (
          <div className="bo-empty">
            Nenhum artista encontrado. <Link href="/admin/artists/new">Cadastrar um novo artista</Link>
          </div>
        ) : (
          <form action={createDraftEvent} className="bo-form">
            <div className="bo-radio-row">
              {artists.map((a) => (
                <label key={a.id} className="bo-radio-card">
                  <input type="radio" name="artistId" value={a.id} required defaultChecked={a.id === artistId} />
                  <span>
                    <b>{a.name}</b>
                    <br />
                    <span className="small muted">{a.defaultShowName ?? "sem espetáculo padrão"}</span>
                  </span>
                </label>
              ))}
            </div>
            <div className="bo-actions">
              <button className="bo-btn bo-btn-primary">Continuar →</button>
              <Link href="/admin/artists/new" className="bo-btn">
                Cadastrar novo artista
              </Link>
            </div>
          </form>
        )}
      </div>
    </>
  );
}
