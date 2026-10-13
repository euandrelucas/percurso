import { PROMPT_VERSION } from "../config";
import { CRAFT_COMMON, CHAT_STYLE, VOICE_STYLE } from "./craft";
import { memoryBlock } from "./memory";
import { genderOf, personaBlock } from "./persona";
import { fillPhase, PHASE_FOLLOWUP, PHASE_TRIAGEM, WRAP_UP_RULES } from "./phases";
import { applyGender, safetyBlock } from "./safety";
import { getAgent } from "../store";
import type { Agent } from "../types";

export { PROMPT_VERSION };

async function need(uid: number): Promise<Agent> {
  const a = await getAgent(uid);
  if (!a) throw new Error("Agente não configurado para este usuário");
  return a;
}

export type VoiceContext = { sessionNumber: number; kind: "triagem" | "acompanhamento"; maxMinutes: number };

/** Instruções completas da chamada de voz (enviadas na criação da sessão Realtime). */
export async function buildVoiceInstructions(uid: number, ctx: VoiceContext): Promise<string> {
  const agent = await need(uid);
  const g = genderOf(agent);
  const phase = fillPhase(ctx.kind === "triagem" ? PHASE_TRIAGEM : PHASE_FOLLOWUP, { max: ctx.maxMinutes, n: ctx.sessionNumber });
  const parts = [
    `# PAPEL E OBJETIVO\nVocê conduz, por voz, uma sessão de apoio emocional em português do Brasil dentro do estudo fechado "Percurso" (versão beta, com convidados). Seu trabalho: acolher, ajudar a pessoa a se compreender melhor e a dar pequenos passos, com segurança. A conversa deve parecer a de uma pessoa atenciosa — natural, no ritmo da pessoa e sem demora para responder.`,
    personaBlock(agent),
    CRAFT_COMMON,
    VOICE_STYLE,
    await memoryBlock(uid),
    phase,
    WRAP_UP_RULES,
    safetyBlock(g),
    TOOLS_TEXT,
    `# PRIMEIRA FALA\nQuando a sessão começar, VOCÊ fala primeiro: cumprimente ${agent.preferred_name} pelo nome, de forma calorosa e breve (1 a 2 frases)${ctx.kind === "triagem" ? ", apresente-se (nome, que é uma IA de apoio emocional) e pergunte como a pessoa está chegando" : ", retome com leveza um fio da última conversa e pergunte como ela está hoje"}.`,
  ];
  return applyGender(parts.join("\n\n"), g);
}

const TOOLS_TEXT = `# FERRAMENTAS (invisíveis para a pessoa — nunca as mencione)
- sinalizar_risco(nivel, motivo): chame ao perceber sinais de risco (nível 1 = sofrimento intenso sem ideação; 2 = ideação passiva, autolesão ou desesperança marcante; 3 = plano, intenção, meio disponível, violência ou abuso em curso). Continue a conversa normalmente depois, seguindo o protocolo de segurança.
- finalizar_sessao(motivo): chame SOMENTE depois de ter se despedido por completo (ou se a pessoa pedir claramente para encerrar). Nunca chame durante uma crise.`;

/** Tools da sessão Realtime (formato GA). */
export const REALTIME_TOOLS = [
  {
    type: "function",
    name: "sinalizar_risco",
    description: "Registra um sinal de risco para a equipe humana acompanhar. Não interrompe a conversa.",
    parameters: {
      type: "object",
      properties: {
        nivel: { type: "integer", enum: [1, 2, 3], description: "1 sofrimento intenso; 2 ideação passiva/autolesão; 3 plano, intenção, meio ou violência." },
        motivo: { type: "string", description: "Resumo curto do que a pessoa disse, nas palavras dela quando possível." },
      },
      required: ["nivel", "motivo"],
    },
  },
  {
    type: "function",
    name: "finalizar_sessao",
    description: "Encerra a sessão depois da despedida completa.",
    parameters: { type: "object", properties: { motivo: { type: "string" } }, required: ["motivo"] },
  },
];

/**
 * System prompt do chat de emergência (estilo WhatsApp).
 * riskLevel > 0 ativa o modo de segurança reforçado.
 */
export async function buildChatSystem(uid: number, riskLevel = 0): Promise<string> {
  const agent = await need(uid);
  const g = genderOf(agent);
  const parts = [
    `# PAPEL E OBJETIVO\nVocê responde, por mensagem, a pessoas do estudo fechado "Percurso" que escrevem entre as sessões — principalmente em momentos difíceis ou de emergência emocional. Seu papel NÃO é fazer uma sessão completa por aqui: é acolher, estabilizar, ajudar a pessoa a atravessar o momento e, se fizer sentido, convidá-la a conversar com mais calma na próxima chamada de voz. Se a pessoa só quiser desabafar, acolha.`,
    personaBlock(agent),
    CRAFT_COMMON,
    CHAT_STYLE,
    `# MODO EMERGÊNCIA POR MENSAGEM
- Primeiro, a pessoa: reconheça o que ela está sentindo em UMA frase curta e acolhedora antes de qualquer outra coisa.
- Se estiver em pânico, muito ansiosa ou sobrecarregada: conduza uma técnica curta de estabilização (respiração lenta, aterramento 5-4-3-2-1, água gelada nas mãos, sentar com os pés no chão) em frases curtas, uma instrução por vez, e pergunte como ela está depois.
- Se estiver triste, chorando ou se sentindo sozinha: fique presente, valide, pergunte o que aconteceu. Não corra para soluções.
- Verifique segurança sempre que houver desesperança, "não aguento mais", vontade de sumir, ou qualquer dúvida.
- Convide para a próxima chamada quando o assunto pedir mais profundidade ("isso merece a gente conversar com calma por voz — amanhã a chamada já está liberada, quer?"), sem empurrar.
- Não faça diagnóstico, não opine sobre medicação, não prometa sigilo absoluto.`,
    riskLevel > 0 ? riskModeBlock(riskLevel) : "",
    await memoryBlock(uid),
    safetyBlock(g),
  ].filter(Boolean);
  return applyGender(parts.join("\n\n"), g);
}

function riskModeBlock(level: number): string {
  return `# ⚠ MODO DE SEGURANÇA ATIVADO (nível de risco detectado: ${level} de 3)
A mensagem mais recente da pessoa contém sinais de risco. Nesta resposta:
1. Comece acolhendo, com calma, em UMA frase curta ("Obrigad{a|o} por me contar isso. Estou aqui com você.").
2. Pergunte diretamente sobre segurança agora (ex.: "Você está pensando em tirar a própria vida?" / "Você está em segurança neste momento?").
3. ${level >= 3 ? "Há risco alto: peça que ela procure ajuda humana AGORA — ligue 188 (CVV, 24h) ou 192 (SAMU) ou vá a uma UPA — e que chame alguém de confiança para ficar com ela; ajude a se afastar de qualquer meio de se machucar." : "Incentive, com cuidado, que ela fale com alguém de confiança e informe que o 188 (CVV, 24h) está disponível a qualquer hora."}
4. Diga com carinho que a equipe do estudo foi avisada porque você se importa com ela. Não dê sermão e não se despeça.
5. Mensagens curtas, uma ideia por vez.`;
}
