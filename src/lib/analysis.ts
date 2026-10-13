import { PROMPT_VERSION, config } from "./config";
import { audit, prisma } from "./prisma";
import { chatJSON } from "./openai";
import { memoryBlock } from "./prompts/memory";
import { EMPTY_MEMORY, type CaseMemory, type ReportData, type Session, type SessionAnalysis } from "./types";
import { getMemory, getSession, raiseAlert, saveAnalysis, saveMemory, saveReport, sessionMessages } from "./store";
import { fmtDuration } from "./time";
import { buildDossier } from "./report-data";

// --- JSON Schemas estritos ---------------------------------------------------------------------------------------
const S = { type: "string" } as const;
const arr = (items: unknown) => ({ type: "array", items });
const obj = (props: Record<string, unknown>) => ({ type: "object", additionalProperties: false, required: Object.keys(props), properties: props });
const nullable = (t: unknown) => ({ anyOf: [t, { type: "null" }] });

const MEMORY_SCHEMA = obj({
  queixa_principal: S,
  contexto_de_vida: S,
  historico_relevante: S,
  padroes: arr(S),
  forcas_e_recursos: arr(S),
  o_que_funciona: arr(S),
  o_que_evitar: arr(S),
  temas_recorrentes: arr(S),
  rede_de_apoio: S,
  preferencias_de_comunicacao: S,
});

const HYPOTHESIS = obj({ texto: S, confianca: { type: "string", enum: ["baixa", "media", "alta"] } });

const ANALYSIS_SCHEMA = {
  name: "analise_sessao",
  strict: true,
  schema: obj({
    resumo: S,
    resumo_paciente: arr(S),
    temas: arr(S),
    emocoes_predominantes: arr(S),
    humor_estimado_inicio: nullable({ type: "integer" }),
    humor_estimado_fim: nullable({ type: "integer" }),
    risco: obj({ nivel: { type: "integer", enum: [0, 1, 2, 3] }, evidencias: arr(S) }),
    fatos_observados: arr(S),
    hipoteses: arr(HYPOTHESIS),
    tecnicas_usadas: arr(S),
    exercicio: nullable(obj({ titulo: S, descricao: S })),
    metas: arr(obj({ titulo: S, status: { type: "string", enum: ["nova", "em_andamento", "atingida", "abandonada"] } })),
    pontos_para_proxima_sessao: arr(S),
    abertura_sugerida: S,
    para_o_profissional: S,
    memoria_atualizada: MEMORY_SCHEMA,
  }),
};

