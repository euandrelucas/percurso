import { apiUser } from "@/lib/auth";
import { bad, json, readJson, str } from "@/lib/api";
import { getSession } from "@/lib/store";
import { endSession } from "@/lib/sessions";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await apiUser("patient");
  if (!user) return bad("Não autenticado", 401);
  const s = getSession(Number((await ctx.params).id));
  if (!s || s.user_id !== user.id) return bad("Sessão inválida", 404);
  const b = await readJson(req);
  const reason = ["agente", "paciente", "tempo", "falha_tecnica"].includes(str(b?.reason, 30)) ? str(b?.reason, 30) : "paciente";
  endSession(s.id, reason);
  return json({ ok: true });
}
