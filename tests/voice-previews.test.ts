import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { resetDb } from "./helpers";

let prisma: Awaited<ReturnType<typeof resetDb>>;
before(async () => {
  prisma = await resetDb();
  await prisma.voicePreview.deleteMany();
});
after(async () => {
  await prisma.voicePreview.deleteMany();
  await prisma.$disconnect();
});

test("gera só as prévias que faltam e reaproveita as salvas no banco", async () => {
  const { ensureVoicePreviews, previewFor } = await import("../src/lib/voice-previews");
  const { VOICES } = await import("../src/lib/prompts/options");
  const calls: string[] = [];
  const gen = async (voice: string) => (calls.push(voice), Buffer.from(`mp3-${voice}`));

  assert.equal((await ensureVoicePreviews(gen)).length, VOICES.length);
  assert.equal(calls.length, VOICES.length);
  assert.equal((await prisma.voicePreview.count()), VOICES.length);

  // segunda subida: nada novo para gerar
  assert.deepEqual(await ensureVoicePreviews(gen), []);
  assert.equal(calls.length, VOICES.length);

  // previewFor lê do banco, sem chamar o gerador
  assert.equal((await previewFor("marin", gen)).toString(), "mp3-marin");
  assert.equal(calls.length, VOICES.length);

  // se faltar uma voz, só ela é gerada
  await prisma.voicePreview.delete({ where: { voice: "cedar" } });
  assert.deepEqual(await ensureVoicePreviews(gen), ["cedar"]);

  // frase mudou (hash diferente) => regera
  await prisma.voicePreview.update({ where: { voice: "ash" }, data: { phrase_sha: "antigo" } });
  assert.deepEqual(await ensureVoicePreviews(gen), ["ash"]);
});

test("falha ao gerar uma voz não derruba as outras", async () => {
  const { ensureVoicePreviews } = await import("../src/lib/voice-previews");
  await prisma.voicePreview.deleteMany();
  const gen = async (voice: string) => {
    if (voice === "sage") throw new Error("OpenAI 500");
    return Buffer.from("x");
  };
  const done = await ensureVoicePreviews(gen);
  assert.ok(!done.includes("sage") && done.includes("marin"));
});
