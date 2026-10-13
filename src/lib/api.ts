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

/**
 * Progressive enhancement: se o JavaScript do navegador não carregou (proxy, CDN, extensão...), o formulário é enviado
 * como POST "de verdade" (application/x-www-form-urlencoded). Este wrapper converte o corpo para JSON, reaproveita o
 * handler normal e transforma a resposta em redirecionamento 303 (sucesso -> `next`; erro -> volta à página com ?erro=).
 * Com JavaScript funcionando nada muda: a requisição continua sendo JSON.
 */
export function formAware(errorPath: string, handler: (req: Request) => Promise<NextResponse>, keep: string[] = []) {
  return async (req: Request): Promise<NextResponse> => {
    const ct = req.headers.get("content-type") ?? "";
    if (!ct.includes("application/x-www-form-urlencoded")) return handler(req);
    let fields: Record<string, string> = {};
    try {
      const form = await req.formData();
      fields = Object.fromEntries([...form].map(([k, v]) => [k, typeof v === "string" ? v.slice(0, 500) : ""]));
    } catch {
      /* corpo inválido: segue vazio e o handler responde 400 */
    }
    const headers = new Headers(req.headers);
    headers.set("content-type", "application/json");
    headers.delete("content-length");
    const res = await handler(new Request(req.url, { method: "POST", headers, body: JSON.stringify(fields) }));
    const data = (await res.clone().json().catch(() => ({}))) as { next?: string; error?: string };
    const go = (loc: string) => {
      const r = new NextResponse(null, { status: 303, headers: { Location: loc, "Cache-Control": "no-store" } });
      // preserva cookies definidos pelo handler (sessão)
      for (const c of res.headers.getSetCookie?.() ?? []) r.headers.append("Set-Cookie", c);
      return r;
    };
    if (res.ok && typeof data.next === "string" && data.next.startsWith("/") && !data.next.startsWith("//")) return go(data.next);
    const q = new URLSearchParams({ erro: String(data.error ?? "Algo deu errado.").slice(0, 200) });
    for (const k of keep) if (fields[k]) q.set(k, fields[k]);
    return go(`${errorPath}?${q.toString()}`);
  };
}
