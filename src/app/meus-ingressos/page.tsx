import "@/components/checkout/checkout.css";
import Link from "next/link";
import { db } from "@/lib/db";
import { DEFAULT_PALETTE, paletteStyle, parsePalette } from "@/lib/palette";
import { LookupForm } from "./LookupForm";

export const metadata = { title: "Meus ingressos", robots: { index: false } };
export const dynamic = "force-dynamic";

/** Consulta de ingressos: o comprador digita o CPF ou o celular e vê os QR Codes. `?e=slug` herda as cores do evento. */
export default async function MyTickets({ searchParams }: PageProps<"/meus-ingressos">) {
  const { e } = await searchParams;
  const slug = typeof e === "string" ? e : null;
  const event = slug
    ? await db.event.findUnique({ where: { slug }, select: { slug: true, showName: true, artist: { select: { name: true, colors: true, logoUrl: true } } } })
    : null;
  const palette = event ? parsePalette(event.artist.colors) : DEFAULT_PALETTE;

  return (
    <div className="tpl" style={paletteStyle(palette)}>
      <header className="nav">
        <div className="nav-inner">
          <div className="nav-logo">
            {event?.artist.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={event.artist.logoUrl} alt={event.artist.name} />
            ) : (
              (event?.artist.name ?? "Meus ingressos")
            )}
          </div>
          {event?.slug && (
            <Link className="nav-link" href={`/e/${event.slug}`}>
              ← Voltar ao evento
            </Link>
          )}
        </div>
      </header>
      <main className="wrap lookup-wrap">
        <div className="checkout-heading">
          <h1>Meus ingressos</h1>
          <p>Digite o CPF (ou celular) e o e-mail usados na compra para ver seus ingressos.</p>
        </div>
        <LookupForm eventSlug={event?.slug ?? null} />
      </main>
    </div>
  );
}
