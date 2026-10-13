import { PROMPT_VERSION } from "../config";
import { CRAFT_COMMON, CHAT_STYLE, VOICE_STYLE } from "./craft";
import { memoryBlock } from "./memory";
import { genderOf, personaBlock } from "./persona";
import { fillPhase, PHASE_FOLLOWUP, PHASE_TRIAGEM, WRAP_UP_RULES } from "./phases";
import { applyGender, safetyBlock } from "./safety";
import { getAgent, getMemory } from "../store";
import { coreKnowledgeBlock, selectModules, topicalKnowledgeBlock } from "../knowledge";
import type { Agent } from "../types";

export { PROMPT_VERSION };

async function need(uid: number): Promise<Agent> {
  const a = await getAgent(uid);
  if (!a) throw new Error("Agente não configurado para este usuário");
  return a;
}

/** Módulos temáticos escolhidos pelos temas do caso (memória) e pelo que o paciente disse querer trabalhar. */
async function topicalForCase(uid: number, agent: Agent) {
  const m = await getMemory(uid);
  const text = [m.queixa_principal, m.contexto_de_vida, m.historico_relevante, ...m.temas_recorrentes, ...m.padroes, agent.topics, agent.goal_hint, agent.about_me].join(" . ");
  return selectModules(text, { max: 4 });
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
    coreKnowledgeBlock(),
    topicalKnowledgeBlock(await topicalForCase(uid, agent)),
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
export async function buildChatSystem(uid: number, riskLevel = 0, userText = ""): Promise<string> {
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
    coreKnowledgeBlock(),
    topicalKnowledgeBlock(selectModules(`${userText} . ${agent.topics}`, { max: 3 })),
    await memoryBlock(uid),
    safetyBlock(g),
  ].filter(Boolean);
  return applyGender(parts.join("\n\n"), g);
}

function riskModeBlock(level: number): string {
  const common = `Regras deste modo: mensagens CURTAS (1–3 frases), UM passo ou UMA pergunta por mensagem, tom calmo e caloroso, sem listas e sem sermão. Você FICA na conversa: nunca se despeça nem passe só um número de telefone. Siga o bloco "PRIMEIROS SOCORROS EMOCIONAIS" abaixo. O cartão com os telefones aparece para a pessoa automaticamente — não precisa repeti-lo inteiro; cite 188/192 de forma natural quando fizer sentido.`;
  if (level >= 3) {
    return `# ⚠ MODO DE SEGURANÇA — EMERGÊNCIA (nível ${level} de 3)
A mensagem mais recente indica risco ALTO (plano, intenção, meio à mão, data/momento ou ato em curso). ${common}
Faça nesta ordem, um passo por mensagem:
1. Presença e foco: "Obrigad{a|o} por me contar. Estou aqui com você. Quero que você fique em segurança agora."
2. Meio: "Isso que você pensa em usar está perto de você agora? Consegue se afastar dele, sair desse cômodo ou pedir para alguém guardar longe?"
3. Companhia: "Tem alguém que possa ficar com você agora? Pode ligar ou chamar essa pessoa enquanto eu continuo aqui?"
4. Ajuda de emergência: pedir para ligar 192 (SAMU) ou ir à UPA/pronto-socorro, ou que a pessoa ao lado ligue; ofereça ficar na conversa enquanto isso. Seja honest{a|o}: você não consegue chamar socorro sozinh{a|o}.
5. Se ela resistir: valide, não discuta, negocie adiar ("só até a gente conversar mais dez minutos / até amanhã de manhã"), use respiração lenta e aterramento, e continue presente.
Avise com carinho que a equipe do estudo foi notificada porque ela importa.`;
  }
  if (level === 2) {
    return `# ⚠ MODO DE SEGURANÇA (nível ${level} de 3)
A mensagem mais recente contém sinais de risco (ideação, autolesão, desesperança grave ou violência). ${common}
Faça, um passo por mensagem: (1) acolher em uma frase; (2) perguntar diretamente: "Você está pensando em tirar a própria vida?" (ou na palavra que ela usou); (3) se sim, avaliar: há plano? há meio por perto? alguma data/momento? já tentou antes? bebeu/usou algo? tem alguém por perto?; (4) se NÃO houver plano/meio/intenção: construir junto um mini plano de segurança (sinais de alerta → o que fazer sozinha para se acalmar → pessoas/lugares que distraem → quem pode ajudar, com nome → CVV 188 e serviços → deixar o ambiente seguro); (5) se houver plano, meio ou intenção: tratar como EMERGÊNCIA (afastar do meio, não ficar só, 192/UPA, alguém por perto). Combine o próximo contato e diga que a equipe foi avisada.`;
  }
  return `# MODO DE ATENÇÃO (nível ${level} de 3)
A pessoa está em sofrimento intenso. ${common}
Acolha, estabilize (respiração lenta, aterramento) e pergunte, com delicadeza, se há pensamentos de se machucar ou de que seria melhor não estar aqui. Se aparecerem, passe a tratar como risco e siga os passos de segurança.`;
}

/** Lembrete injetado na chamada quando o sistema detecta risco numa fala (a IA já tem o protocolo completo nas instruções). */
export function voiceRiskCue(level: number): string {
  const base = "[Alerta do sistema — NÃO leia em voz alta] O sistema detectou sinais de risco na fala do paciente (nível " + level + " de 3). ";
  return level >= 3
    ? base + "Trate como EMERGÊNCIA: fique com a pessoa, pergunte se o meio está por perto e peça que se afaste dele, que chame alguém para ficar junto e que ligue 192 (ou peça a alguém para ligar), oferecendo ficar na linha. Uma instrução por vez, sem sermão, sem encerrar. Chame sinalizar_risco."
    : base + "Pergunte de forma direta e calorosa sobre pensamentos de se matar e sobre plano/meio/data; se não houver plano, construa junto o plano de segurança, um item por vez; se houver, trate como emergência. Chame sinalizar_risco e avise com cuidado que a equipe será notificada.";
}
