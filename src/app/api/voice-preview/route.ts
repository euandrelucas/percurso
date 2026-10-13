import { apiUser } from "@/lib/auth";
import { bad, json, rateLimit } from "@/lib/api";
import { config } from "@/lib/config";
import { VOICES } from "@/lib/prompts/options";
import { PREVIEW_PHRASE, previewFor } from "@/lib/voice-previews";

/** Prévia de voz: GET /api/voice-preview?voice=marin → audio/mpeg do banco (ou {mock:true} sem chave da OpenAI). */
export async function GET(req: Request) {
  const user = await apiUser("patient");
  if (!user) return bad("Não autenticado", 401);
  const voice = new URL(req.url).searchParams.get("voice") ?? "";
  if (!VOICES.some((v) => v.id === voice)) return bad("Voz inválida");
  if (config.mock()) return json({ mock: true, text: PREVIEW_PHRASE });
  if (!rateLimit(`voice-preview:${user.id}`, 30, 10 * 60_000)) return bad("Muitas prévias seguidas. Espere um pouco.", 429);
  let audio: Buffer;
  try {
    audio = await previewFor(voice);
  } catch (e) {
    console.error("[voice-preview]", e);
    return bad("Não foi possível gerar a prévia agora.", 502);
  }
  return new Response(new Uint8Array(audio), { headers: { "Content-Type": "audio/mpeg", "Cache-Control": "private, max-age=86400" } });
}
