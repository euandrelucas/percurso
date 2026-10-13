import { test, before } from "node:test";
import assert from "node:assert/strict";
import { useTempDb } from "./helpers";

useTempDb();

let uid = 0;
before(async () => {
  const { run } = await import("../src/lib/db");
  uid = run("INSERT INTO users (email, name, password_hash, onboarded) VALUES ('a@b.c', 'Ana Lima', 'x', 1)").id;
  run(
    `INSERT INTO agent_settings (user_id, preferred_name, agent_name, voice, tone, style, formality, humor, pace, about_me, boundaries, goal_hint)
     VALUES (?, 'Ana', 'Leo', 'cedar', 'franco', 'pratico', 'neutro', 'nenhum', 'calmo', 'Sou designer', 'minha família', 'dormir melhor')`,
    uid,
  );
});

test("voz: monta persona, memória, roteiro e segurança (triagem)", async () => {
  const { buildVoiceInstructions } = await import("../src/lib/prompts");
  const p = buildVoiceInstructions(uid, { sessionNumber: 1, kind: "triagem", maxMinutes: 60 });
  assert.match(p, /Você é Leo/);
  assert.match(p, /masculino/); // voz cedar
  assert.match(p, /Ana/);
  assert.match(p, /franco e gentil/i);
  assert.match(p, /LIMITES DEFINIDOS PELO PACIENTE[\s\S]*minha família/);
  assert.match(p, /PRIMEIRA SESSÃO — TRIAGEM/);
  assert.match(p, /188/);
  assert.match(p, /sinalizar_risco/);
  assert.match(p, /primeira conversa: você ainda não sabe nada/);
  assert.doesNotMatch(p, /\{[a-z]\|[a-z]\}/, "marcadores de gênero não resolvidos");
  assert.doesNotMatch(p, /\{\{\w+\}\}/, "placeholders não preenchidos");
});

test("voz: acompanhamento usa memória e resumo da sessão anterior", async () => {
  const { run } = await import("../src/lib/db");
  const { saveMemory } = await import("../src/lib/store");
  const { EMPTY_MEMORY } = await import("../src/lib/types");
  saveMemory(uid, { ...EMPTY_MEMORY, queixa_principal: "Ansiedade no trabalho", temas_recorrentes: ["prazo de entrega"] });
  const analysis = { resumo: "Falou da pressão do chefe.", pontos_para_proxima_sessao: ["conversa com o chefe na quinta"], abertura_sugerida: "Como foi a conversa com seu chefe?", humor_estimado_fim: 6 };
  run("INSERT INTO sessions (user_id, number, kind, status, max_minutes, duration_sec, analysis) VALUES (?, 1, 'triagem', 'ended', 60, 3000, ?)", uid, JSON.stringify(analysis));
  run("INSERT INTO exercises (user_id, title, description) VALUES (?, 'Respiração', 'Respire 3 min por dia')", uid);
  const { buildVoiceInstructions } = await import("../src/lib/prompts");
  const p = buildVoiceInstructions(uid, { sessionNumber: 2, kind: "acompanhamento", maxMinutes: 60 });
  assert.match(p, /SESSÃO NÚMERO 2/);
  assert.match(p, /Ansiedade no trabalho/);
  assert.match(p, /Falou da pressão do chefe/);
  assert.match(p, /conversa com o chefe na quinta/);
  assert.match(p, /Respiração/);
  assert.doesNotMatch(p, /primeira conversa: você ainda não sabe/);
});

test("chat: modo de segurança só aparece quando há risco", async () => {
  const { buildChatSystem } = await import("../src/lib/prompts");
  assert.doesNotMatch(buildChatSystem(uid, 0), /MODO DE SEGURANÇA ATIVADO/);
  const high = buildChatSystem(uid, 3);
  assert.match(high, /MODO DE SEGURANÇA ATIVADO/);
  assert.match(high, /AGORA/);
  assert.match(buildChatSystem(uid, 2), /nível de risco detectado: 2/);
});

test("avisos de tempo escalam conforme o relógio", async () => {
  const { timeCue } = await import("../src/lib/prompts/phases");
  assert.match(timeCue(10, "acompanhamento"), /síntese/);
  assert.match(timeCue(5, "acompanhamento"), /fechamento/);
  assert.match(timeCue(1, "acompanhamento"), /finalizar_sessao/);
  assert.match(timeCue(9, "triagem"), /segurança/);
});