const ANALYSIS_SYSTEM = `Você é um assistente clínico de apoio que documenta sessões de acompanhamento psicológico (conduzidas por uma IA de apoio emocional, em estudo supervisionado por humanos) em português do Brasil.
Receba a transcrição da sessão e o contexto atual do caso e produza o registro estruturado.

REGRAS DE OURO
- SEPARE FATO DE HIPÓTESE. "fatos_observados" contém apenas o que a pessoa disse ou fez, de forma literal e verificável ("relatou dormir 4 horas por noite há duas semanas"). Interpretações vão em "hipoteses" com confiança baixa/media/alta ancorada no que foi dito. Nunca transforme inferência em fato. Nunca invente percentuais.
- NÃO FAÇA DIAGNÓSTICO. Use linguagem descritiva ("sintomas compatíveis com…" só se estiver claramente ancorado, e sempre como hipótese de baixa/média confiança para avaliação profissional).
- Não invente nada que não esteja na transcrição. Se algo não foi dito, deixe vazio. Se a sessão foi curta ou sem conteúdo, diga isso no resumo.
- "risco.nivel": 0 nenhum; 1 sofrimento intenso sem ideação; 2 ideação passiva, autolesão sem plano, desesperança marcante, psicose, violência sofrida; 3 plano/intenção/meio, ato em curso ou intenção de ferir outros. Na dúvida, o nível MAIS ALTO. "evidencias" = trechos curtos ditos pela pessoa.
- ERROS DE TRANSCRIÇÃO: a fala do paciente vem de transcrição automática de voz e às vezes contém trechos sem sentido ("safa shapurke", "uma vacina", "os ombros da mulher") causados por ruído ou áudio ruim. NÃO trate isso como "discurso desconexo", confusão mental ou sintoma, não derive risco disso e não os cite como fatos; ignore-os ou registre, no máximo, "trechos ininteligíveis (provável erro de transcrição)". Só levante hipótese de desorganização se houver padrão claro e consistente.
- NEGAÇÕES: se o paciente negou algo ("não tenho vontade de me machucar"), isso NÃO é evidência de risco.
- "memoria_atualizada.o_que_evitar" e "preferencias_de_comunicacao": registre só o que o paciente realmente demonstrou (ex.: "pede direção concreta e exemplos", "se irrita com respostas vagas ou repetitivas"). Nunca escreva conselhos genéricos como "evitar pressão" ou "respeitar o ritmo". Se a IA ficou repetitiva ou vaga e o paciente reclamou, registre isso em "o_que_evitar".
- "resumo_paciente": 2 a 4 frases curtas ESCRITAS PARA O PACIENTE, em segunda pessoa ("você"), calorosas e simples, sem termos técnicos, sem diagnóstico e sem hipóteses: o que você ouviu de importante, algo de bom que ele fez ou percebeu, e o que ficou combinado (se houver). Se a sessão foi curta ou sem conteúdo, devolva lista vazia.
- "resumo": 4 a 6 frases, tom neutro e profissional, sem identificar terceiros além do necessário.
- "humor_estimado_*": use APENAS notas de 0 a 10 que a própria pessoa tenha dito; se não houver, null.
- "exercicio": o exercício realmente combinado ao final (se houver); título curto e descrição prática em 1–3 frases, em linguagem acessível ao paciente, falando com ele ("Anote…").
- "metas": metas realmente combinadas/mencionadas nesta sessão (nas palavras do paciente), com status.
- "pontos_para_proxima_sessao": o que ficou em aberto e vale retomar. "abertura_sugerida": uma frase natural e acolhedora que a IA poderia usar para abrir a próxima sessão retomando o fio.
- "para_o_profissional": alertas, adesão, pontos de atenção para o psicólogo humano, em 2–4 frases objetivas.
- "memoria_atualizada": ATUALIZE o contexto do caso mesclando o contexto anterior com as novas informações (não perca informações antigas relevantes; corrija o que a pessoa contradisse; mantenha listas curtas, no máximo 8 itens cada). "padroes" são hipóteses suas, sempre cautelosas.`;

type Msg = { role: string; content: string };
const transcriptText = (msgs: Msg[]) => msgs.map((m) => `${m.role === "assistant" ? "IA" : "PACIENTE"}: ${m.content}`).join("\n");

export async function analyzeSession(sessionId: number): Promise<SessionAnalysis | null> {
  const s = await getSession(sessionId);
  if (!s) return null;
  const msgs = (await sessionMessages(sessionId)).filter((m) => m.role !== "system");
  const userMsgs = msgs.filter((m) => m.role === "user");
  const prev = await getMemory(s.user_id);

  let a: SessionAnalysis;
  if (userMsgs.length === 0) {
    a = emptyAnalysis(prev, "A sessão terminou sem falas registradas do paciente (possível problema de áudio/conexão ou desistência).");
  } else if (config.mock()) {
    a = mockAnalysis(msgs, prev);
  } else {
    try {
      const ctx = await memoryBlock(s.user_id);
      a = await chatJSON<SessionAnalysis>({
        system: ANALYSIS_SYSTEM,
        user: `CONTEXTO DO CASO ANTES DESTA SESSÃO:\n${ctx}\n\nSESSÃO ${s.number} (${s.kind}) — duração ${fmtDuration(s.duration_sec)}, encerrada por: ${s.end_reason ?? "—"}\n\nTRANSCRIÇÃO:\n${transcriptText(msgs).slice(0, 60000)}`,
        schema: ANALYSIS_SCHEMA,
        maxTokens: 3500,
        temperature: 0.2,
      });
    } catch (e) {
      await audit("system", "analysis.failed", s.user_id, { sessionId, error: String(e).slice(0, 300) });
      a = emptyAnalysis(prev, "Não foi possível gerar a análise automática desta sessão. A transcrição está disponível para revisão manual.");
    }
  }
  await applyAnalysis(s, a);
  return a;
}

