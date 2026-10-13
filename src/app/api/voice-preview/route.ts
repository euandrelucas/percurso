import { apiUser } from "@/lib/auth";
import { bad, json, rateLimit } from "@/lib/api";
import { config } from "@/lib/config";
import { speechPreview } from "@/lib/openai";
import { VOICES } from "@/lib/prompts/options";

const PHRASE = "Oi, tudo bem? Que bom te conhecer. Pode falar comigo do jeito que for mais fácil pra você. Eu tô aqui pra te ouvir.";
const cache = new Map<string, Buffer>(); // 6 vozes x ~80 KB: cabe com folga na memória

/** Prévia de voz: GET /api/voice-preview?voice=marin → audio/mpeg (ou {mock:true} sem chave da OpenAI). */
export async function GET(req: Request) {
  const user = await apiUser("patient");
  if (!user) return bad("Não autenticado", 401);
  const voice = new URL(req.url).searchParams.get("voice") ?? "";
  if (!VOICES.some((v) => v.id === voice)) return bad("Voz inválida");
  if (config.mock()) return json({ mock: true, text: PHRASE });
  let audio = cache.get(voice);
  if (!audio) {
    if (!rateLimit(`voice-preview:${user.id}`, 20, 10 * 60_000)) return bad("Muitas prévias seguidas. Espere um pouco.", 429);
    try {
      audio = await speechPreview(voice, PHRASE);
      cache.set(voice, audio);
    } catch (e) {
      console.error("[voice-preview]", e);
      return bad("Não foi possível gerar a prévia agora.", 502);
    }
  }
  return new Response(new Uint8Array(audio), { headers: { "Content-Type": "audio/mpeg", "Cache-Control": "private, max-age=86400" } });
}
