// Formatos aceitos no upload (PRD Backoffice, "Pixel Meta, vídeo e imagens"). Usado na tela e no servidor.
// SVG não é aceito: servido pelo próprio domínio, um SVG pode executar script (XSS no backoffice).

// 2 min de vídeo 1080p gravado no celular passa fácil de 50 MB; 100 MB cobre o caso comum.
export const VIDEO_MAX_BYTES = 100 * 1024 * 1024;
export const VIDEO_MAX_SECONDS = 120;

/** 90 -> "1min30", 120 -> "2 min", 45 -> "45 s" */
export function formatDuration(seconds: number) {
  const s = Math.round(seconds);
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  const rest = s % 60;
  return rest ? `${m}min${String(rest).padStart(2, "0")}` : `${m} min`;
}
export const VIDEO_TYPES = ["video/mp4", "video/quicktime"];

export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

export type ImageKind = "logo" | "cover" | "cover_mobile" | "og_image";

export type ImageSpec = {
  title: string;
  /** Onde a imagem aparece. */
  where: string;
  formats: string;
  size: string;
  ratio: number | null;
  ratioLabel: string;
  maxBytes: number;
  tip?: string;
  /** Processamento no servidor. */
  output: { format: "webp" | "jpeg"; width?: number; height?: number; fit: "inside" | "cover" };
};

export const IMAGE_SPECS: Record<ImageKind, ImageSpec> = {
  logo: {
    title: "Logo",
    where: "Topo da página, no lugar do nome em texto (exibido com 30 px de altura)",
    formats: "PNG com fundo transparente (recomendado), WebP ou JPG",
    size: "Horizontal, 600 × 150 px (mínimo 120 px de altura)",
    ratio: null,
    ratioLabel: "horizontal",
    maxBytes: 1 * 1024 * 1024,
    tip: "Deixe pouca margem em volta do desenho: o sistema não corta o logo, só reduz.",
    output: { format: "webp", width: 600, height: 150, fit: "inside" },
  },
  cover: {
    title: "Header do site — desktop",
    where: "Faixa no topo da página, acima do nome do espetáculo",
    formats: "JPG, PNG ou WebP",
    size: "1920 × 1080 px (16:9)",
    ratio: 16 / 9,
    ratioLabel: "16:9",
    maxBytes: 5 * 1024 * 1024,
    tip: "Aparece inteira, sem corte: até 70% da largura no computador e a largura toda no celular. A altura se ajusta para data e local sempre caberem na primeira tela; a sobra mostra a própria arte desfocada.",
    output: { format: "webp", width: 1920, fit: "inside" },
  },
  cover_mobile: {
    title: "Header do site — celular (opcional)",
    where: "Mesma faixa, em telas de até 640 px. Sem ela, o celular usa a versão desktop.",
    formats: "JPG, PNG ou WebP",
    size: "1080 × 1350 px (4:5, vertical)",
    ratio: 4 / 5,
    ratioLabel: "4:5",
    maxBytes: 5 * 1024 * 1024,
    output: { format: "webp", width: 1080, fit: "inside" },
  },
  og_image: {
    title: "Imagem de compartilhamento (og:image)",
    where: "Prévia do link no WhatsApp, Instagram e Facebook",
    formats: "JPG ou PNG",
    size: "1200 × 630 px (1,91:1)",
    ratio: 1200 / 630,
    ratioLabel: "1,91:1",
    maxBytes: 5 * 1024 * 1024,
    tip: "É recortada automaticamente para 1200 × 630. Evite texto pequeno: a prévia aparece minúscula no WhatsApp.",
    // JPEG: o WhatsApp e o Facebook nem sempre mostram prévia em WebP.
    output: { format: "jpeg", width: 1200, height: 630, fit: "cover" },
  },
};

/** Diferença relativa entre a proporção enviada e a recomendada (0,1 = 10%). */
export function ratioDeviation(width: number, height: number, target: number) {
  return Math.abs(width / height - target) / target;
}

export function formatMB(bytes: number) {
  const mb = bytes / 1024 / 1024;
  return `${(mb >= 1 ? mb.toFixed(0) : mb.toFixed(1)).replace(".", ",")} MB`;
}

/** Formato Reels: em pé, 9:16. Tolerância de 10% para arquivos que saem com 1080 × 1918 e afins. */
export const VIDEO_RATIO = 9 / 16;

export function isReelsFormat(width: number, height: number) {
  return height > width && ratioDeviation(width, height, VIDEO_RATIO) <= 0.1;
}

export const VIDEO_SPEC = {
  title: "Vídeo da VSL (formato Reels)",
  formats: "MP4 (H.264) ou MOV",
  size: "Em pé, 9:16 — 1080 × 1920 px (igual Reels/Stories do Instagram)",
  limits: `Até ${formatDuration(VIDEO_MAX_SECONDS)} e ${VIDEO_MAX_BYTES / 1024 / 1024} MB`,
  tip: "Gravado no iPhone? Use Ajustes › Câmera › Formatos › Mais Compatível, senão o vídeo sai em HEVC e não toca no Chrome. Passou de 100 MB? Exporte em 1080p (não 4K).",
};