async function applyAnalysis(s: Session, a: SessionAnalysis) {
  await saveAnalysis(s.id, a);
  await saveMemory(s.user_id, { ...EMPTY_MEMORY, ...a.memoria_atualizada }, s.id);

  if (a.humor_estimado_fim != null) await prisma.mood.create({ data: { user_id: s.user_id, score: a.humor_estimado_fim, note: `Ao final da sessão ${s.number}` } });

  for (const g of a.metas) {
    const existing = await prisma.goal.findFirst({ where: { user_id: s.user_id, title: { equals: g.titulo, mode: "insensitive" } } });
    const status = g.status === "atingida" ? "atingida" : g.status === "abandonada" ? "abandonada" : "ativa";
    if (existing) await prisma.goal.update({ where: { id: existing.id }, data: { status } });
    else await prisma.goal.create({ data: { user_id: s.user_id, title: g.titulo.slice(0, 300), status, session_id: s.id } });
  }
  if (a.exercicio && a.exercicio.titulo) {
    // exercícios antigos ainda pendentes ficam como "não realizado" para não acumular.
    await prisma.exercise.updateMany({ where: { user_id: s.user_id, status: "pendente" }, data: { status: "nao_realizado" } });
    await prisma.exercise.create({ data: { user_id: s.user_id, title: a.exercicio.titulo.slice(0, 200), description: a.exercicio.descricao.slice(0, 1000), session_id: s.id } });
  }
  if (a.risco.nivel >= 1) await raiseAlert(s.user_id, a.risco.nivel, `sessao:${s.id}`, a.risco.evidencias.join(" | ") || "Risco identificado na análise da sessão");
  await audit("system", "analysis.saved", s.user_id, { sessionId: s.id, risk: a.risco.nivel, promptVersion: PROMPT_VERSION });
}

function emptyAnalysis(prev: CaseMemory, resumo: string): SessionAnalysis {
  return {
    resumo,
    resumo_paciente: [],
    temas: [],
    emocoes_predominantes: [],
    humor_estimado_inicio: null,
    humor_estimado_fim: null,
    risco: { nivel: 0, evidencias: [] },
    fatos_observados: [],
    hipoteses: [],
    tecnicas_usadas: [],
    exercicio: null,
    metas: [],
    pontos_para_proxima_sessao: [],
    abertura_sugerida: "Que bom te ver de novo. Como você está hoje?",
    para_o_profissional: "Sessão sem conteúdo analisável. Considere verificar a experiência técnica com o participante.",
    memoria_atualizada: prev,
  };
}

function mockAnalysis(msgs: Msg[], prev: CaseMemory): SessionAnalysis {
  const said = msgs.filter((m) => m.role === "user").map((m) => m.content);
  return {
    ...emptyAnalysis(prev, `[MODO DEMONSTRAÇÃO — sem IA real] O paciente falou ${said.length} vez(es). Primeiras palavras: "${said[0]?.slice(0, 120) ?? ""}".`),
    resumo_paciente: ["Hoje a gente conversou em modo demonstração, sem IA real.", "Combinamos uma respiração curtinha por dia: inspira contando 4, solta contando 6."],
    temas: ["demonstração"],
    fatos_observados: said.slice(0, 3).map((t) => `Disse: "${t.slice(0, 140)}"`),
    exercicio: { titulo: "Respiração de 3 minutos", descricao: "Uma vez por dia, respire contando 4 segundos para inspirar e 6 para soltar, por 3 minutos." },
    metas: [{ titulo: "Cuidar mais do meu descanso", status: "nova" }],
    pontos_para_proxima_sessao: ["Como foi o exercício de respiração"],
    abertura_sugerida: "Da última vez a gente combinou aquela respiração. Como foi pra você?",
    para_o_profissional: "Análise gerada em modo demonstração.",
    memoria_atualizada: { ...prev, queixa_principal: prev.queixa_principal || (said[0]?.slice(0, 160) ?? "") },
  };
}

// --- Relatório do paciente (histórico completo, para anexar ao estudo) ---------------------------------------------------
const REPORT_SCHEMA = {
  name: "relatorio_paciente",
  strict: true,
  schema: obj({
    titulo: S,
    identificacao: S,
    motivo_da_busca: S,
    triagem: S,
    evolucao: S,
    temas_principais: arr(S),
    fatos_observados: arr(S),
    hipoteses: arr(HYPOTHESIS),
    metas_e_exercicios: S,
    riscos_e_alertas: S,
    adesao_e_engajamento: S,
    recomendacoes_ao_profissional: arr(S),
    limitacoes: S,
  }),
};

