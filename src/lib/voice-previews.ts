import { createHash } from "node:crypto";
import { config } from "./config";
import { prisma } from "./prisma";
import { speechPreview, TTS_MODEL } from "./openai";
import { VOICES } from "./prompts/options";

export const PREVIEW_PHRASE = "Oi, tudo bem? Que bom te conhecer. Pode falar comigo do jeito que for mais fácil pra você. Eu tô aqui pra te ouvir.";
const PHRASE_SHA = createHash("sha256").update(PREVIEW_PHRASE).digest("hex").slice(0, 16);

type Generate = (voice: string, text: string) => Promise<Buffer>;
const inflight = new Map<string, Promise<Buffer>>(); // evita gerar a mesma voz duas vezes em paralelo

async function generateAndStore(voice: string, gen: Generate): Promise<Buffer> {
  let p = inflight.get(voice);
  if (!p) {
    p = gen(voice, PREVIEW_PHRASE)
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

/** Amostra salva no banco: gerada uma única vez (por voz e frase) e servida para todos depois. */
export async function previewFor(voice: string, gen: Generate = speechPreview): Promise<Buffer> {
  const row = await prisma.voicePreview.findUnique({ where: { voice } });
  if (row && row.phrase_sha === PHRASE_SHA) return Buffer.from(row.audio);
  return generateAndStore(voice, gen);
}

/**
 * Na subida do servidor: gera, em sequência, as prévias que ainda não existem (ou cuja frase mudou).
 * Não bloqueia a inicialização e nunca derruba o app: se falhar, a prévia é gerada sob demanda no primeiro uso.
 * Retorna as vozes geradas.
 */
export async function ensureVoicePreviews(gen: Generate = speechPreview): Promise<string[]> {
  const rows = await prisma.voicePreview.findMany({ select: { voice: true, phrase_sha: true } });
  const ok = new Set(rows.filter((r) => r.phrase_sha === PHRASE_SHA).map((r) => r.voice));
  const done: string[] = [];
  for (const v of VOICES) {
    if (ok.has(v.id)) continue;
    try {
      await generateAndStore(v.id, gen);
      done.push(v.id);
    } catch (e) {
      console.warn(`[voice-previews] não gerou "${v.id}": ${String(e).slice(0, 160)}`);
    }
  }
  return done;
}

/** Dispara a geração em segundo plano (só com chave da OpenAI configurada). */
export function warmVoicePreviews() {
  if (config.mock()) return;
  void ensureVoicePreviews()
    .then((done) => done.length && console.log(`[voice-previews] geradas: ${done.join(", ")}`))
    .catch((e) => console.warn("[voice-previews]", e));
}
