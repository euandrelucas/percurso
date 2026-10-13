import { apiUser } from "@/lib/auth";
import { bad, clientIp, json, parseBody } from "@/lib/api";
import { audit, prisma } from "@/lib/prisma";
import { parseAgentInput } from "@/lib/agent-input";
import { onboardingSchema } from "@/lib/schemas";
import { scoreScale } from "@/lib/screening";
import { raiseAlert } from "@/lib/store";

export async function POST(req: Request) {
  const user = await apiUser("patient");
  if (!user) return bad("Não autenticado", 401);
  if (user.onboarded) return bad("Onboarding já concluído", 409);
  const [b, err] = await parseBody(req, onboardingSchema, "Confirme o consentimento e responda a todas as perguntas.");
  if (err) return err;

  const input = parseAgentInput(b as Record<string, unknown>);
  if (!input.preferred_name) return bad("Diga como você gosta de ser chamado(a).");
  const phq = scoreScale(b.phq2);
  const gad = scoreScale(b.gad2);
  const selfHarm = b.selfHarm === "sim";

  await prisma.$transaction([
    prisma.agentSettings.create({ data: { user_id: user.id, ...input } }),
    prisma.screening.create({ data: { user_id: user.id, kind: "phq2", answers: b.phq2, score: phq.score, flagged: phq.flagged } }),
    prisma.screening.create({ data: { user_id: user.id, kind: "gad2", answers: b.gad2, score: gad.score, flagged: gad.flagged } }),
    prisma.screening.create({ data: { user_id: user.id, kind: "seguranca", answers: [selfHarm ? 1 : 0], score: selfHarm ? 1 : 0, flagged: selfHarm } }),
    prisma.user.update({ where: { id: user.id }, data: { onboarded: true, consent_at: new Date() } }),
  ]);
  await audit("patient", "onboarding.completed", user.id, { consent: true }, clientIp(req));

  // Resposta afirmativa sobre autolesão/ideação: alerta imediato para a equipe (decisão humana).
  if (selfHarm) await raiseAlert(user.id, 2, "triagem", "No questionário inicial, a pessoa disse ter pensado em se machucar ou que seria melhor não estar aqui.");
  return json({ ok: true, next: "/app", crisis: selfHarm });
}
