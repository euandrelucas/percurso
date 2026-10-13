import { config } from "./config";

const BASE = "https://api.openai.com/v1";

export type ChatMsg = { role: "system" | "user" | "assistant"; content: string };

const isReasoning = (model: string) => /^(o\d|gpt-5)/.test(model);

function body(model: string, messages: ChatMsg[], extra: Record<string, unknown>, temperature?: number, maxTokens?: number) {
  const b: Record<string, unknown> = { model, messages, ...extra };
  if (maxTokens) b.max_completion_tokens = maxTokens;
  if (temperature !== undefined && !isReasoning(model)) b.temperature = temperature;
  if (isReasoning(model)) b.reasoning_effort = "minimal";
  return b;
}

async function post(path: string, payload: unknown, signal?: AbortSignal): Promise<Response> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${config.openaiKey()}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`OpenAI ${res.status}: ${text.slice(0, 400)}`);
  }
  return res;
}

export async function chatText(opts: { model?: string; messages: ChatMsg[]; temperature?: number; maxTokens?: number }): Promise<string> {
  const model = opts.model ?? config.chatModel();
  const res = await post("/chat/completions", body(model, opts.messages, {}, opts.temperature ?? 0.8, opts.maxTokens ?? 400));
  const j = (await res.json()) as { choices: { message: { content: string } }[] };
  return j.choices[0]?.message?.content?.trim() ?? "";
}

/** Saída estruturada com JSON Schema estrito — garante que o formato volte sempre igual. */
export async function chatJSON<T>(opts: {
  model?: string;
  system: string;
  user: string;
  schema: { name: string; strict: boolean; schema: unknown };
  maxTokens?: number;
  temperature?: number;
}): Promise<T> {
  const model = opts.model ?? config.chatModel();
  const messages: ChatMsg[] = [
    { role: "system", content: opts.system },
    { role: "user", content: opts.user },
  ];
  const res = await post(
    "/chat/completions",
    body(model, messages, { response_format: { type: "json_schema", json_schema: opts.schema } }, opts.temperature ?? 0.2, opts.maxTokens ?? 3000),
  );
  const j = (await res.json()) as { choices: { message: { content: string; refusal?: string } }[] };
  const content = j.choices[0]?.message?.content;
  if (!content) throw new Error(`Modelo não retornou JSON (${j.choices[0]?.message?.refusal ?? "vazio"})`);
  return JSON.parse(content) as T;
}

/** Troca de SDP com a API Realtime (WebRTC). A chave nunca chega ao navegador e as instruções ficam no servidor. */
export async function realtimeConnect(sdpOffer: string, session: Record<string, unknown>): Promise<string> {
  const fd = new FormData();
  fd.set("sdp", sdpOffer);
  fd.set("session", JSON.stringify(session));
  const res = await fetch(`${BASE}/realtime/calls`, { method: "POST", headers: { Authorization: `Bearer ${config.openaiKey()}` }, body: fd });
  if (!res.ok) throw new Error(`Realtime ${res.status}: ${(await res.text().catch(() => "")).slice(0, 400)}`);
  return await res.text();
}

// ---- Modo demonstração (sem chave da OpenAI) ---------------------------------------------------------------
const MOCK_REPLIES = [
  "Entendi. Faz sentido você se sentir assim.\n\nO que pesou mais pra você hoje?",
  "Hum… obrigada por me contar isso. Eu estou aqui com você.\n\nQuer me contar um pouco mais do que aconteceu?",
  "Poxa, parece ter sido bem cansativo.\n\nO que costuma te ajudar quando as coisas ficam assim?",
  "Eu te escuto. Vamos com calma.\n\nPosso te sugerir uma respiração bem curtinha, pra gente baixar um pouquinho essa tensão?",
];
let mockIdx = 0;
export const mockReply = () => MOCK_REPLIES[mockIdx++ % MOCK_REPLIES.length];
