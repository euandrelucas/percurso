import { NextResponse } from "next/server";
import type { ZodType } from "zod";

export const json = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
export const bad = (message: string, status = 400) => json({ error: message }, status);

const MAX_BODY = 64 * 1024;

/** Lê JSON com teto de tamanho (evita payloads gigantes). */
export async function readJson(req: Request): Promise<unknown | null> {
  try {
    const len = Number(req.headers.get("content-length") ?? 0);
    if (len > MAX_BODY) return null;
    const text = await req.text();
    if (text.length > MAX_BODY) return null;
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/** Lê e valida o corpo com zod. Retorna [dados, null] ou [null, resposta de erro 400]. */
export async function parseBody<T>(req: Request, schema: ZodType<T>, message = "Requisição inválida"): Promise<[T, null] | [null, NextResponse]> {
  const raw = await readJson(req);
  const r = schema.safeParse(raw);
  return r.success ? [r.data, null] : [null, bad(message)];
}

export const str = (v: unknown, max = 500) => (typeof v === "string" ? v.trim().slice(0, max) : "");
export { rateLimit, clientIp } from "./ratelimit";
