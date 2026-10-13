import { all, get, run, audit } from "./db";
import { EMPTY_MEMORY, type Agent, type CaseMemory, type Message, type Session, type SessionAnalysis } from "./types";
import { config } from "./config";
import { dayKey, parseDbDate } from "./time";

export const getAgent = (uid: number) => get<Agent>("SELECT * FROM agent_settings WHERE user_id = ?", uid);

export function getMemory(uid: number): CaseMemory {
  const r = get<{ data: string }>("SELECT data FROM case_memory WHERE user_id = ?", uid);
  if (!r) return { ...EMPTY_MEMORY };
  try {
    return { ...EMPTY_MEMORY, ...JSON.parse(r.data) };
  } catch {
    return { ...EMPTY_MEMORY };
  }
}

/** A memória é versionada: nunca sobrescreve histórico (append-only em case_memory_versions). */
export function saveMemory(uid: number, mem: CaseMemory, sessionId?: number) {
  const cur = get<{ version: number }>("SELECT version FROM case_memory WHERE user_id = ?", uid);
  const version = (cur?.version ?? 0) + 1;
  const data = JSON.stringify(mem);
  run(
    `INSERT INTO case_memory (user_id, data, version, updated_at) VALUES (?, ?, ?, datetime('now'))
     ON CONFLICT(user_id) DO UPDATE SET data = excluded.data, version = excluded.version, updated_at = excluded.updated_at`,
    uid,
    data,
    version,
  );
  run("INSERT INTO case_memory_versions (user_id, version, data, session_id) VALUES (?, ?, ?, ?)", uid, version, data, sessionId ?? null);
}

export const endedSessions = (uid: number, limit = 50) =>
  all<Session>("SELECT * FROM sessions WHERE user_id = ? AND status = 'ended' ORDER BY id DESC LIMIT ?", uid, limit);

export const allSessions = (uid: number) => all<Session>("SELECT * FROM sessions WHERE user_id = ? ORDER BY id DESC", uid);

export const getSession = (id: number) => get<Session>("SELECT * FROM sessions WHERE id = ?", id);

export const activeSession = (uid: number) =>
  get<Session>("SELECT * FROM sessions WHERE user_id = ? AND status = 'active' ORDER BY id DESC LIMIT 1", uid);

export function parseAnalysis(s: Session | null | undefined): SessionAnalysis | null {
  if (!s?.analysis) return null;
  try {
    return JSON.parse(s.analysis) as SessionAnalysis;
  } catch {
    return null;
  }
}

export const sessionMessages = (sessionId: number) =>
  all<Message>("SELECT * FROM messages WHERE session_id = ? ORDER BY id ASC", sessionId);

export const recentChat = (uid: number, limit = 30) =>
  all<Message>("SELECT * FROM messages WHERE user_id = ? AND channel = 'chat' ORDER BY id DESC LIMIT ?", uid, limit).reverse();

export function addMessage(uid: number, sessionId: number | null, channel: "voice" | "chat", role: Message["role"], content: string) {
  return run("INSERT INTO messages (user_id, session_id, channel, role, content) VALUES (?, ?, ?, ?, ?)", uid, sessionId, channel, role, content).id;
}

export const activeGoals = (uid: number) =>
  all<{ id: number; title: string; status: string; created_at: string }>(
    "SELECT * FROM goals WHERE user_id = ? ORDER BY CASE status WHEN 'ativa' THEN 0 WHEN 'atingida' THEN 1 ELSE 2 END, id DESC",
    uid,
  );

export const allExercises = (uid: number) =>
  all<{ id: number; title: string; description: string; status: string; feedback: string | null; created_at: string; completed_at: string | null }>(
    "SELECT * FROM exercises WHERE user_id = ? ORDER BY id DESC",
    uid,
  );

export const moodHistory = (uid: number, limit = 30) =>
  all<{ score: number; note: string | null; created_at: string }>("SELECT score, note, created_at FROM moods WHERE user_id = ? ORDER BY id DESC LIMIT ?", uid, limit).reverse();

export const screenings = (uid: number) =>
  all<{ kind: string; score: number; flagged: number; answers: string; created_at: string }>(
    "SELECT * FROM screenings WHERE user_id = ? ORDER BY id ASC",
    uid,
  );

export const nextSessionNumber = (uid: number) =>
  (get<{ n: number }>("SELECT COALESCE(MAX(number), 0) + 1 AS n FROM sessions WHERE user_id = ?", uid)?.n ?? 1);

/** A triagem só conta como feita se durou o suficiente (>= 10 min); quedas de conexão não "queimam" a primeira sessão. */
export const hasCompletedSession = (uid: number) => !!get("SELECT 1 FROM sessions WHERE user_id = ? AND status = 'ended' AND kind = 'triagem' AND duration_sec >= 600", uid);

export function raiseAlert(uid: number, level: number, source: string, excerpt: string) {
  // Evita duplicar alertas idênticos abertos em sequência.
  const dup = get<{ id: number; level: number }>(
    "SELECT id, level FROM alerts WHERE user_id = ? AND status = 'aberto' AND source = ? AND created_at > datetime('now', '-10 minutes') ORDER BY id DESC LIMIT 1",
    uid,
    source,
  );
  if (dup) {
    if (level > dup.level) run("UPDATE alerts SET level = ?, excerpt = ? WHERE id = ?", level, excerpt.slice(0, 500), dup.id);
    return dup.id;
  }
  const id = run("INSERT INTO alerts (user_id, level, source, excerpt) VALUES (?, ?, ?, ?)", uid, level, source, excerpt.slice(0, 500)).id;
  audit("system", "alert.raised", uid, { level, source });
  return id;
}

/** Quantas chamadas de voz o paciente já iniciou hoje (fuso de São Paulo). */
export function callsToday(uid: number): number {
  const today = dayKey(new Date());
  // Só contam chamadas em andamento ou que duraram pelo menos 3 minutos (falha técnica não consome o direito do dia).
  return all<{ started_at: string }>("SELECT started_at FROM sessions WHERE user_id = ? AND started_at > datetime('now', '-2 days') AND (status = 'active' OR duration_sec >= 180)", uid).filter(
    (s) => dayKey(parseDbDate(s.started_at)) === today,
  ).length;
}

export function callLimitFor(user: { calls_per_day: number | null }): number {
  return user.calls_per_day ?? config.callsPerDay();
}

export function chatToday(uid: number): number {
  const today = dayKey(new Date());
  return all<{ created_at: string }>("SELECT created_at FROM messages WHERE user_id = ? AND channel='chat' AND role='user' AND created_at > datetime('now', '-2 days')", uid).filter(
    (m) => dayKey(parseDbDate(m.created_at)) === today,
  ).length;
}

/** Disponibilidade da chamada: liberada se ainda há direito no dia OU se há uma sessão em andamento que pode ser retomada. */
export function callAvailability(user: { id: number; calls_per_day: number | null }) {
  const act = activeSession(user.id);
  const resumable = !!act && Math.round(act.max_minutes * 60 - (Date.now() - parseDbDate(act.started_at).getTime()) / 1000) > 30;
  const used = callsToday(user.id);
  const limit = callLimitFor(user);
  return { available: resumable || used < limit, resumable, used, limit };
}
