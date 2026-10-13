import { FORMALITIES, HUMORS, PACES, STYLES, TONES } from "./options";
import { applyGender, type Gender } from "./safety";
import type { Agent } from "../types";

/** Gênero com que o acompanhante fala de si (escolhido pelo paciente; independe da voz). */
export function genderOf(agent: Agent): Gender {
  return agent.agent_gender === "m" ? "m" : "f";
}

/** Como tratar a pessoa: a IA precisa flexionar adjetivos ("cansado/cansada") sem errar nem presumir. */
function patientAddress(agent: Agent): string {
  if (agent.patient_gender === "m") return `Trate a pessoa no MASCULINO ao flexionar adjetivos e particípios ("cansado", "sozinho", "obrigado por confiar").`;
  if (agent.patient_gender === "f") return `Trate a pessoa no FEMININO ao flexionar adjetivos e particípios ("cansada", "sozinha").`;
  return `Você NÃO sabe como a pessoa prefere ser tratada: evite flexionar gênero ao falar com ela (prefira "como você está se sentindo?" a "você está cansado/cansada?"; "que bom ter você aqui" a "bem-vindo"). Se ela usar uma forma para si, passe a usar a mesma.`;
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
    patientAddress(agent),
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
