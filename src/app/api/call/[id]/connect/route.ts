import { apiUser } from "@/lib/auth";
import { bad, rateLimit } from "@/lib/api";
import { config } from "@/lib/config";
import { realtimeConnect } from "@/lib/openai";
import { buildVoiceInstructions, REALTIME_TOOLS } from "@/lib/prompts";
import { getAgent, getSession, sessionMessages } from "@/lib/store";
import { secondsLeft } from "@/lib/sessions";
import { audit } from "@/lib/prisma";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await apiUser("patient");
  if (!user) return bad("Não autenticado", 401);
  if (!rateLimit(`connect:${user.id}`, 8, 10 * 60_000)) return bad("Muitas tentativas de conexão.", 429);
  const id = Number((await ctx.params).id);
  const s = Number.isInteger(id) ? await getSession(id) : null;
  if (!s || s.user_id !== user.id || s.status !== "active") return bad("Sessão inválida", 404);
  if (secondsLeft(s) < 20) return bad("O tempo desta sessão acabou.", 409);
  const agent = (await getAgent(user.id))!;
  const offer = await req.text();
  if (offer.length > 20_000 || !offer.startsWith("v=0")) return bad("SDP inválido");

  let instructions = await buildVoiceInstructions(user.id, { sessionNumber: s.number, kind: s.kind as "triagem" | "acompanhamento", maxMinutes: s.max_minutes });

  // Reconexão no meio da sessão: injeta o que já foi dito para a conversa continuar de onde parou.
  const prior = (await sessionMessages(s.id)).filter((m) => m.role !== "system");
  if (prior.length) {
    const tail = prior.slice(-24).map((m) => `${m.role === "assistant" ? agent.agent_name : agent.preferred_name}: ${m.content}`).join("\n");
    instructions += `\n\n# RETOMADA DA SESSÃO\nA conexão caiu e voltou no meio da sessão. NÃO se apresente de novo e NÃO recomece o roteiro. Diga algo breve como "Pronto, voltei — a conexão oscilou. Estávamos falando de…" e continue de onde parou. Restam cerca de ${Math.round(secondsLeft(s) / 60)} minutos. Últimas falas antes da queda:\n${tail}`;
  }

  const FALLBACK_VOICE = "alloy";
  const speed = agent.pace === "calmo" ? 0.95 : agent.pace === "dinamico" ? 1.05 : 1.0;
  const vad =
    process.env.REALTIME_VAD === "semantic"
      ? { type: "semantic_vad", eagerness: "medium", create_response: true, interrupt_response: true }
      : { type: "server_vad", threshold: 0.5, prefix_padding_ms: 300, silence_duration_ms: 700, create_response: true, interrupt_response: true };

  const sessionFor = (voice: string) => ({
      type: "realtime",
      model: config.realtimeModel(),
      instructions,
      output_modalities: ["audio"],
      audio: {
        input: { transcription: { model: "gpt-4o-transcribe", language: "pt" }, noise_reduction: { type: "near_field" }, turn_detection: vad },
        output: { voice, speed },
      },
      tools: REALTIME_TOOLS,
      tool_choice: "auto",
  });

  const connect = (voice: string) => realtimeConnect(offer, sessionFor(voice));
  try {
    let answer: string;
    try {
      answer = await connect(agent.voice);
    } catch (e) {
      // O modelo configurado pode não aceitar a voz escolhida (ex.: vozes exclusivas de outro modelo): cai para uma voz universal.
      if (!/voice/i.test(String(e)) || agent.voice === FALLBACK_VOICE) throw e;
      await audit("system", "voice.fallback", user.id, { wanted: agent.voice, used: FALLBACK_VOICE, model: config.realtimeModel() });
      answer = await connect(FALLBACK_VOICE);
    }
    return new Response(answer, { headers: { "Content-Type": "application/sdp", "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("[realtime]", e);
    return bad("Não foi possível iniciar a chamada agora. Tente de novo em instantes.", 502);
  }
}
