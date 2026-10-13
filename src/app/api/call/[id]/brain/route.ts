import { apiUser } from "@/lib/auth";
import { bad, json, parseBody, rateLimit } from "@/lib/api";
import { brainTurn } from "@/lib/brain";
import { config } from "@/lib/config";
import { brainSchema } from "@/lib/schemas";
import { getSession } from "@/lib/store";
import { secondsLeft } from "@/lib/sessions";

/** Próxima fala do acompanhante na chamada ("dois cérebros"): o cliente manda o que a pessoa disse e a voz lê a resposta. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await apiUser("patient");
  if (!user) return bad("Não autenticado", 401);
  if (!rateLimit(`brain:${user.id}`, 90, 60_000)) return bad("Muitas requisições.", 429);
  if (config.mock() || !config.voiceBrain()) return bad("Indisponível", 404);
  const id = Number((await ctx.params).id);
  const s = Number.isInteger(id) ? await getSession(id) : null;
  if (!s || s.user_id !== user.id) return bad("Sessão inválida", 404);
  if (s.status !== "active" || secondsLeft(s) < -180) return bad("Sessão encerrada", 409);
  const [b, err] = await parseBody(req, brainSchema);
  if (err) return err;
  if (b.kind === "turn" && !b.text) return bad("Fala vazia");
  try {
    return json(await brainTurn(s, b));
  } catch (e) {
    console.error("[brain]", e);
    return bad("Não consegui pensar agora.", 502);
  }
}
