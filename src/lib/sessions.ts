import { config } from "./config";
import { audit, prisma } from "./prisma";
import { analyzeSession } from "./analysis";
import { activeSession, getSession } from "./store";
import type { Session } from "./types";

/** Encerra a sessão (idempotente: só o primeiro chamador vence) e dispara a análise pós-sessão em segundo plano. */
export async function endSession(id: number, reason: string): Promise<Session | null> {
  const s = await getSession(id);
  if (!s) return null;
  if (s.status === "ended") return s;
  const elapsed = Math.round((Date.now() - s.started_at.getTime()) / 1000);
  const duration = Math.max(0, Math.min(elapsed, (s.max_minutes + 3) * 60));
  const r = await prisma.therapySession.updateMany({ where: { id, status: "active" }, data: { status: "ended", ended_at: new Date(), duration_sec: duration, end_reason: reason } });
  if (r.count === 0) return getSession(id);
  await audit("system", "session.ended", s.user_id, { id, reason, duration });
  void analyzeSession(id).catch((e) => audit("system", "analysis.error", s.user_id, { id, error: String(e).slice(0, 200) }));
  return getSession(id);
}

/** Sessões abandonadas (aba fechada, queda de conexão) são encerradas ao consultar de novo. */
export async function reapStale(uid: number) {
  const s = await activeSession(uid);
  if (!s) return;
  const ageMin = (Date.now() - s.started_at.getTime()) / 60000;
  if (ageMin > s.max_minutes + 5) await endSession(s.id, "abandonada");
}

export const secondsLeft = (s: Session): number => Math.round(s.max_minutes * 60 - (Date.now() - s.started_at.getTime()) / 1000);
export const maxMinutes = () => config.sessionMaxMinutes();
