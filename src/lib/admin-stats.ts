import { prisma } from "./prisma";
import { config } from "./config";

const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);
const round1 = (n: number | null | undefined) => (n == null ? null : Math.round(Number(n) * 10) / 10);

export async function dashboardStats() {
  const REAL = { status: "ended", duration_sec: { gte: 180 } } as const;
  const [invites, invUsed, invRevoked, patients, onboarded, sessionsEnded, perUser, endReasons, full, chatUsers, chatMsgs, openAlerts, highAlerts, alertsTotal, flaggedScreen, doneEx, closedEx, mood, avgDur, daily, moodDaily, risk, helpAgg, helpByPrompt] = await Promise.all([
    prisma.invite.count(),
    prisma.invite.count({ where: { used_by_id: { not: null } } }),
    prisma.invite.count({ where: { revoked: true, used_by_id: null } }),
    prisma.user.count({ where: { role: "patient" } }),
    prisma.user.count({ where: { role: "patient", onboarded: true } }),
    prisma.therapySession.count({ where: { status: "ended" } }),
    prisma.therapySession.groupBy({ by: ["user_id"], where: REAL, _count: { _all: true } }),
    prisma.therapySession.groupBy({ by: ["end_reason"], where: { status: "ended" }, _count: { _all: true } }),
    prisma.$queryRaw<{ n: bigint }[]>`SELECT COUNT(*)::bigint AS n FROM sessions WHERE status = 'ended' AND duration_sec >= max_minutes * 60 * 0.85`,
    prisma.message.groupBy({ by: ["user_id"], where: { channel: "chat", role: "user" } }),
    prisma.message.count({ where: { channel: "chat", role: "user" } }),
    prisma.alert.count({ where: { status: "aberto" } }),
    prisma.alert.count({ where: { status: { not: "resolvido" }, level: { gte: 3 } } }),
    prisma.alert.count(),
    prisma.screening.groupBy({ by: ["user_id"], where: { flagged: true, kind: { not: "seguranca" } } }),
    prisma.exercise.count({ where: { status: "feito" } }),
    prisma.exercise.count({ where: { status: { in: ["feito", "nao_realizado"] } } }),
    prisma.$queryRaw<{ s: number | null; e: number | null }[]>`SELECT AVG(mood_start)::float AS s, AVG(mood_end)::float AS e FROM sessions WHERE mood_start IS NOT NULL AND mood_end IS NOT NULL`,
    prisma.therapySession.aggregate({ where: REAL, _avg: { duration_sec: true } }),
    prisma.$queryRaw<{ d: string; n: bigint; min: number }[]>`
      SELECT to_char(started_at AT TIME ZONE ${config.timezone}, 'YYYY-MM-DD') AS d, COUNT(*)::bigint AS n, COALESCE(SUM(duration_sec),0)::float / 60 AS min
      FROM sessions WHERE started_at > now() - interval '30 days' GROUP BY d ORDER BY d`,
    prisma.$queryRaw<{ d: string; v: number }[]>`
      SELECT to_char(created_at AT TIME ZONE ${config.timezone}, 'YYYY-MM-DD') AS d, AVG(score)::float AS v
      FROM moods WHERE created_at > now() - interval '30 days' GROUP BY d ORDER BY d`,
    prisma.alert.groupBy({ by: ["level"], _count: { _all: true } }),
    prisma.therapySession.groupBy({ by: ["feedback_rating"], where: { feedback_rating: { not: null } }, _count: { _all: true } }),
    prisma.$queryRaw<{ v: string | null; n: bigint; avg: number }[]>`
      SELECT prompt_version AS v, COUNT(*)::bigint AS n, AVG(feedback_rating)::float AS avg
      FROM sessions WHERE feedback_rating IS NOT NULL GROUP BY prompt_version ORDER BY prompt_version DESC LIMIT 8`,
  ]);
  const reason = (r: string) => endReasons.find((x) => x.end_reason === r)?._count._all ?? 0;
  const withSession = perUser.length;
  const returning = perUser.filter((u) => u._count._all >= 2).length;
  return {
    invites, invUsed, invRevoked, inviteRate: pct(invUsed, invites),
    patients, onboarded, onboardRate: pct(onboarded, patients),
    sessionsEnded, withSession, firstSessionRate: pct(withSession, onboarded), returning, returnRate: pct(returning, withSession),
    avgDurMin: Math.round((avgDur._avg.duration_sec ?? 0) / 60), fullRate: pct(Number(full[0]?.n ?? 0), sessionsEnded),
    byAgent: reason("agente"), byPatient: reason("paciente"), byTime: reason("tempo"), byTech: reason("falha_tecnica") + reason("abandonada"),
    chatUsers: chatUsers.length, chatMsgs, chatRate: pct(chatUsers.length, onboarded),
    openAlerts, highAlerts, alertsTotal, flaggedScreen: flaggedScreen.length,
    exerciseRate: pct(doneEx, closedEx),
    moodStart: round1(mood[0]?.s), moodEnd: round1(mood[0]?.e),
    daily: daily.map((r) => ({ d: r.d, n: Number(r.n), min: Math.round(r.min) })),
    moodDaily: moodDaily.map((r) => ({ d: r.d, v: Math.round(r.v * 10) / 10 })),
    help: { total: helpAgg.reduce((a, r) => a + r._count._all, 0), yes: helpAgg.find((r) => r.feedback_rating === 3)?._count._all ?? 0, mid: helpAgg.find((r) => r.feedback_rating === 2)?._count._all ?? 0, no: helpAgg.find((r) => r.feedback_rating === 1)?._count._all ?? 0 },
    helpByPrompt: helpByPrompt.map((r) => ({ v: r.v ?? "—", n: Number(r.n), avg: Math.round(r.avg * 100) / 100 })),
    riskByLevel: [1, 2, 3].map((l) => ({ level: l, n: risk.find((r) => r.level === l)?._count._all ?? 0 })),
  };
}

