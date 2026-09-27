"use client";

import { useRef, useState } from "react";
import type { TemplateVideo } from "./types";

/** Vídeo no formato Reels (9:16). Autoplay sem som, em loop, com botão de som. */
export function VslVideo({ video }: { video: TemplateVideo }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);

  function toggleSound() {
    const el = ref.current;
    if (!el) return;
    el.muted = !el.muted;
    if (!el.muted) void el.play();
    setMuted(el.muted);
  }

  return (
    <div className="vsl-video">
      <video
        ref={ref}
        src={video.url}
        poster={video.poster ?? undefined}
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
      />
      <button type="button" className="vsl-sound" onClick={toggleSound} aria-pressed={!muted}>
        {muted ? "🔇 Ativar som" : "🔊 Som ligado"}
      </button>
    </div>
  );
}