const REPORT_SYSTEM = `Você redige a parte narrativa do relatório de acompanhamento de um participante de um estudo fechado (beta) de apoio emocional conduzido por uma IA, em português do Brasil. O relatório será ANEXADO AO ESTUDO e lido por psicólogos/pesquisadores. Os registros brutos (transcrições, escalas, datas, alertas) irão em anexos no mesmo documento; sua parte é a síntese.

REGRAS
- Use APENAS os dados fornecidos. Não invente fatos, escores, datas ou falas. Se faltar informação, escreva "Sem dados suficientes".
- SEPARE FATO DE HIPÓTESE: "fatos_observados" só traz o que o paciente relatou/fez (e dados objetivos como escores e notas de humor), ordenados cronologicamente quando possível; interpretações vão em "hipoteses" com confiança baixa/media/alta. Nunca afirme diagnóstico: use "hipótese a ser avaliada por profissional".
- Tom neutro, técnico e respeitoso, sem julgamentos. Frases curtas. Cada seção em 3 a 8 frases (listas: até 12 itens curtos).
- "evolucao": percorra TODAS as sessões na ordem, descrevendo a trajetória (humor, temas, adesão a exercícios, mudanças de padrão), apontando estagnação ou piora quando houver.
- "riscos_e_alertas": descreva TODOS os sinais de risco registrados (com data e fonte), o que a IA fez e o que ainda requer decisão humana. Se não houver, diga isso explicitamente.
- "recomendacoes_ao_profissional": sugestões objetivas de atenção. São sugestões — a decisão é do profissional.
- "limitacoes": inclua que o conteúdo foi gerado automaticamente a partir de conversas com uma IA, não constitui avaliação clínica nem diagnóstico, não mede eficácia e requer revisão por profissional habilitado.`;

export async function generateReport(uid: number, actor = "admin"): Promise<{ id: number; data: ReportData }> {
  const d = await buildDossier(uid);
  const facts = {
    paciente: { nome_preferido: d.agent?.preferredName ?? d.patient.name, cadastro: d.patient.registeredAt, consentimento: d.patient.consentAt, expectativa_declarada: d.agent?.goalHint ?? "", assuntos_declarados: d.agent?.topics ?? "", sobre_si: d.agent?.aboutMe ?? "" },
    escalas: d.screenings,
    contexto_do_caso: d.memory,
    sessoes: d.sessions.map((s) => ({ numero: s.number, tipo: s.kind, data: s.started, duracao: s.duration, encerrada_por: s.endReason, analise: s.analysis })),
    humor_ao_longo_do_tempo: d.moods.map((m) => ({ nota: m.score, data: m.date, obs: m.note })),
    metas: d.goals,
    exercicios: d.exercises,
    alertas: d.alerts,
    mensagens_de_emergencia_total: d.chat.filter((m) => m.role === "user").length,
  };

  let data: ReportData;
  if (config.mock()) {
    data = mockReport(d.patient.name, d.totals.sessions, d.memory, d.alerts.length);
  } else {
    const r = await chatJSON<Omit<ReportData, "gerado_em">>({
      system: REPORT_SYSTEM,
      user: `DADOS DO ACOMPANHAMENTO (JSON):\n${JSON.stringify(facts).slice(0, 110000)}`,
      schema: REPORT_SCHEMA,
      maxTokens: 4000,
      temperature: 0.2,
    });
    data = { ...r, gerado_em: new Date().toISOString() };
  }
  const id = await saveReport(uid, data, config.mock() ? "mock" : config.chatModel(), PROMPT_VERSION);
  await audit(actor, "report.generated", uid, { reportId: id });
  return { id, data };
}

function mockReport(name: string, nSessions: number, mem: CaseMemory, nAlerts: number): ReportData {
  return {
    titulo: `Relatório de acompanhamento — ${name}`,
    gerado_em: new Date().toISOString(),
    identificacao: `${name}. ${nSessions} sessão(ões) concluída(s). [Modo demonstração: narrativa simulada, sem IA]`,
    motivo_da_busca: mem.queixa_principal || "Sem dados suficientes.",
    triagem: "Sem dados suficientes (modo demonstração).",
    evolucao: "Sem dados suficientes (modo demonstração).",
    temas_principais: mem.temas_recorrentes,
    fatos_observados: [],
    hipoteses: [],
    metas_e_exercicios: "Sem dados suficientes.",
    riscos_e_alertas: nAlerts ? `${nAlerts} alerta(s) registrado(s). Revise no painel.` : "Nenhum sinal de risco registrado.",
    adesao_e_engajamento: "Sem dados suficientes.",
    recomendacoes_ao_profissional: ["Configurar OPENAI_API_KEY para gerar a narrativa real."],
    limitacoes: "Conteúdo gerado automaticamente; não constitui avaliação clínica nem diagnóstico, não mede eficácia e requer revisão por profissional habilitado.",
  };
}
