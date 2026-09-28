"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { VIDEO_MAX_BYTES, VIDEO_MAX_SECONDS, VIDEO_SPEC, VIDEO_TYPES, formatDuration, formatMB, isReelsFormat } from "@/lib/media-rules";
import { MediaSpec } from "./MediaSpec";
import { uploadWithProgress } from "./upload";
import { upload as blobUpload } from "@vercel/blob/client";

type Current = { url: string; posterUrl: string | null; width: number; height: number; duration: number } | null;
type Meta = { width: number; height: number; duration: number; poster: Blob | null };

/** Lê duração e dimensões no navegador e captura um frame como poster. Falha se o navegador não decodifica (ex.: HEVC). */
function readVideo(file: File): Promise<Meta> {
  return new Promise((resolve, reject) => {
    const src = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    const done = (fn: () => void) => {
      fn();
      URL.revokeObjectURL(src);
    };
    let duration = 0;
    video.onerror = () => done(() => reject(new Error("unreadable")));
    video.onloadedmetadata = () => {
      if (!video.videoWidth || !video.videoHeight) return done(() => reject(new Error("unreadable")));
      if (Number.isFinite(video.duration)) {
        duration = video.duration;
        video.currentTime = Math.min(1, duration / 2);
      } else {
        // Arquivo sem duração no cabeçalho (o Chrome informa Infinity): buscar o fim força o cálculo.
        video.ondurationchange = () => {
          if (!Number.isFinite(video.duration)) return;
          video.ondurationchange = null;
          duration = video.duration;
          video.currentTime = Math.min(1, duration / 2);
        };
        video.currentTime = Number.MAX_SAFE_INTEGER;
      }
    };
    video.onseeked = () => {
      if (!duration) return; // seek do contorno acima; o frame do poster vem no próximo
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext("2d")?.drawImage(video, 0, 0);
      canvas.toBlob(
        (poster) => done(() => resolve({ width: video.videoWidth, height: video.videoHeight, duration, poster })),
        "image/jpeg",
        0.85,
      );
    };
    video.src = src;
  });
}


/**
 * direct = true na Vercel: o vídeo sobe do navegador direto para o Vercel Blob (as funções aceitam
 * só 4,5 MB por requisição) e depois é registrado na rota de mídia.
 */
export function VideoUpload({ endpoint, current, direct = false }: { endpoint: string; current: Current; direct?: boolean }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [video, setVideo] = useState(current);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onFile(file: File) {
    setError(null);
    if (!VIDEO_TYPES.includes(file.type)) return setError(`Formato não aceito. Use ${VIDEO_SPEC.formats}.`);
    if (file.size > VIDEO_MAX_BYTES) return setError(`O vídeo tem ${formatMB(file.size)}; o limite é ${formatMB(VIDEO_MAX_BYTES)}.`);
    setStatus("Lendo o vídeo…");
    let meta: Meta;
    try {
      meta = await readVideo(file);
    } catch {
      setStatus(null);
      return setError(
        "O navegador não conseguiu ler este vídeo. Provavelmente está em HEVC (padrão do iPhone). Exporte em MP4 H.264 ou grave no modo “Mais Compatível”.",
      );
    }
    if (!isReelsFormat(meta.width, meta.height)) {
      setStatus(null);
      return setError(
        `O vídeo tem ${meta.width} × ${meta.height}${meta.width >= meta.height ? " (deitado)" : ""}. Use o formato Reels: em pé, 9:16 (1080 × 1920). No celular, grave na vertical.`,
      );
    }
    if (meta.duration > VIDEO_MAX_SECONDS + 0.5) {
      setStatus(null);
      return setError(`O vídeo tem ${formatDuration(meta.duration)}; o limite é ${formatDuration(VIDEO_MAX_SECONDS)}. Corte antes de enviar.`);
    }
    const form = new FormData();
    form.set("kind", "video");
    if (direct) {
      const eventId = endpoint.match(/events\/([^/]+)\/media/)?.[1];
      const ext = file.type === "video/quicktime" ? "mov" : "mp4";
      try {
        const blob = await blobUpload(`events/${eventId}/video-${Date.now()}.${ext}`, file, {
          access: "public",
          contentType: file.type,
          handleUploadUrl: `${endpoint}/upload-token`,
          multipart: file.size > 20 * 1024 * 1024,
          onUploadProgress: ({ percentage }) => setStatus(`Enviando… ${Math.round(percentage)}%`),
        });
        form.set("blobUrl", blob.url);
      } catch (err) {
        setStatus(null);
        return setError(err instanceof Error ? err.message : "Falha ao enviar o vídeo.");
      }
      setStatus("Finalizando…");
    } else {
      form.set("file", file);
    }
    form.set("width", String(meta.width));
    form.set("height", String(meta.height));
    form.set("duration", String(meta.duration));
    if (meta.poster) form.set("poster", meta.poster, "poster.jpg");
    const res = await uploadWithProgress(endpoint, form, (p) => setStatus(`Enviando… ${p}%`));
    setStatus(null);
    if (!res.ok || !res.body.url) return setError(res.body.error ?? "Não foi possível enviar o vídeo.");
    setVideo({ url: res.body.url, posterUrl: null, width: meta.width, height: meta.height, duration: meta.duration });
    router.refresh();
  }

  async function remove() {
    const res = await fetch(`${endpoint}?kind=video`, { method: "DELETE" });
    if (!res.ok) return setError("Não foi possível remover.");
    setVideo(null);
    router.refresh();
  }

  return (
    <div className="bo-upload">
      <div className="bo-upload-head">
        <h3>{VIDEO_SPEC.title}</h3>
        <span className="bo-hint">
          Fica à direita, com o título, o texto e o botão à esquerda (no celular, o texto vem antes). Toca sozinho, sem som e em loop, com botão para ligar o som.
        </span>
      </div>
      <div className="bo-upload-body">
        <div className="bo-upload-preview" style={{ aspectRatio: "9 / 16", maxWidth: 200 }}>
          {video ? (
            <video src={video.url} poster={video.posterUrl ?? undefined} controls muted playsInline />
          ) : (
            <span className="bo-hint">Nenhum vídeo</span>
          )}
        </div>
        <MediaSpec
          rows={[
            ["Formato", VIDEO_SPEC.formats],
            ["Formato da tela", VIDEO_SPEC.size],
            ["Limite", VIDEO_SPEC.limits],
            ...(video ? ([["Enviado", `${video.width} × ${video.height} · ${formatDuration(video.duration)}`]] as [string, string][]) : []),
          ]}
          tip={VIDEO_SPEC.tip}
        />
      </div>
      <input
        ref={input}
        type="file"
        accept="video/mp4,video/quicktime"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) void onFile(f);
        }}
      />
      <div className="bo-actions">
        <button type="button" className="bo-btn" disabled={status !== null} onClick={() => input.current?.click()}>
          {status ?? (video ? "Trocar vídeo" : "Enviar vídeo")}
        </button>
        {video && (
          <button type="button" className="bo-btn bo-btn-danger" onClick={remove} disabled={status !== null}>
            Remover
          </button>
        )}
      </div>
      {error && <p className="bo-error">{error}</p>}
    </div>
  );
}
