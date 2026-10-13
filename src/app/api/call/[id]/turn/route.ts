import { apiUser } from "@/lib/auth";
import { bad, json, parseBody, rateLimit } from "@/lib/api";
import { classifyRisk } from "@/lib/risk";
import { turnSchema } from "@/lib/schemas";
import { addMessage, getSession, raiseAlert, sessionMessages } from "@/lib/store";
import { secondsLeft } from "@/lib/sessions";
import { injectionText, selectModules } from "@/lib/knowledge";
import { voiceRiskCue } from "@/lib/prompts";
import { LONG_STORY_CUE } from "@/lib/prompts/phases";

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

  // Conhecimento "na hora certa": se a fala do paciente toca em um tema com módulo clínico ainda não enviado nesta sessão,
  // devolve o texto para o cliente injetar na conversa de voz (a IA só o usa se fizer sentido).
  let knowledge: { ids: string[]; text: string } | null = null;
  if (b.role === "user") {
    const mods = selectModules(b.text, { exclude: b.injected ?? [], max: 2 });
    if (mods.length) knowledge = { ids: mods.map((m) => m.id), text: injectionText(mods) };
  }
  // Fala longa do paciente (história, desabafo): lembra a IA de refletir o conteúdo antes de perguntar.
  const longCue = b.role === "user" && b.text.length > 350 ? LONG_STORY_CUE : null;
  return json({ ok: true, risk, knowledge, riskCue: risk >= 2 ? voiceRiskCue(risk) : null, longCue });
}
