import { activeGoals, allExercises, endedSessions, getMemory, moodHistory, parseAnalysis, screenings } from "../store";
import { fmtDate } from "../time";
import { clip } from "./persona";

const list = (a: string[], n = 8) => a.slice(0, n).map((x) => `  • ${clip(x, 200)}`).join("\n");

/**
 * Bloco de contexto do paciente, montado de forma DETERMINÍSTICA a partir do banco.
 * O modelo nunca recebe transcrições completas — só este resumo estruturado (menor custo, maior consistência).
 */
export function memoryBlock(uid: number): string {
  const mem = getMemory(uid);
  const past = endedSessions(uid, 4); // mais recentes primeiro
  const goals = activeGoals(uid).filter((g) => g.status === "ativa");
  const exercises = allExercises(uid);
  const pending = exercises.filter((e) => e.status === "pendente").slice(0, 3);
  const done = exercises.filter((e) => e.status !== "pendente").slice(0, 3);
  const moods = moodHistory(uid, 8);
  const scr = screenings(uid);

  const out: string[] = [`# O QUE VOCÊ JÁ SABE SOBRE ESTA PESSOA (use com naturalidade, nunca como quem lê uma ficha)`];

  if (past.length === 0 && !mem.queixa_principal) {
    out.push("Esta é a primeira conversa: você ainda não sabe nada além do que está na personalização acima e nas escalas abaixo (se houver).");
  }

  const ctx: string[] = [];
  if (mem.queixa_principal) ctx.push(`- Motivo principal: ${clip(mem.queixa_principal, 300)}`);
  if (mem.contexto_de_vida) ctx.push(`- Contexto de vida: ${clip(mem.contexto_de_vida, 400)}`);
  if (mem.historico_relevante) ctx.push(`- Histórico relevante: ${clip(mem.historico_relevante, 300)}`);
  if (mem.rede_de_apoio) ctx.push(`- Rede de apoio: ${clip(mem.rede_de_apoio, 200)}`);
  if (mem.temas_recorrentes.length) ctx.push(`- Temas recorrentes:\n${list(mem.temas_recorrentes)}`);
  if (mem.forcas_e_recursos.length) ctx.push(`- Forças e recursos (ajude-a a lembrar disso):\n${list(mem.forcas_e_recursos)}`);
  if (mem.o_que_funciona.length) ctx.push(`- O que costuma funcionar com ela:\n${list(mem.o_que_funciona)}`);
  if (mem.o_que_evitar.length) ctx.push(`- O que evitar:\n${list(mem.o_que_evitar)}`);
  if (mem.preferencias_de_comunicacao) ctx.push(`- Como ela gosta de ser abordada: ${clip(mem.preferencias_de_comunicacao, 200)}`);
  if (mem.padroes.length) ctx.push(`- Padrões observados (HIPÓTESES suas — nunca apresente como fato):\n${list(mem.padroes)}`);
  if (ctx.length) out.push(`## Contexto\n${ctx.join("\n")}`);

  if (scr.length) {
    const last = scr.slice(-4).map((s) => `${s.kind.toUpperCase()}: ${s.score}${s.flagged ? " (acima do ponto de atenção)" : ""} em ${fmtDate(s.created_at)}`);
    out.push(`## Triagem inicial (escalas)\n${last.map((l) => `- ${l}`).join("\n")}\n(Isto é só um indicativo para você ter sensibilidade; não comente números nem "resultados" com a pessoa.)`);
  }

  if (moods.length) {
    out.push(`## Humor recente (0 = muito mal, 10 = muito bem; mais antigo → mais recente)\n- ${moods.map((m) => m.score).join(" → ")}`);
  }

  if (goals.length) out.push(`## Metas combinadas\n${goals.map((g) => `- ${g.title}`).join("\n")}`);
  if (pending.length)
    out.push(`## Exercícios combinados e ainda pendentes\n${pending.map((e) => `- ${e.title}: ${clip(e.description, 200)}`).join("\n")}\n(Pergunte como foi, sem cobrança.)`);
  if (done.length)
    out.push(
      `## Exercícios já realizados\n${done.map((e) => `- ${e.title} (${e.status})${e.feedback ? ` — a pessoa disse: "${clip(e.feedback, 140)}"` : ""}`).join("\n")}`,
    );

  if (past.length) {
    const blocks = past.map((s, i) => {
      const a = parseAnalysis(s);
      const head = `Sessão ${s.number} (${s.kind === "triagem" ? "triagem" : "acompanhamento"}, ${fmtDate(s.started_at)})`;
      if (!a) return `- ${head}: sem resumo disponível.`;
      const extra = i === 0 ? [`  Pontos em aberto: ${a.pontos_para_proxima_sessao.map((p) => clip(p, 160)).join(" | ") || "—"}`, `  Sugestão de abertura: ${clip(a.abertura_sugerida, 240)}`] : [];
      return [`- ${head}: ${clip(a.resumo, i === 0 ? 700 : 350)}`, a.humor_estimado_fim != null ? `  Humor ao final: ${a.humor_estimado_fim}/10` : "", ...extra]
        .filter(Boolean)
        .join("\n");
    });
    out.push(`## Últimas sessões (da mais recente para a mais antiga)\n${blocks.join("\n")}`);
  }

  out.push(
    `## Como usar tudo isso\n- Retome, com leveza, ao menos UM fio concreto da última conversa no começo (ex.: o assunto que ficou em aberto ou o exercício combinado).\n- Não despeje a ficha: traga um detalhe por vez, quando fizer sentido.\n- Se algo aqui contradisser o que a pessoa disser agora, a fala dela vale mais: confirme com curiosidade ("antes você tinha comentado X — mudou?").`,
  );
  return out.join("\n\n");
}
