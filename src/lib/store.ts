import type { Prisma } from "@prisma/client";
import { audit, prisma } from "./prisma";
import { dec, decSafe, enc } from "./crypto";
import { config } from "./config";
import { dayKey } from "./time";
import { EMPTY_MEMORY, type Agent, type CaseMemory, type Message, type Session, type SessionAnalysis } from "./types";

// ---- Rótulos de criptografia (AAD) -------------------------------------------------------------------------------
const L = { msg: "message.content", analysis: "session.analysis", memory: "case_memory.data", report: "report.data", alert: "alert.excerpt", totp: "user.totp" } as const;
export const encTotp = (s: string) => enc(s, L.totp)!;
export const decTotp = (s: string) => dec(s, L.totp)!;

// ---- Agente --------------------------------------------------------------------------------------------------------
export const getAgent = (uid: number) => prisma.agentSettings.findUnique({ where: { user_id: uid } }) as Promise<Agent | null>;

// ---- Memória do caso (versionada, append-only) ----------------------------------------------------------------------
export async function getMemory(uid: number): Promise<CaseMemory> {
  const r = await prisma.caseMemory.findUnique({ where: { user_id: uid } });
  if (!r) return { ...EMPTY_MEMORY };
  try {
    return { ...EMPTY_MEMORY, ...JSON.parse(dec(r.data, L.memory) ?? "{}") };
  } catch {
    return { ...EMPTY_MEMORY };
  }
}

export async function saveMemory(uid: number, mem: CaseMemory, sessionId?: number) {
  const data = enc(JSON.stringify(mem), L.memory)!;
  await prisma.$transaction(async (tx) => {
    const cur = await tx.caseMemory.findUnique({ where: { user_id: uid }, select: { version: true } });
    const version = (cur?.version ?? 0) + 1;
    await tx.caseMemory.upsert({ where: { user_id: uid }, create: { user_id: uid, data, version }, update: { data, version, updated_at: new Date() } });
    await tx.caseMemoryVersion.create({ data: { user_id: uid, version, data, session_id: sessionId ?? null } });
  });
}

export async function memoryVersions(uid: number) {
  const rows = await prisma.caseMemoryVersion.findMany({ where: { user_id: uid }, orderBy: { version: "asc" } });
  return rows.map((r) => ({ version: r.version, created_at: r.created_at, session_id: r.session_id, data: safeJson<CaseMemory>(decSafe(r.data, L.memory)) }));
}

const safeJson = <T>(s: string): T | null => {
  try {
    return JSON.parse(s) as T;
  } catch {
    return null;
  }
};

// ---- Sessões --------------------------------------------------------------------------------------------------------
const hydrate = (s: Session | null): Session | null => (s ? { ...s, analysis: s.analysis ? decSafe(s.analysis, L.analysis) : null } : null);
const hydrateAll = (a: Session[]) => a.map((s) => hydrate(s)!);

export const getSession = async (id: number) => hydrate(await prisma.therapySession.findUnique({ where: { id } }));
export const endedSessions = async (uid: number, limit = 50) => hydrateAll(await prisma.therapySession.findMany({ where: { user_id: uid, status: "ended" }, orderBy: { id: "desc" }, take: limit }));
export const allSessions = async (uid: number) => hydrateAll(await prisma.therapySession.findMany({ where: { user_id: uid }, orderBy: { id: "desc" } }));
export const activeSession = async (uid: number) => hydrate(await prisma.therapySession.findFirst({ where: { user_id: uid, status: "active" }, orderBy: { id: "desc" } }));

export function parseAnalysis(s: Session | null | undefined): SessionAnalysis | null {
  return s?.analysis ? safeJson<SessionAnalysis>(s.analysis) : null;
}

export const saveAnalysis = (id: number, a: SessionAnalysis) =>
  prisma.therapySession.update({ where: { id }, data: { analysis: enc(JSON.stringify(a), L.analysis), mood_start: a.humor_estimado_inicio, mood_end: a.humor_estimado_fim } });

export async function nextSessionNumber(uid: number) {
  const r = await prisma.therapySession.aggregate({ where: { user_id: uid }, _max: { number: true } });
  return (r._max.number ?? 0) + 1;
}

/** A triagem só conta como feita se durou >= 10 min; quedas de conexão não "queimam" a primeira sessão. */
export const hasCompletedSession = async (uid: number) =>
  !!(await prisma.therapySession.findFirst({ where: { user_id: uid, status: "ended", kind: "triagem", duration_sec: { gte: 600 } }, select: { id: true } }));

// ---- Mensagens ------------------------------------------------------------------------------------------------------
const hydrateMsg = (m: Message): Message => ({ ...m, content: decSafe(m.content, L.msg) });

export const sessionMessages = async (sessionId: number) => (await prisma.message.findMany({ where: { session_id: sessionId }, orderBy: { id: "asc" } })).map(hydrateMsg);
export const recentChat = async (uid: number, limit = 30) => (await prisma.message.findMany({ where: { user_id: uid, channel: "chat" }, orderBy: { id: "desc" }, take: limit })).reverse().map(hydrateMsg);
export const allChat = async (uid: number) => (await prisma.message.findMany({ where: { user_id: uid, channel: "chat" }, orderBy: { id: "asc" } })).map(hydrateMsg);

