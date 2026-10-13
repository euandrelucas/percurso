import { config } from "./config";
import { chatJSON, type ChatMsg } from "./openai";
import { brainInstruction, buildBrainSystem, type BrainInput } from "./prompts";
import { checkReply, correctionInstruction, sanitizeReply } from "./guardrails";
import { classifyRisk, keywordRisk, type RiskResult } from "./risk";
import { secondsLeft } from "./sessions";
import { addMessage, getAgent, raiseAlert, sessionMessages } from "./store";
import type { Session } from "./types";

/**
 * "Cérebro" da chamada de voz: um modelo de texto forte escreve cada fala (com persona, memória, conhecimento clínico e
 * protocolo de segurança) e a voz em tempo real apenas a LÊ. Motivo: modelos de voz baratos seguem mal instruções longas.
 */
export type BrainReply = { reply: string; end: boolean; risk: number; crisis: boolean };
type Out = { fala: string; encerrar_sessao: boolean; risco: number };

const SCHEMA = {
  name: "fala_acompanhante",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["fala", "encerrar_sessao", "risco"],
    properties: { fala: { type: "string" }, encerrar_sessao: { type: "boolean" }, risco: { type: "integer", enum: [0, 1, 2, 3] } },
  },
};

type Deps = {
  llm?: (messages: ChatMsg[]) => Promise<Out>;
  classify?: (text: string, ctx: string[]) => Promise<RiskResult>;
};

const withTimeout = <T>(p: Promise<T>, ms: number) => Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error("brain timeout")), ms))]);

const defaultLlm = (messages: ChatMsg[]) =>
  withTimeout(
    chatJSON<Out>({ model: config.brainModel(), system: messages[0].content, user: "", schema: SCHEMA, maxTokens: 450, temperature: 0.7, messages: messages.slice(1) }),
    9000,
  );

const WANTS_END = /\b(encerrar|terminar (a )?(conversa|sess[ãa]o)|parar por aqui|preciso ir|tenho que ir|at[ée] (mais|logo|amanh[ãa]|a pr[óo]xima)|tchau)\b/i;

export async function brainTurn(s: Session, input: BrainInput, deps: Deps = {}): Promise<BrainReply> {
  const llm = deps.llm ?? defaultLlm;
  const classify = deps.classify ?? classifyRisk;
  const agent = (await getAgent(s.user_id))!;
  const kind = s.kind as "triagem" | "acompanhamento";
  const text = (input.text ?? "").trim();

  if (input.kind === "turn") {
    if (!text) throw new Error("fala vazia");
    await addMessage(s.user_id, s.id, "voice", "user", text);
  }
  const history = (await sessionMessages(s.id)).filter((m) => m.role !== "system");
  const resumed = input.kind === "open" && history.length > 0;
  const recentUser = history.filter((m) => m.role === "user").slice(-3).map((m) => m.content).join(" . ");
  const ctxLines = history.slice(-5, -1).map((m) => `${m.role === "assistant" ? "IA" : "PACIENTE"}: ${m.content}`);

  const kw = input.kind === "turn" ? keywordRisk(text) : { level: 0 as const, source: "regras" as const, reason: "" };
  const riskP: Promise<RiskResult> = input.kind === "turn" ? classify(text, ctxLines).catch(() => kw) : Promise.resolve(kw);

  const left = secondsLeft(s);
  const run = async (riskLevel: number, extra?: string): Promise<Out> => {
    const system = await buildBrainSystem(s.user_id, { sessionNumber: s.number, kind, maxMinutes: s.max_minutes, secondsLeft: left, riskLevel, recentUserText: recentUser });
    const msgs: ChatMsg[] = [{ role: "system", content: system }, ...history.slice(-40).map((m) => ({ role: m.role === "assistant" ? ("assistant" as const) : ("user" as const), content: m.content }))];
    const ins = brainInstruction(agent, kind, input, resumed);
    if (ins) msgs.push({ role: "system", content: ins });
    if (extra) msgs.push({ role: "system", content: extra });
    return llm(msgs);
  };

  let out = await run(kw.level);
  const cls = await riskP;
  let risk = Math.max(kw.level, cls.level, out.risco);
  // O classificador achou mais risco do que o cérebro considerou ao escrever: reescreve já com o protocolo reforçado.
  if (risk >= 2 && Math.max(kw.level, out.risco) < risk) out = await run(risk);

  let reply = sanitizeReply(out.fala);
  let v = checkReply(reply, { riskLevel: risk });
  if (v.length) {
    const retry = await run(risk, correctionInstruction(v)).catch(() => null);
    const fixed = retry ? sanitizeReply(retry.fala) : "";
    if (fixed && checkReply(fixed, { riskLevel: risk }).length <= v.length) {
      reply = fixed;
      out = retry!;
    }
  }
  if (!reply) throw new Error("resposta vazia");
  risk = Math.max(risk, out.risco);

  if (risk >= 2) await raiseAlert(s.user_id, risk, `voz:${s.id}`, `${text.slice(0, 300) || "(sem fala nova)"} [${cls.level >= out.risco ? cls.source : "modelo"}: ${cls.reason || "sinal de risco"}]`);
  else if (risk === 1 && input.kind === "turn") await raiseAlert(s.user_id, 1, `voz:${s.id}`, `${text.slice(0, 300)} [modelo]`);

  await addMessage(s.user_id, s.id, "voice", "assistant", reply);

  // Só encerra se o tempo está no fim ou a pessoa pediu; nunca em crise.
  const end = out.encerrar_sessao && risk < 2 && (left <= 6 * 60 || WANTS_END.test(text));
  return { reply, end, risk, crisis: risk >= 2 };
}
