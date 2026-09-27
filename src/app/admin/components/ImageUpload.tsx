"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { IMAGE_SPECS, IMAGE_TYPES, formatMB, type ImageKind } from "@/lib/media-rules";
import { MediaSpec } from "./MediaSpec";
import { uploadWithProgress } from "./upload";

type Props = {
  /** Rota de upload (POST multipart, DELETE ?kind=). */
  endpoint: string;
  kind: ImageKind;
  currentUrl: string | null;
  /** Imagem herdada (ex.: header padrão do artista), mostrada quando não há uma própria. */
  inherited?: { url: string; label: string } | null;
  disabledReason?: string;
};

export function ImageUpload({ endpoint, kind, currentUrl, inherited, disabledReason }: Props) {
  const spec = IMAGE_SPECS[kind];
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState(currentUrl);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const shown = url ?? inherited?.url ?? null;

  async function onFile(file: File) {
    setError(null);
    setWarning(null);
    if (!IMAGE_TYPES.includes(file.type)) return setError(`Formato não aceito. Use ${spec.formats}.`);
    if (file.size > spec.maxBytes) return setError(`A imagem tem ${formatMB(file.size)}; o limite é ${formatMB(spec.maxBytes)}.`);
    const form = new FormData();
    form.set("kind", kind);
    form.set("file", file);
    setProgress(0);
    const res = await uploadWithProgress(endpoint, form, setProgress);
    setProgress(null);
    if (!res.ok || !res.body.url) return setError(res.body.error ?? "Não foi possível enviar a imagem.");
    setUrl(res.body.url);
    if (res.body.warning) setWarning(res.body.warning);
    router.refresh();
  }

  async function remove() {
    setError(null);
    setWarning(null);
    const res = await fetch(`${endpoint}?kind=${kind}`, { method: "DELETE" });
    if (!res.ok) return setError("Não foi possível remover.");
    setUrl(null);
    router.refresh();
  }

  return (
    <div className="bo-upload">
      <div className="bo-upload-head">
        <h3>{spec.title}</h3>
        <span className="bo-hint">{spec.where}</span>
      </div>
      <div className="bo-upload-body">
        <div
          className={`bo-upload-preview${kind === "logo" ? " checker" : ""}`}
          style={{ aspectRatio: spec.ratio ? String(spec.ratio) : "4 / 1" }}
        >
          {shown ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={shown} alt={spec.title} style={{ objectFit: kind === "logo" ? "contain" : "cover" }} />
          ) : (
            <span className="bo-hint">Nenhuma imagem</span>
          )}
          {!url && inherited && <span className="bo-upload-tag">Herdado: {inherited.label}</span>}
        </div>
        <MediaSpec
          rows={[
            ["Formato", spec.formats],
            ["Tamanho", spec.size],
            ["Peso máximo", formatMB(spec.maxBytes)],
          ]}
          tip={spec.tip}
        />
      </div>
      <input
        ref={input}
        type="file"
        accept={IMAGE_TYPES.join(",")}
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) void onFile(f);
        }}
      />
      {disabledReason ? (
        <p className="bo-hint">{disabledReason}</p>
      ) : (
        <div className="bo-actions">
          <button type="button" className="bo-btn" disabled={progress !== null} onClick={() => input.current?.click()}>
            {progress !== null ? `Enviando… ${progress}%` : url ? "Trocar imagem" : "Enviar imagem"}
          </button>
          {url && (
            <button type="button" className="bo-btn bo-btn-danger" onClick={remove} disabled={progress !== null}>
              Remover
            </button>
          )}
        </div>
      )}
      {error && <p className="bo-error">{error}</p>}
      {warning && <p className="bo-warn">{warning}</p>}
    </div>
  );
}
