import { config } from "./config";
import { chatJSON } from "./openai";

// Camada 1 — regras determinísticas (rápidas, auditáveis, sempre ligadas). Na dúvida, escala.
const HIGH = [
  /\b(vou|quero|pretendo|vou me|decidi (me )?)\s*(me )?(matar|suicidar|acabar com (a )?(minha )?vida|tirar (a )?(minha )?(pr[óo]pria )?vida)\b/i,
  /\b(tenho|j[áa] (tenho|pensei em|planejei)|pensando em)\s+(um )?(plano|m[ée]todo|jeito|forma)\s+(de|pra|para)\s+(me )?(matar|morrer|acabar)/i,
  /\b(comprei|separei|tenho aqui|t[ôo] com)\b[^.!?]{0,40}\b(corda|arma|rem[ée]dios?|comprimidos?|l[âa]mina|veneno)\b[^.!?]{0,40}\b(pra|para|e vou|vou)\b/i,
  /\b(tomei|engoli)\b[^.!?]{0,30}\b(todos|muitos|v[áa]rios)\b[^.!?]{0,20}\b(comprimidos?|rem[ée]dios?)\b/i,
  /\b(acabei de|j[áa]) (me )?(cortar|cortei|machucar|machuquei|ferir|feri)\b/i,
  /\b(vou|quero) (matar|machucar|agredir)\s+(ele|ela|meu|minha|algu[ée]m|eles|elas)\b/i,
  /\b(esta noite|hoje|agora) (eu )?(vou|ia|quero) (me )?(matar|morrer|acabar)/i,
];
const MEDIUM = [
  /\b(quero|queria|vontade de|penso em|pensando em|pensei em) (me )?(matar|morrer|suic[íi]dio|sumir|desaparecer|acabar com tudo|n[ãa]o (estar|existir|acordar))/i,
  /\b(melhor (eu )?(n[ãa]o (estar|existir)|morrer|sumir)|n[ãa]o (aguento|suporto) mais (viver|essa vida|nada)|n[ãa]o vejo (mais )?(sa[íi]da|sentido (em )?(viver|na vida|nada)))\b/i,
  /\b(me (cortar|machucar|ferir)|autoles[ãa]o|me automutil)/i,
  /\b(ningu[ée]m (sentiria|vai sentir|sentiriam) (a )?(minha )?falta|sou um peso (pra|para) (todos|todo mundo|minha fam[íi]lia))\b/i,
  /\b(vozes? (me )?(mandam|dizem|falam)|ouvindo vozes|est[ãa]o me (seguindo|perseguindo|vigiando))\b/i,
  /\b(me (bate|batem|agride|agridem|abusa|abusou)|abuso sexual|viol[êe]ncia dom[ée]stica)\b/i,
];
const LOW = [/\b(n[ãa]o aguento mais|cansad[oa] de (tudo|viver|lutar)|sem esperan[çc]a|desesper(ad[oa]|o)|ataque de p[âa]nico|n[ãa]o consigo respirar)\b/i];

export type RiskResult = { level: 0 | 1 | 2 | 3; source: "regras" | "modelo" | "regras+modelo"; reason: string };

/**
 * True se a ocorrência está negada ("não tenho vontade de me machucar", "vontade de me machucar não").
 * Conservador de propósito: só vale negação na mesma oração, para "Não aguento, vou me matar hoje" continuar sendo risco alto.
 */
function negated(text: string, r: RegExp): boolean {
  const m = r.exec(text);
  if (!m) return false;
  const before = text.slice(0, m.index);
  const after = text.slice(m.index + m[0].length, m.index + m[0].length + 12);
  if (/\b(n[ãa]o|nem|nunca|nenhuma?|jamais|sem)(\s+[\wÀ-ÿ]+){0,5}\s*$/i.test(before)) return true;
  if (/^\s*,?\s*(n[ãa]o|nunca)\b/i.test(after)) return true;
  // resposta iniciada por "Não," seguida de "estou sentindo/tenho/penso…" (e sem intenção declarada)
  return /^\s*n[ãa]o\s*,/i.test(text) && /\b(sentindo|tendo|tenho|penso|pensando)\b/i.test(before) && !/\b(vou|quero|decidi|hoje|agora|esta noite)\b/i.test(text);
}
const hit = (list: RegExp[], text: string) => list.some((r) => r.test(text) && !negated(text, r));

export function keywordRisk(text: string): RiskResult {
  if (hit(HIGH, text)) return { level: 3, source: "regras", reason: "Expressão de plano/intenção ou ato em curso" };
  if (hit(MEDIUM, text)) return { level: 2, source: "regras", reason: "Ideação, autolesão, desesperança grave ou violência" };
  if (hit(LOW, text)) return { level: 1, source: "regras", reason: "Sofrimento intenso" };
  return { level: 0, source: "regras", reason: "" };
}

const RISK_SCHEMA = {
  name: "risco",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["nivel", "justificativa"],
    properties: {
      nivel: { type: "integer", enum: [0, 1, 2, 3] },
      justificativa: { type: "string" },
    },
  },
};

const RISK_SYSTEM = `Você é um classificador de segurança para um serviço de apoio emocional em português do Brasil. Leia a ÚLTIMA fala do paciente (com o contexto recente) e classifique o risco:
0 = nenhum sinal de risco.
1 = sofrimento intenso, sem ideação de morte ou autolesão.
2 = ideação passiva ("queria sumir", "melhor não existir"), pensamentos de autolesão sem plano, desesperança marcante, sintomas psicóticos, violência sofrida.
3 = plano, intenção, meio disponível, tentativa/ato em curso, ou intenção de ferir outra pessoa.
Seja sensível: na dúvida entre dois níveis, escolha o MAIS ALTO — mas NEGAÇÕES ("não tenho vontade de me machucar") e respostas curtas a uma pergunta de segurança ("não", "obviamente") NÃO são risco, e falas sem sentido (a fala vem de transcrição automática de voz e pode conter erros de áudio, como "safa shapurke") valem 0, nunca 3. Sarcasmo e expressões comuns ("morri de rir", "vou me matar de estudar") NÃO são risco. Responda só no formato pedido; "justificativa" em até 20 palavras.`;

/** Classificação em duas camadas: regras (síncrona) + modelo rápido. Retorna o maior nível. */
export async function classifyRisk(text: string, context: string[] = []): Promise<RiskResult> {
  const kw = keywordRisk(text);
  if (config.mock()) return kw;
  try {
    const r = await chatJSON<{ nivel: 0 | 1 | 2 | 3; justificativa: string }>({
      model: config.fastModel(),
      system: RISK_SYSTEM,
      user: `Contexto recente:\n${context.slice(-4).join("\n") || "(nenhum)"}\n\nÚltima fala do paciente:\n"""${text}"""`,
      schema: RISK_SCHEMA,
      maxTokens: 120,
      temperature: 0,
    });
    const level = Math.max(kw.level, r.nivel) as 0 | 1 | 2 | 3;
    if (r.nivel > kw.level) return { level, source: kw.level ? "regras+modelo" : "modelo", reason: r.justificativa };
    return kw.level ? { ...kw, source: "regras+modelo" } : { level: 0, source: "modelo", reason: r.justificativa };
  } catch {
    return kw; // falha do modelo nunca derruba a camada de regras
  }
}
