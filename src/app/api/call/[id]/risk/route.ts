import { apiUser } from "@/lib/auth";
import { bad, json, parseBody, rateLimit } from "@/lib/api";
import { riskSchema } from "@/lib/schemas";
import { getSession, raiseAlert } from "@/lib/store";

/** Sinalização feita pelo próprio agente (ferramenta sinalizar_risco). */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await apiUser("patient");
  if (!user) return bad("Não autenticado", 401);
  if (!rateLimit(`risk:${user.id}`, 30, 60_000)) return bad("Muitas requisições.", 429);
  const id = Number((await ctx.params).id);
  const s = Number.isInteger(id) ? await getSession(id) : null;
  if (!s || s.user_id !== user.id) return bad("Sessão inválida", 404);
  const [b, err] = await parseBody(req, riskSchema);
  if (err) return err;
  await raiseAlert(user.id, b.nivel, `voz:${s.id}`, `[sinalizado pela IA] ${b.motivo}`);
  return json({ ok: true });
}
