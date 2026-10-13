import { apiUser } from "@/lib/auth";
import { bad, json } from "@/lib/api";
import { config, PROMPT_VERSION } from "@/lib/config";
import { run, audit } from "@/lib/db";
import { activeSession, callLimitFor, callsToday, getAgent, hasCompletedSession, nextSessionNumber } from "@/lib/store";
import { reapStale, secondsLeft } from "@/lib/sessions";

/** Cria (ou retoma) a sessão de voz do dia, aplicando a regra de 1 chamada por dia de até 60 minutos. */
export async function POST() {
  const user = await apiUser("patient");
  if (!user) return bad("Não autenticado", 401);
  const agent = getAgent(user.id);
  if (!agent) return bad("Finalize seu cadastro primeiro.", 409);

  reapStale(user.id);
  const active = activeSession(user.id);
  if (active && secondsLeft(active) > 30) {
    return json({ sessionId: active.id, resumed: true, secondsLeft: secondsLeft(active), kind: active.kind, mock: config.mock() });
  }

  const limit = callLimitFor(user);
  const used = callsToday(user.id);
  if (used >= limit) return bad(`Você já fez sua chamada de hoje (limite: ${limit} por dia). Amanhã ela estará liberada de novo — e, em caso de emergência, use as mensagens.`, 429);

  const kind = hasCompletedSession(user.id) ? "acompanhamento" : "triagem";
  const max = config.sessionMaxMinutes();
  const id = run("INSERT INTO sessions (user_id, number, kind, max_minutes, prompt_version) VALUES (?, ?, ?, ?, ?)", user.id, nextSessionNumber(user.id), kind, max, PROMPT_VERSION).id;
  audit("patient", "session.started", user.id, { id, kind });
  return json({ sessionId: id, resumed: false, secondsLeft: max * 60, kind, mock: config.mock() });
}
