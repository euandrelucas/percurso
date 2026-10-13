import { apiUser } from "@/lib/auth";
import { bad, json, parseBody } from "@/lib/api";
import { endSchema } from "@/lib/schemas";
import { getSession } from "@/lib/store";
import { endSession } from "@/lib/sessions";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await apiUser("patient");
  if (!user) return bad("Não autenticado", 401);
  const id = Number((await ctx.params).id);
  const s = Number.isInteger(id) ? await getSession(id) : null;
  if (!s || s.user_id !== user.id) return bad("Sessão inválida", 404);
  const [b, err] = await parseBody(req, endSchema);
  if (err) return err;
  await endSession(s.id, b.reason);
  return json({ ok: true });
}
