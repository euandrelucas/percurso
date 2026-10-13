import { apiUser } from "@/lib/auth";
import { bad, json, parseBody, rateLimit } from "@/lib/api";
import { classifyRisk } from "@/lib/risk";
import { turnSchema } from "@/lib/schemas";
import { addMessage, getSession, raiseAlert, sessionMessages } from "@/lib/store";
import { secondsLeft } from "@/lib/sessions";

/** Grava cada fala (transcrição) e roda a classificação de risco nas falas do paciente. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await apiUser("patient");
  if (!user) return bad("Não autenticado", 401);
  if (!rateLimit(`turn:${user.id}`, 120, 60_000)) return bad("Muitas requisições.", 429);
  const id = Number((await ctx.params).id);
  const s = Number.isInteger(id) ? await getSession(id) : null;
  if (!s || s.user_id !== user.id) return bad("Sessão inválida", 404);
  if (s.status !== "active" || secondsLeft(s) < -180) return bad("Sessão encerrada", 409);
  const [b, err] = await parseBody(req, turnSchema);
  if (err) return err;
  await addMessage(user.id, s.id, "voice", b.role, b.text);

  let risk = 0;
  if (b.role === "user") {
    const ctxLines = (await sessionMessages(s.id)).slice(-6, -1).map((m) => `${m.role === "assistant" ? "IA" : "PACIENTE"}: ${m.content}`);
    const r = await classifyRisk(b.text, ctxLines);
    risk = r.level;
    if (r.level >= 2) await raiseAlert(user.id, r.level, `voz:${s.id}`, `${b.text.slice(0, 300)} [${r.source}: ${r.reason}]`);
  }
  return json({ ok: true, risk });
}
