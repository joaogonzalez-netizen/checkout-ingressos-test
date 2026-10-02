"use client";

import { useEffect, useRef, useState } from "react";
import jsQR from "jsqr";

/** Lê QR Code pela câmera do celular (funciona em iPhone e Android, sem instalar nada). Fecha sozinho ao ler. */
export function Scanner({ onResult, onClose, onError }: { onResult: (value: string) => void; onClose: () => void; onError?: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const handlers = useRef({ onResult, onClose, onError });
  useEffect(() => {
    handlers.current = { onResult, onClose, onError };
  });

  useEffect(() => {
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });

    function tick() {
      const v = video.current;
      if (stopped || !v || !ctx) return;
      if (v.readyState === v.HAVE_ENOUGH_DATA && v.videoWidth > 0) {
        const scale = Math.min(1, 720 / v.videoWidth);
        canvas.width = Math.round(v.videoWidth * scale);
        canvas.height = Math.round(v.videoHeight * scale);
        ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
        const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(img.data, img.width, img.height, { inversionAttempts: "dontInvert" });
        if (code?.data) {
          stopped = true;
          navigator.vibrate?.(60);
          handlers.current.onResult(code.data);
          return;
        }
      }
      timer = setTimeout(tick, 90);
    }

    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
        if (stopped) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        const v = video.current;
        if (!v) return;
        v.srcObject = stream;
        await v.play();
        tick();
      } catch (e) {
        const name = (e as { name?: string }).name;
        handlers.current.onError?.();
        setError(
          name === "NotAllowedError"
            ? "A câmera está bloqueada. Permita o uso da câmera nas configurações do navegador e tente de novo."
            : "Não consegui abrir a câmera deste aparelho. Use o código de 4 caracteres ou a busca por nome.",
        );
      }
    })();

    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return (
    <div className="dr-scan">
      {error ? (
        <p className="dr-error" role="alert">
          {error}
        </p>
      ) : (
        <div className="dr-scan-frame">
          <video ref={video} playsInline muted aria-label="Câmera para ler o QR Code do ingresso" />
          <i aria-hidden />
        </div>
      )}
      <button type="button" className="dr-btn" onClick={() => handlers.current.onClose()}>
        Fechar câmera
      </button>
    </div>
  );
}
