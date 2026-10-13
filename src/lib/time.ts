import { config } from "./config";

/** SQLite grava UTC como "YYYY-MM-DD HH:MM:SS". */
export function parseDbDate(s: string): Date {
  return new Date(s.replace(" ", "T") + "Z");
}

export function dayKey(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: config.timezone }).format(d);
}

export function fmtDateTime(s: string | null | undefined): string {
  if (!s) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: config.timezone,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(parseDbDate(s));
}

export function fmtDate(s: string | null | undefined): string {
  if (!s) return "—";
  return new Intl.DateTimeFormat("pt-BR", { timeZone: config.timezone, day: "2-digit", month: "long", year: "numeric" }).format(
    parseDbDate(s),
  );
}

export function fmtDuration(sec: number | null | undefined): string {
  if (!sec) return "—";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m} min${s ? ` ${s}s` : ""}` : `${s}s`;
}
