"use client";

import { useActionState, useState } from "react";
import { slugify } from "@/lib/slug";
import type { Palette } from "@/lib/palette";
import { saveArtist, type ArtistFormState } from "./actions";
import { ImageUpload } from "../components/ImageUpload";
import { PaletteEditor } from "./PaletteEditor";

export type ArtistFormValues = {
  id: string | null;
  name: string;
  slug: string;
  backLinkUrl: string;
  images: { logo: string | null; cover: string | null; cover_mobile: string | null; og_image: string | null };
  colors: Palette;
  metaPixelId: string;
  hasCapiToken: boolean;
  defaultShowName: string;
  defaultVslSubtitle: string;
};

export function ArtistForm({ initial }: { initial: ArtistFormValues }) {
  const [state, action, pending] = useActionState<ArtistFormState, FormData>(saveArtist.bind(null, initial.id), {});
  const [name, setName] = useState(initial.name);
  const [slug, setSlug] = useState(initial.slug);
  const [slugTouched, setSlugTouched] = useState(!!initial.id);
  // Imagens sobem direto para o storage, então o artista precisa existir antes.
  const endpoint = initial.id ? `/api/admin/artists/${initial.id}/media` : "";
  const disabledReason = initial.id ? undefined : "Cadastre o artista primeiro; depois as imagens podem ser enviadas aqui.";

  return (
    <form action={action} className="bo-form">
      <div className="bo-card">
        <h2>Identidade</h2>
        <div className="bo-form-grid">
          <label className="bo-field">
            <span>Nome do artista</span>
            <input
              name="name"
              required
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (!slugTouched) setSlug(slugify(e.target.value));
              }}
            />
          </label>
          <label className="bo-field">
            <span>Slug</span>
            <input
              name="slug"
              required
              value={slug}
              onChange={(e) => {
                setSlugTouched(true);
                setSlug(e.target.value);
              }}
            />
            <span className="bo-hint">Usado para sugerir o link dos eventos.</span>
          </label>
          <label className="bo-field span-2">
            <span>Site ou agenda do artista (opcional)</span>
            <input name="backLinkUrl" type="url" placeholder="https://linktr.ee/…" defaultValue={initial.backLinkUrl} />
            <span className="bo-hint">Não aparece na página de vendas; só no aviso de &quot;vendas encerradas&quot;.</span>
          </label>
        </div>
        <div style={{ marginTop: 14 }}>
          <ImageUpload endpoint={endpoint} kind="logo" currentUrl={initial.images.logo} disabledReason={disabledReason} />
        </div>
      </div>

      <PaletteEditor initial={initial.colors} isNew={!initial.id} />

      <div className="bo-card">
        <h2>Pixel e rastreamento (Meta)</h2>
        <div className="bo-form-grid">
          <label className="bo-field">
            <span>Pixel ID</span>
            <input name="metaPixelId" inputMode="numeric" placeholder="1234567890" defaultValue={initial.metaPixelId} />
            <span className="bo-hint">Herdado por todos os eventos do artista; cada evento pode sobrescrever.</span>
          </label>
          <label className="bo-field">
            <span>Token da Conversions API</span>
            <input
              name="metaCapiToken"
              type="password"
              autoComplete="off"
              placeholder={initial.hasCapiToken ? "•••••• configurado — digite para trocar" : "EAAG…"}
            />
            {initial.hasCapiToken && (
              <label className="bo-hint" style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <input type="checkbox" name="clearCapiToken" value="1" /> Remover token salvo
              </label>
            )}
            <span className="bo-hint">Guardado criptografado. Usado no envio server-side do Purchase.</span>
          </label>
        </div>
      </div>

      <div className="bo-card">
        <h2>Padrões dos eventos</h2>
        <div className="bo-form-grid">
          <label className="bo-field">
            <span>Nome padrão do espetáculo</span>
            <input name="defaultShowName" placeholder="Ela tem o tino" defaultValue={initial.defaultShowName} />
          </label>
          <label className="bo-field span-2">
            <span>Subtítulo padrão da VSL</span>
            <textarea name="defaultVslSubtitle" rows={3} defaultValue={initial.defaultVslSubtitle} />
          </label>
        </div>
        <p className="bo-hint" style={{ margin: "16px 0 10px" }}>
          Imagens herdadas por todos os eventos do artista. Cada evento pode enviar as próprias na etapa &quot;Página&quot;.
        </p>
        <ImageUpload endpoint={endpoint} kind="cover" currentUrl={initial.images.cover} disabledReason={disabledReason} />
        <ImageUpload endpoint={endpoint} kind="cover_mobile" currentUrl={initial.images.cover_mobile} disabledReason={disabledReason} />
        <ImageUpload endpoint={endpoint} kind="og_image" currentUrl={initial.images.og_image} disabledReason={disabledReason} />
      </div>

      {state.error && <p className="bo-error">{state.error}</p>}
      {state.saved && <p className="bo-success">Artista salvo.</p>}
      <div className="bo-actions">
        <button className="bo-btn bo-btn-primary" disabled={pending}>
          {pending ? "Salvando…" : initial.id ? "Salvar alterações" : "Cadastrar artista"}
        </button>
      </div>
    </form>
  );
}
