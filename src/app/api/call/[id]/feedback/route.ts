import { apiUser } from "@/lib/auth";
import { bad, json, parseBody, rateLimit } from "@/lib/api";
import { feedbackSchema } from "@/lib/schemas";
import { getSession, saveFeedback } from "@/lib/store";

/** Avaliação rápida ao fim da chamada: "isso te ajudou?" (1–3) + comentário opcional. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await apiUser("patient");
  if (!user) return bad("Não autenticado", 401);
  if (!rateLimit(`feedback:${user.id}`, 20, 60 * 60_000)) return bad("Muitas requisições.", 429);
  const id = Number((await ctx.params).id);
  const s = Number.isInteger(id) ? await getSession(id) : null;
  if (!s || s.user_id !== user.id) return bad("Sessão inválida", 404);
  if (s.status !== "ended") return bad("A sessão ainda não terminou", 409);
  const [b, err] = await parseBody(req, feedbackSchema);
  if (err) return err;
  await saveFeedback(s.id, b.rating, b.note);
  return json({ ok: true });
}
