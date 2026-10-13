import { z } from "zod";
import { apiUser } from "@/lib/auth";
import { bad, json, parseBody, rateLimit } from "@/lib/api";
import { addHelpSignal, getSession } from "@/lib/store";
import { audit } from "@/lib/prisma";

const schema = z.object({ kind: z.enum(["nao_ajudando", "transcricao_errada", "reconexao"]) });

/** Sinais do paciente durante a chamada (para o estudo): "não está ajudando", "a legenda errou", reconexões. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await apiUser("patient");
  if (!user) return bad("Não autenticado", 401);
  if (!rateLimit(`signal:${user.id}`, 60, 10 * 60_000)) return bad("Muitas requisições.", 429);
  const id = Number((await ctx.params).id);
  const s = Number.isInteger(id) ? await getSession(id) : null;
  if (!s || s.user_id !== user.id) return bad("Sessão inválida", 404);
  const [b, err] = await parseBody(req, schema);
  if (err) return err;
  if (b.kind === "nao_ajudando") await addHelpSignal(s.id);
  await audit("patient", `call.${b.kind}`, user.id, { sessionId: s.id });
  return json({ ok: true });
}
