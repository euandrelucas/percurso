import Link from "next/link";
import { requirePatient } from "@/lib/auth";
import { Avatar } from "@/components/Avatar";
import { Badge } from "@/components/ui";
import { ExerciseItem, MoodCheckin } from "@/components/PatientWidgets";
import { parseAvatar } from "@/lib/prompts/options";
import { activeGoals, allExercises, callAvailability, endedSessions, getAgent, hasCompletedSession, moodHistory, parseAnalysis } from "@/lib/store";
import { fmtDate } from "@/lib/time";

export const dynamic = "force-dynamic";

export default async function Home() {
  const u = await requirePatient();
  const agent = getAgent(u.id)!;
  const { available, resumable } = callAvailability(u);
  const first = !hasCompletedSession(u.id);
  const last = endedSessions(u.id, 1)[0];
  const lastA = parseAnalysis(last);
  const goals = activeGoals(u.id).filter((g) => g.status === "ativa");
  const exs = allExercises(u.id).filter((e) => e.status !== "nao_realizado").slice(0, 4);
  const moods = moodHistory(u.id, 14);

  return (
    <div className="space-y-6">
      <section className="card !p-0 overflow-hidden grid md:grid-cols-[260px_1fr]">
        <div className="bg-ink aspect-square md:aspect-auto">
          <Avatar avatar={parseAvatar(agent.avatar)} className="w-full h-full object-cover" />
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

      <div className="grid md:grid-cols-2 gap-6">
        <section className="card space-y-4">
          <MoodCheckin />
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

      <section className="card">
        <h2 className="text-xl font-semibold mb-3">Exercícios combinados</h2>
        {exs.length ? <ul className="space-y-3">{exs.map((e) => <ExerciseItem key={e.id} ex={e} />)}</ul> : <p className="text-sm text-muted">Nenhum exercício por enquanto.</p>}
      </section>

      {last && (
        <section className="card">
          <div className="flex items-center justify-between"><h2 className="text-xl font-semibold">Última sessão</h2><Link href={`/app/sessoes/${last.id}`} className="text-sm text-teal-deep font-semibold">ver detalhes</Link></div>
          <p className="text-xs text-muted mt-0.5">Sessão {last.number} · {fmtDate(last.started_at)}</p>
          <p className="text-ink-soft mt-3 leading-relaxed">{lastA?.resumo ?? "O resumo está sendo preparado…"}</p>
        </section>
      )}
    </div>
  );
}
