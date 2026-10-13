import { apiUser } from "@/lib/auth";
import { bad } from "@/lib/api";
import { config } from "@/lib/config";
import { realtimeConnect } from "@/lib/openai";
import { buildVoiceInstructions, REALTIME_TOOLS } from "@/lib/prompts";
import { getAgent, getSession, sessionMessages } from "@/lib/store";
import { secondsLeft } from "@/lib/sessions";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await apiUser("patient");
  if (!user) return bad("Não autenticado", 401);
  const s = getSession(Number((await ctx.params).id));
  if (!s || s.user_id !== user.id || s.status !== "active") return bad("Sessão inválida", 404);
  if (secondsLeft(s) < 20) return bad("O tempo desta sessão acabou.", 409);
  const agent = getAgent(user.id)!;
  const offer = await req.text();
  if (!offer.includes("v=0")) return bad("SDP inválido");

  let instructions = buildVoiceInstructions(user.id, { sessionNumber: s.number, kind: s.kind, maxMinutes: s.max_minutes });

  // Reconexão no meio da sessão: injeta o que já foi dito para a conversa continuar de onde parou.
  const prior = sessionMessages(s.id).filter((m) => m.role !== "system");
  if (prior.length) {
    const tail = prior.slice(-24).map((m) => `${m.role === "assistant" ? agent.agent_name : agent.preferred_name}: ${m.content}`).join("\n");
    instructions += `\n\n# RETOMADA DA SESSÃO\nA conexão caiu e voltou no meio da sessão. NÃO se apresente de novo e NÃO recomece o roteiro. Diga algo breve como "Pronto, voltei — a conexão oscilou. Estávamos falando de…" e continue de onde parou. Restam cerca de ${Math.round(secondsLeft(s) / 60)} minutos. Últimas falas antes da queda:\n${tail}`;
  }

  const speed = agent.pace === "calmo" ? 0.95 : agent.pace === "dinamico" ? 1.05 : 1.0;
  const vad =
    process.env.REALTIME_VAD === "semantic"
      ? { type: "semantic_vad", eagerness: "medium", create_response: true, interrupt_response: true }
      : { type: "server_vad", threshold: 0.5, prefix_padding_ms: 300, silence_duration_ms: 700, create_response: true, interrupt_response: true };

  try {
    const answer = await realtimeConnect(offer, {
      type: "realtime",
      model: config.realtimeModel(),
      instructions,
      output_modalities: ["audio"],
      audio: {
        input: { transcription: { model: "gpt-4o-transcribe", language: "pt" }, noise_reduction: { type: "near_field" }, turn_detection: vad },
        output: { voice: agent.voice, speed },
      },
      tools: REALTIME_TOOLS,
      tool_choice: "auto",
    });
    return new Response(answer, { headers: { "Content-Type": "application/sdp" } });
  } catch (e) {
    console.error("[realtime]", e);
    return bad("Não foi possível iniciar a chamada agora. Tente de novo em instantes.", 502);
  }
}
