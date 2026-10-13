import Link from "next/link";
import { requirePatient } from "@/lib/auth";
import { Avatar } from "@/components/Avatar";
import { Badge } from "@/components/ui";
import { ExerciseItem, MoodCheckin, ReminderToggle } from "@/components/PatientWidgets";
import { parseAvatar } from "@/lib/prompts/options";
import { activeGoals, allExercises, callAvailability, endedSessions, getAgent, hasCompletedSession, moodHistory, parseAnalysis } from "@/lib/store";
import { dayKey, fmtDate } from "@/lib/time";

export const dynamic = "force-dynamic";

export default async function Home() {
  const u = await requirePatient();
  const [agent, avail, completed, lastList, allGoals, allEx, moods] = await Promise.all([getAgent(u.id), callAvailability(u), hasCompletedSession(u.id), endedSessions(u.id, 1), activeGoals(u.id), allExercises(u.id), moodHistory(u.id, 14)]);
  if (!agent) return null;
  const { available, resumable } = avail;
  const first = !completed;
  const last = lastList[0];
  const lastA = parseAnalysis(last);
  const goals = allGoals.filter((g) => g.status === "ativa");
  const exs = allEx.filter((e) => e.status !== "nao_realizado").slice(0, 4);
  const today = dayKey(new Date());
  const moodToday = [...moods].reverse().find((m) => dayKey(m.created_at) === today)?.score ?? null;
  const pendingEx = allEx.find((e) => e.status === "pendente");
  // "O que fazer agora": no máximo 3 passos curtos, na ordem em que ajudam mais.
  const steps: { done: boolean; text: string; href?: string; cta?: string }[] = [];
  steps.push(
    resumable || available
      ? { done: false, text: resumable ? `Sua conversa com ${agent.agent_name} ficou aberta` : first ? `Conversar com ${agent.agent_name} pela primeira vez` : `Conversar com ${agent.agent_name} hoje`, href: "/app/atendimento/chamada", cta: resumable ? "Voltar" : "Entrar" }
      : { done: true, text: "Conversa de hoje feita. Amanhã tem outra, se quiser" },
  );
  if (pendingEx) steps.push({ done: false, text: `Exercício combinado: ${pendingEx.title}`, href: "#exercicios", cta: "Ver" });
  steps.push(moodToday == null ? { done: false, text: "Registrar como você está", href: "#humor", cta: "Registrar" } : { done: true, text: `Humor de hoje registrado (${moodToday}/10)` });

  return (
    <div className="space-y-6">
      <section className="card !p-0 overflow-hidden grid md:grid-cols-[260px_1fr]">
        <div className="bg-night aspect-square md:aspect-auto min-h-[260px]">
          <Avatar avatar={parseAvatar(agent.avatar)} className="w-full h-full" />
        </div>
        <div className="p-6 md:p-8 flex flex-col justify-center">
          <Badge tone={available ? "good" : "default"}>{available ? "Chamada de hoje disponível" : "Chamada de hoje já realizada"}</Badge>
          <h1 className="text-4xl font-semibold mt-3">Oi, {agent.preferred_name}.</h1>
          <p className="text-ink-soft mt-2 max-w-md">
            {first ? `${agent.agent_name} está esperando você para a primeira conversa. Sem pressa, sem roteiro rígido.` : `${agent.agent_name} está aqui para continuar de onde vocês pararam.`}
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link href="/app/atendimento/chamada" className={`btn btn-primary ${available ? "" : "pointer-events-none opacity-50"}`}>{resumable ? "Voltar para a chamada" : first ? "Começar primeira sessão" : "Entrar na chamada"}</Link>
            <Link href="/app/atendimento/mensagens" className="btn btn-ghost">Enviar mensagem</Link>
          </div>
          {!available && <p className="text-xs text-muted mt-3">Amanhã ela estará liberada de novo. Em caso de emergência, use as mensagens.</p>}
        </div>
      </section>

      <section className="card" aria-labelledby="agora">
        <h2 id="agora" className="text-xl font-semibold mb-3">Para hoje</h2>
        <ul className="space-y-2.5">
          {steps.map((st) => (
            <li key={st.text} className="flex items-center gap-3">
              <span className={`w-6 h-6 rounded-full grid place-items-center text-xs shrink-0 ${st.done ? "bg-teal text-white" : "border-2 border-line"}`} aria-hidden>{st.done ? "✓" : ""}</span>
              <span className={`flex-1 ${st.done ? "text-muted" : ""}`}>{st.text}</span>
              {st.href && <a href={st.href} className="text-sm font-semibold text-teal-deep">{st.cta}</a>}
            </li>
          ))}
        </ul>
        <div className="mt-4 pt-4 border-t border-line"><ReminderToggle /></div>
      </section>

      <div className="grid md:grid-cols-2 gap-6">
        <section id="humor" className="card space-y-4 scroll-mt-24">
          <MoodCheckin today={moodToday} />
          {moods.length > 1 && (
            <div>
              <p className="text-xs text-muted mb-1">Seus últimos registros</p>
              <div className="flex items-end gap-1 h-14" aria-label="Gráfico de humor">
                {moods.map((m, i) => (
                  <div key={i} title={`${m.score}/10 — ${fmtDate(m.created_at)}`} className="flex-1 rounded-t bg-teal/70" style={{ height: `${Math.max(8, m.score * 10)}%` }} />
                ))}
              </div>
            </div>
          )}
        </section>

        <section className="card">
          <h2 className="text-xl font-semibold mb-3">Suas metas</h2>
          {goals.length ? (
            <ul className="space-y-2">{goals.map((g) => <li key={g.id} className="flex gap-2.5"><span className="text-teal mt-0.5">◎</span><span>{g.title}</span></li>)}</ul>
          ) : (
            <p className="text-sm text-muted">Suas metas vão aparecer aqui depois da primeira sessão. Elas são combinadas com você, nunca impostas.</p>
          )}
        </section>
      </div>

      <section id="exercicios" className="card scroll-mt-24">
        <h2 className="text-xl font-semibold mb-3">Exercícios combinados</h2>
        {exs.length ? <ul className="space-y-3">{exs.map((e) => <ExerciseItem key={e.id} ex={e} />)}</ul> : <p className="text-sm text-muted">Nenhum exercício por enquanto.</p>}
      </section>

      {last && (
        <section className="card">
          <div className="flex items-center justify-between"><h2 className="text-xl font-semibold">Última sessão</h2><Link href={`/app/sessoes/${last.id}`} className="text-sm text-teal-deep font-semibold">ver detalhes</Link></div>
          <p className="text-xs text-muted mt-0.5">Sessão {last.number} · {fmtDate(last.started_at)}</p>
          {lastA?.resumo_paciente?.length ? (
            <ul className="mt-3 space-y-1.5 text-ink-soft leading-relaxed">{lastA.resumo_paciente.map((t) => <li key={t} className="flex gap-2"><span className="text-teal" aria-hidden>•</span><span>{t}</span></li>)}</ul>
          ) : (
            <p className="text-ink-soft mt-3 leading-relaxed">{lastA?.resumo ?? "O resumo está sendo preparado…"}</p>
          )}
        </section>
      )}
    </div>
  );
}
