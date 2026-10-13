import Link from "next/link";
import { PageTitle, Stat, Badge } from "@/components/ui";
import { dashboardStats } from "@/lib/admin-stats";
import { all } from "@/lib/db";
import { fmtDateTime } from "@/lib/time";
import { config } from "@/lib/config";

export const dynamic = "force-dynamic";

function Bar({ label, value, total, tone = "bg-teal" }: { label: string; value: number; total: number; tone?: string }) {
  const p = total ? Math.round((value / total) * 100) : 0;
  return (
    <div>
      <div className="flex justify-between text-sm mb-1"><span>{label}</span><span className="text-muted">{value} · {p}%</span></div>
      <div className="h-2 rounded-full bg-sand-deep overflow-hidden"><div className={`h-full ${tone}`} style={{ width: `${p}%` }} /></div>
    </div>
  );
}

export default async function Dashboard() {
  const s = dashboardStats();
  const alerts = all<{ id: number; level: number; source: string; excerpt: string; created_at: string; name: string; uid: number }>(
    "SELECT a.id, a.level, a.source, a.excerpt, a.created_at, u.name, u.id AS uid FROM alerts a JOIN users u ON u.id = a.user_id WHERE a.status = 'aberto' ORDER BY a.level DESC, a.id DESC LIMIT 5",
  );
  return (
    <>
      <PageTitle title="Painel do estudo" sub="Visão geral do beta fechado: adesão, uso e segurança." />
      {config.mock() && <div className="mb-5 rounded-xl bg-amber-soft text-[#8a5a00] px-4 py-3 text-sm"><strong>Modo demonstração:</strong> OPENAI_API_KEY não configurada — respostas e análises são simuladas.</div>}

      {alerts.length > 0 && (
        <section className="mb-8 rounded-2xl border border-[#f1c4b8] bg-coral-soft p-5">
          <div className="flex items-center justify-between mb-3"><h2 className="text-xl font-semibold">Alertas que precisam de você</h2><Link href="/admin/alertas" className="text-sm font-semibold text-[#b4401f]">ver todos</Link></div>
          <ul className="space-y-2.5">
            {alerts.map((a) => (
              <li key={a.id} className="bg-white rounded-xl p-3 text-sm">
                <div className="flex items-center gap-2"><Badge tone={a.level >= 3 ? "alert" : "warn"}>nível {a.level}</Badge><Link className="font-semibold hover:underline" href={`/admin/pacientes/${a.uid}`}>{a.name}</Link><span className="text-muted ml-auto">{fmtDateTime(a.created_at)}</span></div>
                <p className="text-ink-soft mt-1 line-clamp-2">{a.excerpt}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Convites usados" value={`${s.inviteRate}%`} sub={`${s.invUsed} de ${s.invites} gerados`} />
        <Stat label="Onboarding concluído" value={`${s.onboardRate}%`} sub={`${s.onboarded} de ${s.patients} contas`} />
        <Stat label="Fizeram 1ª sessão" value={`${s.firstSessionRate}%`} sub={`${s.withSession} de ${s.onboarded} pacientes`} />
        <Stat label="Voltaram (2+ sessões)" value={`${s.returnRate}%`} sub={`${s.returning} de ${s.withSession}`} tone="good" />
        <Stat label="Sessões realizadas" value={s.sessionsEnded} sub={`média de ${s.avgDurMin} min`} />
        <Stat label="Sessões até o fim" value={`${s.fullRate}%`} sub="≥ 85% do tempo" />
        <Stat label="Usaram o chat" value={`${s.chatRate}%`} sub={`${s.chatMsgs} mensagens`} />
        <Stat label="Alertas abertos" value={s.openAlerts} sub={`${s.alertsTotal} no total · ${s.highAlerts} nível 3`} tone={s.openAlerts ? "alert" : "default"} />
      </div>

      <div className="grid md:grid-cols-2 gap-5 mt-6">
        <section className="card space-y-3">
          <h2 className="text-xl font-semibold">Como as sessões terminam</h2>
          <Bar label="Encerradas pela IA (despedida natural)" value={s.byAgent} total={s.sessionsEnded} />
          <Bar label="Encerradas pelo paciente" value={s.byPatient} total={s.sessionsEnded} tone="bg-ink" />
          <Bar label="Limite de tempo" value={s.byTime} total={s.sessionsEnded} tone="bg-amber-500" />
          <Bar label="Falha técnica / abandono" value={s.byTech} total={s.sessionsEnded} tone="bg-coral" />
        </section>
        <section className="card space-y-3">
          <h2 className="text-xl font-semibold">Sinais clínicos (agregado)</h2>
          <div className="flex justify-between text-sm"><span>Humor médio no início → fim da sessão</span><strong>{s.moodStart ?? "—"} → {s.moodEnd ?? "—"}</strong></div>
          <div className="flex justify-between text-sm"><span>Pacientes com PHQ-2/GAD-2 ≥ 3</span><strong>{s.flaggedScreen}</strong></div>
          <div className="flex justify-between text-sm"><span>Exercícios realizados</span><strong>{s.exerciseRate}%</strong></div>
          <p className="text-xs text-muted pt-2">Dados de viabilidade e adesão. Não medem eficácia clínica.</p>
        </section>
      </div>
    </>
  );
}
