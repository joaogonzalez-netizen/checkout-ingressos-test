import type { Palette } from "./palette";
import { contrastRatio, mixHex } from "./contrast";

// Gera secundária, destaque e fundo a partir da cor primária (HSL), respeitando o contraste
// que o template exige. É só sugestão: o usuário pode editar qualquer uma depois.

type Hsl = { h: number; s: number; l: number };

function hexToHsl(hex: string): Hsl {
  const n = parseInt(hex.slice(1), 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l: l * 100 };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: h * 60, s: s * 100, l: l * 100 };
}

function hslToHex({ h, s, l }: Hsl): string {
  const hh = ((h % 360) + 360) % 360;
  const ss = Math.max(0, Math.min(100, s)) / 100;
  const ll = Math.max(0, Math.min(100, l)) / 100;
  const k = (n: number) => (n + hh / 30) % 12;
  const a = ss * Math.min(ll, 1 - ll);
  const f = (n: number) => ll - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return `#${[f(0), f(8), f(4)].map((x) => Math.round(x * 255).toString(16).padStart(2, "0")).join("")}`;
}

/** Ajusta a luminosidade até o contraste mínimo com a cor de referência (ou esgotar o intervalo). */
function ensureContrast(color: Hsl, against: string, min: number, direction: 1 | -1): string {
  const c = { ...color };
  for (let i = 0; i < 40; i++) {
    const hex = hslToHex(c);
    if (contrastRatio(hex, against) >= min) return hex;
    c.l = Math.max(2, Math.min(98, c.l + direction * 2));
  }
  return hslToHex(c);
}

export function suggestPalette(primary: string): Palette {
  const p = hexToHsl(primary);
  const neutral = p.s < 12; // cinza/preto/branco: sugestões sem matiz forte

  // Secundária: a mesma família, bem escura (faixa do evento e modo escuro). Ex.: #a72c8f -> ameixa.
  const secondary = hslToHex({ h: p.h - 25, s: neutral ? 10 : Math.min(70, p.s * 0.75), l: 13 });

  // Destaque: dourado, que contrasta com quase tudo; se a primária já for amarela/laranja, usa a complementar.
  const warm = !neutral && p.h >= 20 && p.h <= 75;
  const accentBase: Hsl = warm ? { h: p.h + 180, s: 70, l: 62 } : { h: 45, s: 88, l: 61 };
  const dark = mixHex(secondary, "#000000", 0.65); // mesmo "texto escuro" que o template deriva
  const accent = ensureContrast(accentBase, dark, 4.5, 1);

  // Fundo: tom bem claro da primária, com o texto escuro legível.
  const background = ensureContrast({ h: p.h, s: neutral ? 0 : Math.min(90, p.s), l: 97 }, dark, 7, 1);

  return { primary, secondary, accent, background };
}

/** Versão mais escura da primária com texto branco legível (4,5:1), ou null se ela já passa. */
export function accessiblePrimary(primary: string): string | null {
  if (contrastRatio("#ffffff", primary) >= 4.5) return null;
  return ensureContrast(hexToHsl(primary), "#ffffff", 4.5, -1);
}

/** true quando a cor salva é igual à que seria sugerida (ou seja, o usuário não editou). */
export function isSuggested(palette: Palette, key: Exclude<keyof Palette, "primary">) {
  return suggestPalette(palette.primary)[key].toLowerCase() === palette[key].toLowerCase();
}
