import { config } from "./config";

type D = Date | string | null | undefined;
const toDate = (d: Exclude<D, null | undefined>) => (d instanceof Date ? d : new Date(d));

export function dayKey(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: config.timezone }).format(d);
}

export function fmtDateTime(d: D): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("pt-BR", { timeZone: config.timezone, day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(toDate(d));
}

export function fmtDate(d: D): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("pt-BR", { timeZone: config.timezone, day: "2-digit", month: "long", year: "numeric" }).format(toDate(d));
}

export function fmtShort(d: D): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("pt-BR", { timeZone: config.timezone, day: "2-digit", month: "2-digit" }).format(toDate(d));
}

export function fmtDuration(sec: number | null | undefined): string {
  if (!sec) return "—";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m} min${s ? ` ${s}s` : ""}` : `${s}s`;
}
