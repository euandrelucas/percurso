import { all, get } from "./db";

const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);

export function dashboardStats() {
  const n = (sql: string) => get<{ n: number }>(sql)?.n ?? 0;
  const invites = n("SELECT COUNT(*) AS n FROM invites");
  const invUsed = n("SELECT COUNT(*) AS n FROM invites WHERE used_by IS NOT NULL");
  const invRevoked = n("SELECT COUNT(*) AS n FROM invites WHERE revoked = 1 AND used_by IS NULL");
  const patients = n("SELECT COUNT(*) AS n FROM users WHERE role = 'patient'");
  const onboarded = n("SELECT COUNT(*) AS n FROM users WHERE role = 'patient' AND onboarded = 1");
  const sessionsEnded = n("SELECT COUNT(*) AS n FROM sessions WHERE status = 'ended'");
  const withSession = n("SELECT COUNT(DISTINCT user_id) AS n FROM sessions WHERE status = 'ended' AND duration_sec >= 180");
  const returning = n("SELECT COUNT(*) AS n FROM (SELECT user_id FROM sessions WHERE status = 'ended' AND duration_sec >= 180 GROUP BY user_id HAVING COUNT(*) >= 2)");
  const avgDur = get<{ a: number | null }>("SELECT AVG(duration_sec) AS a FROM sessions WHERE status = 'ended' AND duration_sec >= 180")?.a ?? 0;
  const endReasons = all<{ end_reason: string | null; n: number }>("SELECT end_reason, COUNT(*) AS n FROM sessions WHERE status = 'ended' GROUP BY end_reason");
  const reason = (r: string) => endReasons.find((x) => x.end_reason === r)?.n ?? 0;
  const full = n("SELECT COUNT(*) AS n FROM sessions WHERE status = 'ended' AND duration_sec >= max_minutes * 60 * 0.85");
  const chatUsers = n("SELECT COUNT(DISTINCT user_id) AS n FROM messages WHERE channel = 'chat' AND role = 'user'");
  const chatMsgs = n("SELECT COUNT(*) AS n FROM messages WHERE channel = 'chat' AND role = 'user'");
  const openAlerts = n("SELECT COUNT(*) AS n FROM alerts WHERE status = 'aberto'");
  const highAlerts = n("SELECT COUNT(*) AS n FROM alerts WHERE status != 'resolvido' AND level >= 3");
  const alertsTotal = n("SELECT COUNT(*) AS n FROM alerts");
  const flaggedScreen = n("SELECT COUNT(DISTINCT user_id) AS n FROM screenings WHERE flagged = 1 AND kind != 'seguranca'");
  const doneEx = n("SELECT COUNT(*) AS n FROM exercises WHERE status = 'feito'");
  const doneGoalsEx = n("SELECT COUNT(*) AS n FROM exercises WHERE status IN ('feito','nao_realizado')");
  const mood = get<{ s: number | null; e: number | null }>(
    "SELECT AVG(mood_start) AS s, AVG(mood_end) AS e FROM sessions WHERE mood_start IS NOT NULL AND mood_end IS NOT NULL",
  );
  const last7 = all<{ d: string; n: number }>("SELECT date(started_at) AS d, COUNT(*) AS n FROM sessions WHERE started_at > datetime('now','-7 days') GROUP BY d ORDER BY d");

  return {
    invites, invUsed, invRevoked, inviteRate: pct(invUsed, invites),
    patients, onboarded, onboardRate: pct(onboarded, patients),
    sessionsEnded, withSession, firstSessionRate: pct(withSession, onboarded), returning, returnRate: pct(returning, withSession),
    avgDurMin: Math.round(avgDur / 60), fullRate: pct(full, sessionsEnded),
    byAgent: reason("agente"), byPatient: reason("paciente"), byTime: reason("tempo"), byTech: reason("falha_tecnica") + reason("abandonada"),
    chatUsers, chatMsgs, chatRate: pct(chatUsers, onboarded),
    openAlerts, highAlerts, alertsTotal, flaggedScreen,
    exerciseRate: pct(doneEx, doneGoalsEx), 
    moodStart: mood?.s != null ? Math.round(mood.s * 10) / 10 : null,
    moodEnd: mood?.e != null ? Math.round(mood.e * 10) / 10 : null,
    last7,
  };
}
