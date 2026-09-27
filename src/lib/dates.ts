// Todo horário de evento é interpretado no fuso de Brasília (sem horário de verão desde 2019).
export const EVENT_TZ = "America/Sao_Paulo";
const OFFSET = "-03:00";

/** "2026-07-17" + "20:00" -> Date (UTC). */
export function fromLocalDateTime(date: string, time: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return null;
  const d = new Date(`${date}T${time}:00${OFFSET}`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function parts(d: Date) {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: EVENT_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const p = Object.fromEntries(fmt.formatToParts(d).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
}

export function toLocalDate(d: Date | null | undefined): string {
  return d ? parts(d).date : "";
}

export function toLocalTime(d: Date | null | undefined): string {
  return d ? parts(d).time : "";
}

/** 17/07/2026 */
export function formatDate(d: Date | null | undefined): string {
  if (!d) return "";
  return d.toLocaleDateString("pt-BR", { timeZone: EVENT_TZ });
}

/** 17/07/2026, 20h ou 20h30 */
export function formatDateTime(d: Date | null | undefined): string {
  if (!d) return "";
  const [h, m] = toLocalTime(d).split(":");
  return `${formatDate(d)}, ${Number(h)}h${m === "00" ? "" : m}`;
}

export function todayLocal(): string {
  return parts(new Date()).date;
}

/** sexta-feira, 20 de novembro de 2026 */
export function formatLongDate(d: Date | null | undefined): string {
  if (!d) return "";
  const text = d.toLocaleDateString("pt-BR", { timeZone: EVENT_TZ, weekday: "long", day: "numeric", month: "long", year: "numeric" });
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** 20h ou 20h30 */
export function formatHour(d: Date | null | undefined): string {
  if (!d) return "";
  const [h, m] = toLocalTime(d).split(":");
  return `${Number(h)}h${m === "00" ? "" : m}`;
}
