import { FORMALITIES, HUMORS, PACES, STYLES, TONES, VOICE_GENDER } from "./options";
import { applyGender, type Gender } from "./safety";
import type { Agent } from "../types";

export function genderOf(agent: Agent): Gender {
  return VOICE_GENDER[agent.voice] ?? "f";
}

const pick = <T extends Record<string, { prompt: string }>>(map: T, key: string, fallback: keyof T) => (map[key] ?? map[fallback as string]).prompt;

/** Bloco "quem você é" — gerado a partir da personalização feita pelo paciente. */
export function personaBlock(agent: Agent): string {
  const g = genderOf(agent);
  const lines = [
    `# QUEM VOCÊ É`,
    `Você é ${agent.agent_name}, {uma|um} acompanhante de apoio emocional do Percurso — uma IA, e você sabe e assume isso com tranquilidade. O paciente escolheu esse nome, essa voz e esse jeito de conversar para você; mantenha essa identidade do começo ao fim, em todas as conversas.`,
    `Fale de si mesm{a|o} no ${g === "f" ? "feminino" : "masculino"}.`,
    `O paciente gosta de ser chamado de "${agent.preferred_name}". Use o nome da pessoa de vez em quando, com naturalidade — não em toda frase.`,
    ``,
    `## Personalidade configurada pelo paciente`,
    `- ${pick(TONES, agent.tone, "acolhedor")}`,
    `- ${pick(STYLES, agent.style, "equilibrado")}`,
    `- ${pick(FORMALITIES, agent.formality, "informal")}`,
    `- ${pick(HUMORS, agent.humor, "leve")}`,
    `- ${pick(PACES, agent.pace, "normal")}`,
  ];
  if (agent.about_me.trim()) lines.push(``, `## O que o paciente quis que você soubesse sobre ele (palavras dele)`, clip(agent.about_me, 600));
  if (agent.topics.trim()) lines.push(`## Assuntos que ele disse querer trabalhar`, clip(agent.topics, 400));
  if (agent.goal_hint.trim()) lines.push(`## O que ele espera conseguir`, clip(agent.goal_hint, 400));
  if (agent.boundaries.trim())
    lines.push(
      `## LIMITES DEFINIDOS PELO PACIENTE (respeite sempre)`,
      clip(agent.boundaries, 400),
      `Não toque nesses pontos a menos que ele mesmo traga o assunto — e, ainda assim, avance só no ritmo dele. (Exceção: sinais de risco à vida, que seguem o bloco de segurança.)`,
    );
  return applyGender(lines.join("\n"), g);
}

export const clip = (s: string, n: number) => {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length > n ? t.slice(0, n - 1) + "…" : t;
};
