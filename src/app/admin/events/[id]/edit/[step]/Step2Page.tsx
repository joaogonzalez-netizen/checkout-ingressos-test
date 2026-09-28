"use client";

import { useState } from "react";
import { CheckoutTemplate } from "@/components/checkout/CheckoutTemplate";
import type { TemplateData } from "@/components/checkout/types";
import type { StepState } from "../../../actions";
import { StepForm } from "../StepForm";
import { ImageUpload } from "../../../../components/ImageUpload";
import { VideoUpload } from "../../../../components/VideoUpload";

type Values = { vslHeadline: string; vslSubtitle: string; vslCtaLabel: string; description: string; accessRules: string };
type Media = {
  cover: string | null;
  coverMobile: string | null;
  ogImage: string | null;
  video: { url: string; posterUrl: string | null; width: number; height: number; duration: number } | null;
};
type ArtistImages = { name: string; cover: string | null; coverMobile: string | null; ogImage: string | null };

export function Step2Page({
  eventId,
  action,
  base,
  initial,
  media,
  artist,
  directVideoUpload,
}: {
  eventId: string;
  directVideoUpload: boolean;
  action: (prev: StepState, form: FormData) => Promise<StepState>;
  base: TemplateData;
  initial: Values;
  media: Media;
  artist: ArtistImages;
}) {
  const endpoint = `/api/admin/events/${eventId}/media`;
  // O par do header é herdado junto: só mostra o do artista se o evento não tiver nenhuma das duas.
  const ownCover = !!(media.cover || media.coverMobile);
  const inherit = (url: string | null) => (!ownCover && url ? { url, label: artist.name } : null);
  const [v, setV] = useState(initial);
  const set = (k: keyof Values) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setV((s) => ({ ...s, [k]: e.target.value }));

  return (
    <div className="bo-split">
      <StepForm action={action} eventId={eventId} step={2}>
        <div className="bo-card">
          <h2>Título, texto e botão</h2>
          <div className="bo-form">
            <label className="bo-field">
              <span>Título</span>
              <input name="vslHeadline" required value={v.vslHeadline} onChange={set("vslHeadline")} />
              <span className="bo-hint">Fica ao lado do vídeo (ou centralizado, sem vídeo). A cidade aparece na cor primária.</span>
            </label>
            <label className="bo-field">
              <span>Texto</span>
              <textarea name="vslSubtitle" rows={4} value={v.vslSubtitle} onChange={set("vslSubtitle")} />
              <span className="bo-hint">Aparece abaixo do título, antes do botão.</span>
            </label>
            <label className="bo-field">
              <span>Texto do botão (CTA)</span>
              <input name="vslCtaLabel" value={v.vslCtaLabel} onChange={set("vslCtaLabel")} />
            </label>
          </div>
        </div>
        <div className="bo-card">
          <h2>Sobre o evento</h2>
          <div className="bo-form">
            <label className="bo-field">
              <span>Descrição do evento</span>
              <textarea name="description" rows={6} value={v.description} onChange={set("description")} placeholder="Conte sobre o show: o que o público vai ver, duração, para quem é." />
              <span className="bo-hint">Aparece em &quot;Descrição do evento&quot;, abaixo do checkout. Também é lida pelo botão &quot;Ouvir descrição&quot;.</span>
            </label>
            <label className="bo-field">
              <span>Regras de acesso (informações gerais)</span>
              <textarea name="accessRules" rows={6} value={v.accessRules} onChange={set("accessRules")} />
              <span className="bo-hint">Um item por linha, começando com &quot;-&quot;. Já vem com o texto padrão.</span>
            </label>
          </div>
        </div>
        <div className="bo-card">
          <h2>Imagens e vídeo</h2>
          <p className="bo-hint" style={{ marginTop: -6, marginBottom: 12 }}>
            Sobem na hora, sem precisar clicar em Salvar. Sem imagem própria, o evento usa as do cadastro de {artist.name}.
          </p>
          <ImageUpload endpoint={endpoint} kind="cover" currentUrl={media.cover} inherited={inherit(artist.cover)} />
          <ImageUpload endpoint={endpoint} kind="cover_mobile" currentUrl={media.coverMobile} inherited={inherit(artist.coverMobile)} />
          <VideoUpload endpoint={endpoint} current={media.video} direct={directVideoUpload} />
          <ImageUpload
            endpoint={endpoint}
            kind="og_image"
            currentUrl={media.ogImage}
            inherited={artist.ogImage ? { url: artist.ogImage, label: artist.name } : null}
          />
        </div>
      </StepForm>
      <div className="bo-preview" aria-label="Pré-visualização">
        <CheckoutTemplate
          mode="preview"
          data={{
            ...base,
            vslHeadline: v.vslHeadline,
            vslSubtitle: v.vslSubtitle,
            vslCtaLabel: v.vslCtaLabel || base.vslCtaLabel,
            description: v.description,
            accessRules: v.accessRules,
          }}
        />
      </div>
    </div>
  );
}
