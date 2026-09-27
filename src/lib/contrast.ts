// Contraste WCAG 2.1 (https://www.w3.org/TR/WCAG21/#dfn-contrast-ratio).

function channel(c: number) {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

function luminance(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
}

export function contrastRatio(a: string, b: string): number {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

/** AA: 4,5 para texto normal, 3 para texto grande/negrito (botões). */
export function meetsAA(a: string, b: string, large = false): boolean {
  return contrastRatio(a, b) >= (large ? 3 : 4.5);
}

/** Mistura duas cores hex como o color-mix(in srgb, a p%, b) do CSS. */
export function mixHex(a: string, b: string, weightA: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (shift: number) =>
    Math.round(((pa >> shift) & 255) * weightA + ((pb >> shift) & 255) * (1 - weightA))
      .toString(16)
      .padStart(2, "0");
  return `#${ch(16)}${ch(8)}${ch(0)}`;
}

export type ContrastCheck = { label: string; fg: string; bg: string; ratio: number; ok: boolean };

/** Pares de cor que o template usa de fato, com os mesmos derivados de paletteStyle(). */
export function paletteContrastChecks(p: { primary: string; secondary: string; accent: string; background: string }): ContrastCheck[] {
  const dark = mixHex(p.secondary, "#000000", 0.65);
  const pairs: [string, string, string][] = [
    ["Texto branco nos botões (primária)", "#ffffff", p.primary],
    ["Texto do botão principal sobre a cor de destaque", dark, p.accent],
    ["Preço e destaques (primária) sobre o fundo", p.primary, p.background],
    ["Texto claro na faixa do evento (secundária)", p.background, p.secondary],
    ["Texto do corpo sobre o fundo", dark, p.background],
  ];
  return pairs.map(([label, fg, bg]) => {
    const ratio = contrastRatio(fg, bg);
    return { label, fg, bg, ratio, ok: ratio >= 4.5 };
  });
}
