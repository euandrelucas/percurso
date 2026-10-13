import { apiUser } from "@/lib/auth";
import { bad, json, readJson, str } from "@/lib/api";
import { classifyRisk } from "@/lib/risk";
import { addMessage, getSession, raiseAlert, sessionMessages } from "@/lib/store";
import { secondsLeft } from "@/lib/sessions";

/** Grava cada fala (transcrição) e roda a classificação de risco nas falas do paciente. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await apiUser("patient");
  if (!user) return bad("Não autenticado", 401);
  const s = getSession(Number((await ctx.params).id));
  if (!s || s.user_id !== user.id) return bad("Sessão inválida", 404);
  if (s.status !== "active" || secondsLeft(s) < -180) return bad("Sessão encerrada", 409);
  const b = await readJson(req);
  const role = b?.role === "assistant" ? "assistant" : "user";
  const text = str(b?.text, 4000);
  if (!text) return json({ ok: true });
  addMessage(user.id, s.id, "voice", role, text);

  let risk = 0;
  if (role === "user") {
    const ctxLines = sessionMessages(s.id).slice(-6, -1).map((m) => `${m.role === "assistant" ? "IA" : "PACIENTE"}: ${m.content}`);
    const r = await classifyRisk(text, ctxLines);
    risk = r.level;
    if (r.level >= 2) raiseAlert(user.id, r.level, `voz:${s.id}`, `${text.slice(0, 300)} [${r.source}: ${r.reason}]`);
  }
  return json({ ok: true, risk });
}
