import { config } from "./config";
import { run, get, audit } from "./db";
import { analyzeSession } from "./analysis";
import { addMessage, getSession } from "./store";
import type { Session } from "./types";
import { parseDbDate } from "./time";

/** Encerra a sessão (idempotente) e dispara a análise pós-sessão em segundo plano. */
export function endSession(id: number, reason: string): Session | undefined {
  const s = getSession(id);
  if (!s) return undefined;
  if (s.status === "ended") return s;
  const elapsed = Math.round((Date.now() - parseDbDate(s.started_at).getTime()) / 1000);
  const duration = Math.max(0, Math.min(elapsed, (s.max_minutes + 3) * 60));
  run("UPDATE sessions SET status = 'ended', ended_at = datetime('now'), duration_sec = ?, end_reason = ? WHERE id = ?", duration, reason, id);
  audit("system", "session.ended", s.user_id, { id, reason, duration });
  void analyzeSession(id).catch((e) => audit("system", "analysis.error", s.user_id, { id, error: String(e).slice(0, 200) }));
  return getSession(id);
}

/** Sessões abandonadas (aba fechada, queda de conexão) são encerradas ao consultar de novo. */
export function reapStale(uid: number) {
  const s = get<Session>("SELECT * FROM sessions WHERE user_id = ? AND status = 'active' ORDER BY id DESC LIMIT 1", uid);
  if (!s) return;
  const age = (Date.now() - parseDbDate(s.started_at).getTime()) / 60000;
  if (age > s.max_minutes + 5) endSession(s.id, "abandonada");
}

export function secondsLeft(s: Session): number {
  return Math.round(s.max_minutes * 60 - (Date.now() - parseDbDate(s.started_at).getTime()) / 1000);
}

export const maxMinutes = () => config.sessionMaxMinutes();
export { addMessage };
