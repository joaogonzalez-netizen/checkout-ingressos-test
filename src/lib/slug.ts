export function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Padrão {artista}-{cidade}-{data}, ex.: ivangelica-belo-horizonte-2026-07-17. */
export function suggestEventSlug(artistSlug: string, city: string, isoDate: string): string {
  return [artistSlug, slugify(city), isoDate.slice(0, 10)].filter(Boolean).join("-");
}

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