export async function addMessage(uid: number, sessionId: number | null, channel: "voice" | "chat", role: Message["role"], content: string) {
  return (await prisma.message.create({ data: { user_id: uid, session_id: sessionId, channel, role, content: enc(content, L.msg)! } })).id;
}

// ---- Metas, exercícios, humor, escalas -------------------------------------------------------------------------------
export const activeGoals = (uid: number) => prisma.goal.findMany({ where: { user_id: uid }, orderBy: { id: "desc" } }).then((g) => g.sort((a, b) => rank(a.status) - rank(b.status)));
const rank = (s: string) => (s === "ativa" ? 0 : s === "atingida" ? 1 : 2);
export const allExercises = (uid: number) => prisma.exercise.findMany({ where: { user_id: uid }, orderBy: { id: "desc" } });
export const moodHistory = async (uid: number, limit = 30) => (await prisma.mood.findMany({ where: { user_id: uid }, orderBy: { id: "desc" }, take: limit })).reverse();
export const screenings = (uid: number) => prisma.screening.findMany({ where: { user_id: uid }, orderBy: { id: "asc" } });

// ---- Alertas de risco -----------------------------------------------------------------------------------------------
export async function raiseAlert(uid: number, level: number, source: string, excerpt: string) {
  const dup = await prisma.alert.findFirst({ where: { user_id: uid, status: "aberto", source, created_at: { gt: new Date(Date.now() - 10 * 60_000) } }, orderBy: { id: "desc" } });
  if (dup) {
    if (level > dup.level) await prisma.alert.update({ where: { id: dup.id }, data: { level, excerpt: enc(excerpt.slice(0, 500), L.alert)! } });
    return dup.id;
  }
  const a = await prisma.alert.create({ data: { user_id: uid, level, source, excerpt: enc(excerpt.slice(0, 500), L.alert)! } });
  await audit("system", "alert.raised", uid, { level, source });
  return a.id;
}

export type AlertRow = { id: number; user_id: number; level: number; source: string; excerpt: string; status: string; note: string | null; created_at: Date; handled_at: Date | null; user?: { id: number; name: string } };
export async function listAlerts(where: Prisma.AlertWhereInput = {}, take = 200): Promise<AlertRow[]> {
  const rows = await prisma.alert.findMany({ where, include: { user: { select: { id: true, name: true } } }, orderBy: [{ id: "desc" }], take });
  return rows.map((r) => ({ ...r, excerpt: decSafe(r.excerpt, L.alert) }));
}

// ---- Relatórios -----------------------------------------------------------------------------------------------------
export async function saveReport(uid: number, data: unknown, model: string, promptVersion: string) {
  return (await prisma.report.create({ data: { user_id: uid, data: enc(JSON.stringify(data), L.report)!, model, prompt_version: promptVersion } })).id;
}
export async function getReport<T>(uid: number, id?: number | null): Promise<{ id: number; created_at: Date; data: T } | null> {
  const r = id ? await prisma.report.findFirst({ where: { id, user_id: uid } }) : await prisma.report.findFirst({ where: { user_id: uid }, orderBy: { id: "desc" } });
  if (!r) return null;
  const data = safeJson<T>(decSafe(r.data, L.report));
  return data ? { id: r.id, created_at: r.created_at, data } : null;
}

// ---- Regras de uso diário -------------------------------------------------------------------------------------------
/** Chamadas em andamento ou com >= 3 min (falha técnica não consome o direito do dia). */
export async function callsToday(uid: number): Promise<number> {
  const today = dayKey(new Date());
  const rows = await prisma.therapySession.findMany({
    where: { user_id: uid, started_at: { gt: new Date(Date.now() - 2 * 864e5) }, OR: [{ status: "active" }, { duration_sec: { gte: 180 } }] },
    select: { started_at: true },
  });
  return rows.filter((s) => dayKey(s.started_at) === today).length;
}

export const callLimitFor = (user: { calls_per_day: number | null }) => user.calls_per_day ?? config.callsPerDay();

export async function chatToday(uid: number): Promise<number> {
  const today = dayKey(new Date());
  const rows = await prisma.message.findMany({ where: { user_id: uid, channel: "chat", role: "user", created_at: { gt: new Date(Date.now() - 2 * 864e5) } }, select: { created_at: true } });
  return rows.filter((m) => dayKey(m.created_at) === today).length;
}

export async function callAvailability(user: { id: number; calls_per_day: number | null }) {
  const act = await activeSession(user.id);
  const resumable = !!act && Math.round(act.max_minutes * 60 - (Date.now() - act.started_at.getTime()) / 1000) > 30;
  const used = await callsToday(user.id);
  const limit = callLimitFor(user);
  return { available: resumable || used < limit, resumable, used, limit };
}
