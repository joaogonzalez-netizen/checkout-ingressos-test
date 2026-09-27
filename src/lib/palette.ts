import type { CSSProperties } from "react";

export type Palette = {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
};

/** Paleta do template original (ivangelica-checkout.html). */
export const DEFAULT_PALETTE: Palette = {
  primary: "#a72c8f",
  secondary: "#2b0f34",
  accent: "#f4c542",
  background: "#fff3f8",
};

const HEX = /^#[0-9a-f]{6}$/i;

export function parsePalette(value: unknown): Palette {
  const v = (value ?? {}) as Partial<Palette>;
  const pick = (k: keyof Palette) => (typeof v[k] === "string" && HEX.test(v[k]!) ? v[k]! : DEFAULT_PALETTE[k]);
  return { primary: pick("primary"), secondary: pick("secondary"), accent: pick("accent"), background: pick("background") };
}

export function isHexColor(value: string): boolean {
  return HEX.test(value);
}

/**
 * Mapeia as 4 cores do artista para as variáveis CSS do template.
 * Os tons intermediários são derivados com color-mix, como no HTML original.
 */
export function paletteStyle(p: Palette): CSSProperties {
  return {
    "--magenta": p.primary,
    "--plum-deep": p.secondary,
    "--gold": p.accent,
    "--cream": p.background,
    "--plum-mid": `color-mix(in srgb, ${p.secondary} 55%, ${p.primary})`,
    "--fuchsia": `color-mix(in srgb, ${p.primary} 65%, white)`,
    "--dark": `color-mix(in srgb, ${p.secondary} 65%, black)`,
  } as CSSProperties;
}
