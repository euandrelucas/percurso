import { test } from "node:test";
import assert from "node:assert/strict";
import "./helpers";
import { MODULES, coreKnowledgeBlock, scoreModules, selectModules, injectionText } from "../src/lib/knowledge";
import { checkReply } from "../src/lib/guardrails";
import { CRISIS_TEXT_PT, safetyBlock } from "../src/lib/prompts/safety";

const ids = (t: string, o = {}) => selectModules(t, o).map((m) => m.id);

test("integridade: ids únicos, fontes e conteúdo preenchidos, referências internas existem", () => {
  const all = MODULES.map((m) => m.id);
  assert.equal(new Set(all).size, all.length, "ids duplicados");
  for (const m of MODULES) {
    assert.ok(m.fontes.length >= 1, `${m.id} sem fontes`);
    assert.ok(m.conteudo.length > 300, `${m.id} muito curto`);
    assert.ok(m.conteudo.length < 3200, `${m.id} muito longo (custa tokens a cada chamada)`);
  }
  // referências do tipo (id) / "bloco X" dentro dos textos devem apontar para módulos reais
  const refs = [...MODULES.flatMap((m) => [...m.conteudo.matchAll(/\(([a-z]+(?:-[a-z]+)+)\)/g)].map((x) => x[1]))];
  for (const r of refs) assert.ok(all.includes(r), `referência quebrada: ${r}`);
});

test("módulos de base e de risco são sempre carregados", () => {
  const core = coreKnowledgeBlock();
  assert.match(core, /Aliança terapêutica/);
  assert.match(core, /Estrutura da sessão/);
  assert.match(core, /encaminhamento|ajuda presencial/i);
  assert.match(core, /primeiros socorros emocionais/i);
  assert.match(core, /plano de segurança/i);
  assert.match(core, /Restrição de meios/i);
});

test("seleção por assunto (com acentos, caixa e variações)", () => {
  assert.ok(ids("não consigo dormir e fico remoendo o que o chefe disse").includes("sono-tcci"));
  assert.ok(ids("NÃO CONSIGO DORMIR").includes("sono-tcci"));
  assert.ok(ids("minha avó faleceu semana passada").includes("luto"));
  assert.ok(ids("tive uma crise de pânico no metrô, coração disparado").includes("respiracao-aterramento"));
  assert.ok(ids("meu marido me bate e tenho medo dele").includes("violencia-abuso"));
  assert.ok(ids("estou ouvindo vozes e acho que estão me seguindo").includes("psicose-mania"));
  assert.ok(ids("não bebo há dois dias e estou tremendo, bebo todo dia").includes("substancias"));
  assert.ok(ids("me corto quando fico nervosa").includes("autolesao"));
  assert.ok(ids("sou gay e tenho medo de contar pra minha família").includes("acolhimento-lgbtqia"));
  assert.ok(ids("sofro homofobia no trabalho").includes("acolhimento-lgbtqia"));
  assert.ok(ids("sou trans e quero usar meu nome social").includes("acolhimento-lgbtqia"));
});

test("sem assunto reconhecível não injeta nada; exclusões e limite são respeitados", () => {
  assert.deepEqual(ids("oi, tudo bem? o dia foi normal"), []);
  assert.ok(!ids("não consigo dormir", { exclude: ["sono-tcci"] }).includes("sono-tcci"));
  assert.ok(selectModules("trabalho chefe prazo sono preocupação raiva", { max: 2 }).length <= 2);
  assert.ok(scoreModules("quero me matar").some((s) => s.module.id === "primeiros-socorros-suicidio"));
});

test("texto de injeção durante a chamada avisa que não deve ser lido em voz alta", () => {
  const t = injectionText(selectModules("luto", {}));
  assert.match(t, /NÃO leia em voz alta/);
});

test("protocolo de risco: passos de primeiros socorros presentes, sem 'só passar o telefone'", () => {
  const s = safetyBlock("f");
  for (const re of [/PRIMEIROS SOCORROS EMOCIONAIS/, /PLANO DE SEGURANÇA/, /Stanley-Brown/, /pretende fazer|data ou momento/i, /afastar|guardar longe/i, /NÃO encerre|Não encerre/i, /192/, /188/, /não consegue chamar socorro/i]) assert.match(s, re);
  assert.match(s, /responder só com um número de telefone e encerrar/);
  assert.doesNotMatch(s, /\{[a-z]*\|[a-z]*\}/);
});

test("cartão de crise determinístico traz passos práticos, não só telefones", () => {
  for (const re of [/Afaste-se/, /não fique sozinho/i, /Respire/, /188/, /192/, /Continue falando comigo/]) assert.match(CRISIS_TEXT_PT, re);
});

test("guardrail de risco: bloqueia resposta só com telefone, despedida e minimização", () => {
  const r = (t: string) => checkReply(t, { riskLevel: 3 }).map((v) => v.rule);
  assert.ok(r("Ligue 188 agora.").includes("hotline_only"));
  assert.ok(!r("Estou aqui com você. Ligue 192 e me diz: tem alguém por perto?").includes("hotline_only"));
  assert.ok(r("Ok, tchau, cuide-se.").includes("dismissive_close"));
  assert.ok(r("Pense na sua família, isso passa logo.").includes("minimizing"));
  assert.deepEqual(checkReply("Ligue 188 agora.", { riskLevel: 0 }).map((v) => v.rule), []);
});
