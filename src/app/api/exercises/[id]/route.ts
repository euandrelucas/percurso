import { apiUser } from "@/lib/auth";
import { bad, json, readJson, str } from "@/lib/api";
import { run } from "@/lib/db";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await apiUser("patient");
  if (!user) return bad("Não autenticado", 401);
  const { id } = await ctx.params;
  const b = await readJson(req);
  const status = b?.status === "feito" ? "feito" : b?.status === "pendente" ? "pendente" : null;
  if (!status) return bad("Status inválido");
  const r = run("UPDATE exercises SET status = ?, feedback = ?, completed_at = CASE WHEN ? = 'feito' THEN datetime('now') ELSE NULL END WHERE id = ? AND user_id = ?", status, str(b?.feedback, 400) || null, status, Number(id), user.id);
  return r.changes ? json({ ok: true }) : bad("Exercício não encontrado", 404);
}
