"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { IMAGE_SPECS, IMAGE_TYPES, formatMB, type ImageKind } from "@/lib/media-rules";
import { MediaSpec } from "./MediaSpec";
import { uploadWithProgress } from "./upload";

/** A Vercel aceita até 4,5 MB por requisição: fotos maiores são reduzidas no navegador antes do envio. */
const DIRECT_LIMIT = 4 * 1024 * 1024;

async function shrinkIfNeeded(file: File, maxWidth: number): Promise<File> {
  if (file.size <= DIRECT_LIMIT) return file;
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, (maxWidth * 1.25) / bitmap.width);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const keepAlpha = file.type === "image/png";
  for (const quality of [0.9, 0.8, 0.7]) {
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, keepAlpha ? "image/webp" : "image/jpeg", quality));
    if (blob && blob.size <= DIRECT_LIMIT) return new File([blob], file.name.replace(/\.\w+$/, keepAlpha ? ".webp" : ".jpg"), { type: blob.type });
  }
  return file;
}

type Props = {
  /** Rota de upload (POST multipart, DELETE ?kind=). */
  endpoint: string;
  kind: ImageKind;
  currentUrl: string | null;
  disabledReason?: string;
};

export function ImageUpload({ endpoint, kind, currentUrl, disabledReason }: Props) {
  const spec = IMAGE_SPECS[kind];
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState(currentUrl);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const shown = url;

  async function onFile(file: File) {
    setError(null);
    setWarning(null);
    if (!IMAGE_TYPES.includes(file.type)) return setError(`Formato não aceito. Use ${spec.formats}.`);
    if (file.size > spec.maxBytes) return setError(`A imagem tem ${formatMB(file.size)}; o limite é ${formatMB(spec.maxBytes)}.`);
    const form = new FormData();
    form.set("kind", kind);
    form.set("file", await shrinkIfNeeded(file, spec.output.width ?? 1920));
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
