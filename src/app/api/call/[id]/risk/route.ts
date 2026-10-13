import { apiUser } from "@/lib/auth";
import { bad, json, readJson, str } from "@/lib/api";
import { getSession, raiseAlert } from "@/lib/store";

/** Sinalização feita pelo próprio agente (ferramenta sinalizar_risco). */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await apiUser("patient");
  if (!user) return bad("Não autenticado", 401);
  const s = getSession(Number((await ctx.params).id));
  if (!s || s.user_id !== user.id) return bad("Sessão inválida", 404);
  const b = await readJson(req);
  const nivel = Math.min(3, Math.max(1, Number(b?.nivel) || 1));
  raiseAlert(user.id, nivel, `voz:${s.id}`, `[sinalizado pela IA] ${str(b?.motivo, 400)}`);
  return json({ ok: true });
}
