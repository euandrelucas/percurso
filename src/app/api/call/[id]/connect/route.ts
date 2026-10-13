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

  // Modo "dois cérebros": a voz só lê o texto que o /brain escreve. Sem resposta automática e sem ferramentas.
  const brain = config.voiceBrain();
  const FALLBACK_VOICE = "alloy";
  const speed = agent.pace === "calmo" ? 0.95 : agent.pace === "dinamico" ? 1.05 : 1.0;
  // Quem desabafa pausa para pensar/respirar: 700 ms de silêncio cortava a pessoa. Padrão 1300 ms (ajustável por REALTIME_SILENCE_MS);
  // REALTIME_VAD=semantic usa detecção por sentido (eagerness REALTIME_EAGERNESS: low|medium|high|auto).
  // Limiar mais alto = menos ruído de fundo/eco virando "fala" (e depois transcrição inventada). REALTIME_VAD_THRESHOLD (0.3–0.9).
  const vadThreshold = Math.min(0.9, Math.max(0.3, Number(process.env.REALTIME_VAD_THRESHOLD) || 0.65));
  const noise = ["near_field", "far_field"].includes(process.env.REALTIME_NOISE ?? "") ? process.env.REALTIME_NOISE : "near_field";
  const silenceMs = Math.min(3000, Math.max(500, Number(process.env.REALTIME_SILENCE_MS) || 1300));
  const eagerness = ["low", "medium", "high", "auto"].includes(process.env.REALTIME_EAGERNESS ?? "") ? process.env.REALTIME_EAGERNESS : "low";
  const vad =
    process.env.REALTIME_VAD === "semantic"
      ? { type: "semantic_vad", eagerness, create_response: !brain, interrupt_response: true }
      : { type: "server_vad", threshold: vadThreshold, prefix_padding_ms: 300, silence_duration_ms: silenceMs, create_response: !brain, interrupt_response: true };

  const sessionFor = (voice: string) => ({
      type: "realtime",
      model: config.realtimeModel(),
      instructions,
      output_modalities: ["audio"],
      audio: {
        input: {
          // O "prompt" ancora a transcrição no contexto (pt-BR, conversa de apoio emocional) e reduz textos inventados em trechos de ruído/silêncio.
          transcription: { model: "gpt-4o-transcribe", language: "pt", prompt: "Conversa em português do Brasil entre uma pessoa e um acompanhante de apoio emocional. Fala natural, com pausas. Transcreva só o que for dito; se não houver fala clara, não escreva nada." },
          noise_reduction: { type: noise },
          turn_detection: vad,
        },
        output: { voice, speed },
      },
      ...(brain ? {} : { tools: REALTIME_TOOLS, tool_choice: "auto" }),
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
