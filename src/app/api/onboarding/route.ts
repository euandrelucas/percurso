import { apiUser } from "@/lib/auth";
import { bad, json, readJson } from "@/lib/api";
import { audit, run } from "@/lib/db";
import { parseAgentInput } from "@/lib/agent-input";
import { scoreScale } from "@/lib/screening";
import { raiseAlert } from "@/lib/store";

export async function POST(req: Request) {
  const user = await apiUser("patient");
  if (!user) return bad("Não autenticado", 401);
  if (user.onboarded) return bad("Onboarding já concluído", 409);
  const b = await readJson(req);
  if (!b) return bad("Requisição inválida");
  if (b.consent !== true || b.adult !== true) return bad("É necessário confirmar o consentimento e ser maior de 18 anos.");

  const input = parseAgentInput(b);
  if (!input.preferred_name) return bad("Diga como você gosta de ser chamado(a).");

  let phq: { score: number; flagged: boolean }, gad: { score: number; flagged: boolean };
  try {
    phq = scoreScale((b.phq2 as number[]) ?? []);
    gad = scoreScale((b.gad2 as number[]) ?? []);
  } catch {
    return bad("Responda todas as perguntas da triagem.");
  }
  const selfHarm = b.selfHarm === "sim";

  run(
    `INSERT INTO agent_settings (user_id, preferred_name, agent_name, voice, tone, style, formality, humor, pace, avatar, about_me, topics, boundaries, goal_hint)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    user.id, input.preferred_name, input.agent_name, input.voice, input.tone, input.style, input.formality, input.humor, input.pace, input.avatar, input.about_me, input.topics, input.boundaries, input.goal_hint,
  );
  run("INSERT INTO screenings (user_id, kind, answers, score, flagged) VALUES (?, 'phq2', ?, ?, ?)", user.id, JSON.stringify(b.phq2), phq.score, phq.flagged ? 1 : 0);
  run("INSERT INTO screenings (user_id, kind, answers, score, flagged) VALUES (?, 'gad2', ?, ?, ?)", user.id, JSON.stringify(b.gad2), gad.score, gad.flagged ? 1 : 0);
  run("INSERT INTO screenings (user_id, kind, answers, score, flagged) VALUES (?, 'seguranca', ?, ?, ?)", user.id, JSON.stringify([selfHarm ? 1 : 0]), selfHarm ? 1 : 0, selfHarm ? 1 : 0);
  run("UPDATE users SET onboarded = 1, consent_at = datetime('now') WHERE id = ?", user.id);
  audit("patient", "onboarding.completed", user.id);

  // Resposta afirmativa sobre autolesão/ideação: alerta imediato para a equipe (decisão humana).
  if (selfHarm) raiseAlert(user.id, 2, "triagem", "No questionário inicial, a pessoa disse ter pensado em se machucar ou que seria melhor não estar aqui.");
  return json({ ok: true, next: "/app", crisis: selfHarm });
}
