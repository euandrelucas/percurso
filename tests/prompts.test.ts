import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { resetDb } from "./helpers";

let uid = 0;
let prisma: Awaited<ReturnType<typeof resetDb>>;
before(async () => {
  prisma = await resetDb();
  const u = await prisma.user.create({ data: { email: "a@b.c", name: "Ana Lima", password_hash: "x", onboarded: true } });
  uid = u.id;
  await prisma.agentSettings.create({
    data: { user_id: uid, preferred_name: "Ana", agent_name: "Leo", voice: "cedar", tone: "franco", style: "pratico", formality: "neutro", humor: "nenhum", pace: "calmo", about_me: "Sou designer", boundaries: "minha família", goal_hint: "dormir melhor" },
  });
});
after(() => prisma.$disconnect());

test("voz: monta persona, memória, roteiro e segurança (triagem)", async () => {
  const { buildVoiceInstructions } = await import("../src/lib/prompts");
  const p = await buildVoiceInstructions(uid, { sessionNumber: 1, kind: "triagem", maxMinutes: 60 });
  assert.match(p, /Você é Leo/);
  assert.match(p, /masculino/); // voz cedar
  assert.match(p, /franco e gentil/i);
  assert.match(p, /LIMITES DEFINIDOS PELO PACIENTE[\s\S]*minha família/);
  assert.match(p, /PRIMEIRA SESSÃO — TRIAGEM/);
  assert.match(p, /188/);
  assert.match(p, /sinalizar_risco/);
  assert.match(p, /primeira conversa: você ainda não sabe nada/);
  assert.doesNotMatch(p, /\{[a-z]\|[a-z]\}/, "marcadores de gênero não resolvidos");
  assert.doesNotMatch(p, /\{\{\w+\}\}/, "placeholders não preenchidos");
});

test("voz: acompanhamento usa memória cifrada e resumo da sessão anterior", async () => {
  const { saveAnalysis, saveMemory } = await import("../src/lib/store");
  const { EMPTY_MEMORY } = await import("../src/lib/types");
  await saveMemory(uid, { ...EMPTY_MEMORY, queixa_principal: "Ansiedade no trabalho", temas_recorrentes: ["prazo de entrega"] });
  const s = await prisma.therapySession.create({ data: { user_id: uid, number: 1, kind: "triagem", status: "ended", max_minutes: 60, duration_sec: 3000 } });
  await saveAnalysis(s.id, { resumo: "Falou da pressão do chefe.", pontos_para_proxima_sessao: ["conversa com o chefe na quinta"], abertura_sugerida: "Como foi a conversa com seu chefe?", humor_estimado_fim: 6, humor_estimado_inicio: null } as never);
  await prisma.exercise.create({ data: { user_id: uid, title: "Respiração", description: "Respire 3 min por dia" } });
  const raw = await prisma.$queryRaw<{ data: string }[]>`SELECT data FROM case_memory WHERE user_id = ${uid}`;
  assert.match(raw[0].data, /^enc:v1:/, "memória deve estar cifrada no banco");
  const { buildVoiceInstructions } = await import("../src/lib/prompts");
  const p = await buildVoiceInstructions(uid, { sessionNumber: 2, kind: "acompanhamento", maxMinutes: 60 });
  assert.match(p, /SESSÃO NÚMERO 2/);
  assert.match(p, /Ansiedade no trabalho/);
  assert.match(p, /Falou da pressão do chefe/);
  assert.match(p, /conversa com o chefe na quinta/);
  assert.match(p, /Respiração/);
  assert.doesNotMatch(p, /primeira conversa: você ainda não sabe/);
});

test("questionário de segurança positivo aparece no contexto da IA", async () => {
  await prisma.screening.create({ data: { user_id: uid, kind: "seguranca", answers: [1], score: 1, flagged: true } });
  const { buildChatSystem } = await import("../src/lib/prompts");
  assert.match(await buildChatSystem(uid, 0), /pensado em se machucar/);
});

test("voz inclui o conhecimento de base e módulos temáticos do caso", async () => {
  const { buildVoiceInstructions } = await import("../src/lib/prompts");
  const p = await buildVoiceInstructions(uid, { sessionNumber: 3, kind: "acompanhamento", maxMinutes: 60 });
  assert.match(p, /CONHECIMENTO CLÍNICO DE BASE/);
  assert.match(p, /Aliança terapêutica/);
  assert.match(p, /CONHECIMENTO CLÍNICO PARA ESTE ASSUNTO/, "o caso fala de ansiedade/trabalho: deve trazer módulos temáticos");
  assert.match(p, /PRIMEIROS SOCORROS EMOCIONAIS/);
});

test("chat injeta conhecimento pelo assunto da mensagem", async () => {
  const { buildChatSystem } = await import("../src/lib/prompts");
  const p = await buildChatSystem(uid, 0, "minha mãe faleceu ontem e não sei o que fazer");
  assert.match(p, /Luto e perdas/);
  assert.doesNotMatch(await buildChatSystem(uid, 0, "oi"), /CONHECIMENTO CLÍNICO PARA ESTE ASSUNTO[\s\S]*Luto e perdas/);
});

test("chat: modo de segurança só aparece quando há risco", async () => {
  const { buildChatSystem } = await import("../src/lib/prompts");
  assert.doesNotMatch(await buildChatSystem(uid, 0), /MODO DE SEGURANÇA|MODO DE ATENÇÃO/);
  const high = await buildChatSystem(uid, 3);
  assert.match(high, /MODO DE SEGURANÇA/);
  assert.match(high, /EMERGÊNCIA/);
  assert.match(high, /afastar/i);
  assert.match(high, /192/);
  assert.match(high, /Seja honest/i);
  const mid = await buildChatSystem(uid, 2);
  assert.match(mid, /nível 2 de 3/);
  assert.match(mid, /mini plano de segurança/i);
  assert.match(await buildChatSystem(uid, 1), /MODO DE ATENÇÃO/);
});

test("avisos de tempo escalam conforme o relógio", async () => {
  const { timeCue } = await import("../src/lib/prompts/phases");
  assert.match(timeCue(10, "acompanhamento"), /síntese/);
  assert.match(timeCue(5, "acompanhamento"), /fechamento/);
  assert.match(timeCue(1, "acompanhamento"), /finalizar_sessao/);
  assert.match(timeCue(9, "triagem"), /segurança/);
});
