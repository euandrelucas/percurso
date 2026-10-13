import { apiUser } from "@/lib/auth";
import { bad, json, rateLimit } from "@/lib/api";
import { config, PROMPT_VERSION } from "@/lib/config";
import { audit, prisma } from "@/lib/prisma";
import { activeSession, callAvailability, getAgent, hasCompletedSession, nextSessionNumber } from "@/lib/store";
import { reapStale, secondsLeft } from "@/lib/sessions";

/** Cria (ou retoma) a sessão de voz do dia, aplicando a regra de 1 chamada por dia de até 60 minutos. */
export async function POST() {
  const user = await apiUser("patient");
  if (!user) return bad("Não autenticado", 401);
  if (!rateLimit(`callstart:${user.id}`, 10, 10 * 60_000)) return bad("Muitas tentativas. Aguarde um pouco.", 429);
  if (!(await getAgent(user.id))) return bad("Finalize seu cadastro primeiro.", 409);

  await reapStale(user.id);
  const active = await activeSession(user.id);
  if (active && secondsLeft(active) > 30) {
    return json({ sessionId: active.id, resumed: true, secondsLeft: secondsLeft(active), kind: active.kind, mock: config.mock(), brain: !config.mock() && config.voiceBrain() });
  }

  const { available, limit } = await callAvailability(user);
  if (!available) return bad(`Você já fez sua chamada de hoje (limite: ${limit} por dia). Amanhã ela estará liberada de novo — e, em caso de emergência, use as mensagens.`, 429);

  const kind = (await hasCompletedSession(user.id)) ? "acompanhamento" : "triagem";
  const max = config.sessionMaxMinutes();
  const s = await prisma.therapySession.create({ data: { user_id: user.id, number: await nextSessionNumber(user.id), kind, max_minutes: max, prompt_version: PROMPT_VERSION } });
  await audit("patient", "session.started", user.id, { id: s.id, kind });
  return json({ sessionId: s.id, resumed: false, secondsLeft: max * 60, kind, mock: config.mock(), brain: !config.mock() && config.voiceBrain() });
}
