import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { DEFAULT_PALETTE } from "@/lib/palette";
import { suggestPalette } from "@/lib/palette-suggest";
import { ArtistForm } from "../ArtistForm";

export const metadata = { title: "Novo artista · Backoffice" };

export default async function NewArtistPage() {
  await requireAdmin();
  return (
    <>
      <div className="bo-page-head">
        <div>
          <Link href="/admin/artists" className="small">
            ← Artistas
          </Link>
          <h1>Novo artista</h1>
        </div>
      </div>
      <ArtistForm
        initial={{
          id: null,
          name: "",
          slug: "",
          backLinkUrl: "",
          images: { logo: null, cover: null, cover_mobile: null, og_image: null },
          colors: suggestPalette(DEFAULT_PALETTE.primary),
          metaPixelId: "",
          hasCapiToken: false,
          defaultShowName: "",
          defaultVslSubtitle: "",
        }}
      />
    </>
  );
}
