import { prisma } from "./prisma";
import { activeGoals, allChat, allExercises, allSessions, getAgent, getMemory, listAlerts, memoryVersions, moodHistory, parseAnalysis, screenings, sessionMessages } from "./store";
import { fmtDate, fmtDateTime, fmtDuration } from "./time";
import { parseAvatar, TONES, STYLES, VOICES, FORMALITIES, HUMORS, PACES } from "./prompts/options";
import { SCALE_OPTIONS } from "./screening";
import type { CaseMemory, SessionAnalysis } from "./types";

/**
 * Dossiê determinístico do paciente: tudo que vai para o PDF do estudo e para o prompt do relatório.
 * Nada aqui passa por IA — são os registros brutos, na ordem em que aconteceram.
 */
export type Dossier = Awaited<ReturnType<typeof buildDossier>>;

export async function buildDossier(uid: number) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: uid }, include: { invite: true } });
  const [agent, memory, versions, sessions, scr, moods, goals, exercises, alerts, chat] = await Promise.all([
    getAgent(uid), getMemory(uid), memoryVersions(uid), allSessions(uid), screenings(uid), moodHistory(uid, 1000), activeGoals(uid), allExercises(uid), listAlerts({ user_id: uid }, 500), allChat(uid),
  ]);
  const chrono = [...sessions].reverse();
  const sessionRows = await Promise.all(
    chrono.map(async (s) => ({
      id: s.id,
      number: s.number,
      kind: s.kind,
      status: s.status,
      started: fmtDateTime(s.started_at),
      startedAt: s.started_at,
      duration: fmtDuration(s.duration_sec),
      durationSec: s.duration_sec ?? 0,
      endReason: s.end_reason,
      promptVersion: s.prompt_version,
      feedbackRating: s.feedback_rating,
      feedbackNote: s.feedback_note,
      moodStart: s.mood_start,
      moodEnd: s.mood_end,
      analysis: parseAnalysis(s) as SessionAnalysis | null,
      messages: (await sessionMessages(s.id)).filter((m) => m.role !== "system").map((m) => ({ role: m.role, content: m.content, at: fmtDateTime(m.created_at) })),
    })),
  );
  const av = agent ? parseAvatar(agent.avatar) : null;
  return {
    generatedAt: new Date(),
    patient: {
      id: user.id,
      name: user.name,
      email: user.email,
      registeredAt: fmtDateTime(user.created_at),
      consentAt: user.consent_at ? fmtDateTime(user.consent_at) : null,
      inviteLabel: user.invite?.label ?? null,
      status: user.status,
    },
    agent: agent
      ? {
          name: agent.agent_name,
          preferredName: agent.preferred_name,
          voice: VOICES.find((v) => v.id === agent.voice)?.label ?? agent.voice,
          tone: TONES[agent.tone as keyof typeof TONES]?.label ?? agent.tone,
          style: STYLES[agent.style as keyof typeof STYLES]?.label ?? agent.style,
          formality: FORMALITIES[agent.formality as keyof typeof FORMALITIES]?.label ?? agent.formality,
          humor: HUMORS[agent.humor as keyof typeof HUMORS]?.label ?? agent.humor,
          pace: PACES[agent.pace as keyof typeof PACES]?.label ?? agent.pace,
          aboutMe: agent.about_me, topics: agent.topics, boundaries: agent.boundaries, goalHint: agent.goal_hint,
          avatar: av,
        }
      : null,
    screenings: scr.map((s) => ({
      kind: s.kind,
      score: s.score,
      flagged: s.flagged,
      date: fmtDate(s.created_at),
      answers: s.kind === "seguranca" ? [(s.answers as number[])[0] ? "Sim" : "Não"] : (s.answers as number[]).map((a) => SCALE_OPTIONS[a]),
    })),
    sessions: sessionRows,
    moods: moods.map((m) => ({ score: m.score, note: m.note, date: fmtDate(m.created_at), iso: m.created_at.toISOString().slice(0, 10), at: fmtDateTime(m.created_at) })),
    goals: goals.map((g) => ({ title: g.title, status: g.status, created: fmtDate(g.created_at) })),
    exercises: exercises.map((e) => ({ title: e.title, description: e.description, status: e.status, feedback: e.feedback, created: fmtDate(e.created_at), completed: e.completed_at ? fmtDate(e.completed_at) : null })),
    alerts: alerts.map((a) => ({ level: a.level, source: a.source, excerpt: a.excerpt, status: a.status, note: a.note, at: fmtDateTime(a.created_at), handledAt: a.handled_at ? fmtDateTime(a.handled_at) : null })),
    memory: memory as CaseMemory,
    memoryVersions: versions.map((v) => ({ version: v.version, at: fmtDateTime(v.created_at), sessionId: v.session_id })),
    chat: chat.filter((m) => m.role !== "system").map((m) => ({ role: m.role, content: m.content, at: fmtDateTime(m.created_at) })),
    totals: {
      sessions: sessionRows.filter((s) => s.status === "ended" && s.durationSec >= 180).length,
      minutes: Math.round(sessionRows.reduce((a, s) => a + s.durationSec, 0) / 60),
      chatMessages: chat.filter((m) => m.role === "user").length,
      alerts: alerts.length,
    },
  };
}
