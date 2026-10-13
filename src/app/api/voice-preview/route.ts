import { apiUser } from "@/lib/auth";
import { bad, json, rateLimit } from "@/lib/api";
import { config } from "@/lib/config";
import { speechPreview, TTS_MODEL } from "@/lib/openai";
import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { VOICES } from "@/lib/prompts/options";

const PHRASE = "Oi, tudo bem? Que bom te conhecer. Pode falar comigo do jeito que for mais fácil pra você. Eu tô aqui pra te ouvir.";
const PHRASE_SHA = createHash("sha256").update(PHRASE).digest("hex").slice(0, 16);
const inflight = new Map<string, Promise<Buffer>>(); // evita gerar a mesma voz duas vezes em paralelo

/** Amostra salva no banco: gerada uma única vez (por voz e frase) e servida para todos depois. */
async function sampleFor(voice: string): Promise<Buffer> {
  const row = await prisma.voicePreview.findUnique({ where: { voice } });
  if (row && row.phrase_sha === PHRASE_SHA) return Buffer.from(row.audio);
  let p = inflight.get(voice);
  if (!p) {
    p = speechPreview(voice, PHRASE)
      .then(async (audio) => {
        const data = { phrase_sha: PHRASE_SHA, model: TTS_MODEL, audio: new Uint8Array(audio) };
        await prisma.voicePreview.upsert({ where: { voice }, create: { voice, ...data }, update: { ...data, created_at: new Date() } });
        return audio;
      })
      .finally(() => inflight.delete(voice));
    inflight.set(voice, p);
  }
  return p;
}

/** Prévia de voz: GET /api/voice-preview?voice=marin → audio/mpeg (ou {mock:true} sem chave da OpenAI). */
export async function GET(req: Request) {
  const user = await apiUser("patient");
  if (!user) return bad("Não autenticado", 401);
  const voice = new URL(req.url).searchParams.get("voice") ?? "";
  if (!VOICES.some((v) => v.id === voice)) return bad("Voz inválida");
  if (config.mock()) return json({ mock: true, text: PHRASE });
  if (!rateLimit(`voice-preview:${user.id}`, 30, 10 * 60_000)) return bad("Muitas prévias seguidas. Espere um pouco.", 429);
  let audio: Buffer;
  try {
    audio = await sampleFor(voice);
  } catch (e) {
    console.error("[voice-preview]", e);
    return bad("Não foi possível gerar a prévia agora.", 502);
  }
  return new Response(new Uint8Array(audio), { headers: { "Content-Type": "audio/mpeg", "Cache-Control": "private, max-age=86400" } });
}
