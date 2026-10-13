import Link from "next/link";
import { PageTitle, Stat, Badge } from "@/components/ui";
import { BarChart, Funnel, LineChart, fillDays } from "@/components/charts";
import { requireAdmin } from "@/lib/auth";
import { dashboardStats } from "@/lib/admin-stats";
import { listAlerts } from "@/lib/store";
import { prisma } from "@/lib/prisma";
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
  await requireAdmin();
  const [s, alerts, recent] = await Promise.all([
    dashboardStats(),
    listAlerts({ status: "aberto" }, 5),
    prisma.auditLog.findMany({ orderBy: { id: "desc" }, take: 8 }),
  ]);
  const daily = fillDays(s.daily.map((r) => ({ d: r.d, n: r.n })));
  const mood = fillDays(s.moodDaily.map((r) => ({ d: r.d, v: r.v })));
  return (
    <>
      <PageTitle
        title="Painel do estudo"
        sub="Visão geral do beta fechado: adesão, uso e segurança."
        action={<a href="/api/admin/export" className="btn btn-ghost text-sm">Exportar CSV do estudo</a>}
      />
      {config.mock() && <div className="mb-5 rounded-xl bg-amber-soft text-amber-ink px-4 py-3 text-sm"><strong>Modo demonstração:</strong> OPENAI_API_KEY não configurada — respostas e análises são simuladas.</div>}

      {alerts.length > 0 && (
        <section className="mb-8 rounded-2xl border border-[#f1c4b8] bg-coral-soft p-5">
          <div className="flex items-center justify-between mb-3"><h2 className="text-xl font-semibold">Alertas que precisam de você</h2><Link href="/admin/alertas" className="text-sm font-semibold text-coral-ink">ver todos ({s.openAlerts})</Link></div>
          <ul className="space-y-2.5">
            {alerts.map((a) => (
              <li key={a.id} className="bg-white rounded-xl p-3 text-sm">
                <div className="flex items-center gap-2"><Badge tone={a.level >= 3 ? "alert" : "warn"}>nível {a.level}</Badge><Link className="font-semibold hover:underline" href={`/admin/pacientes/${a.user_id}`}>{a.user?.name}</Link><span className="text-muted ml-auto">{fmtDateTime(a.created_at)}</span></div>
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
        <Stat label="A conversa ajudou?" value={s.help.total ? `${Math.round((s.help.yes / s.help.total) * 100)}% sim` : "—"} sub={s.help.total ? `ajudou ${s.help.yes} · mais ou menos ${s.help.mid} · não ajudou ${s.help.no} (${s.help.total} respostas)` : "ainda sem respostas"} tone={s.help.no > s.help.yes ? "alert" : "good"} />
        <Stat label="Usaram o chat" value={`${s.chatRate}%`} sub={`${s.chatMsgs} mensagens`} />
        <Stat label="Alertas abertos" value={s.openAlerts} sub={`${s.alertsTotal} no total · ${s.highAlerts} nível 3`} tone={s.openAlerts ? "alert" : "default"} />
      </div>

      {s.helpByPrompt.length > 0 && (
        <section className="card mt-6">
          <h2 className="text-xl font-semibold mb-1">Avaliação por versão do prompt</h2>
          <p className="text-sm text-muted mb-3">Média de 1 (não ajudou) a 3 (ajudou). Compare versões depois de cada mudança nos prompts.</p>
          <table className="w-full text-sm"><thead><tr className="text-left text-muted"><th className="py-1">Versão</th><th>Respostas</th><th>Média</th></tr></thead>
            <tbody>{s.helpByPrompt.map((r) => <tr key={r.v} className="border-t border-line"><td className="py-1.5 font-mono">{r.v}</td><td>{r.n}</td><td className="font-semibold">{r.avg.toFixed(2)}</td></tr>)}</tbody></table>
        </section>
      )}

      <div className="grid md:grid-cols-2 gap-5 mt-6">
        <section className="card"><h2 className="text-xl font-semibold mb-2">Sessões por dia <span className="text-sm font-normal text-muted">(30 dias)</span></h2><BarChart data={daily} label="Sessões por dia nos últimos 30 dias" /></section>
        <section className="card"><h2 className="text-xl font-semibold mb-2">Humor médio por dia <span className="text-sm font-normal text-muted">(0–10)</span></h2><LineChart points={mood} label="Humor médio por dia" /></section>
      </div>

      <div className="grid md:grid-cols-3 gap-5 mt-5">
        <section className="card">
          <h2 className="text-xl font-semibold mb-4">Funil do beta</h2>
          <Funnel steps={[{ label: "Convites gerados", value: s.invites }, { label: "Contas criadas", value: s.invUsed }, { label: "Onboarding concluído", value: s.onboarded }, { label: "1ª sessão realizada", value: s.withSession }, { label: "Voltaram (2+)", value: s.returning }]} />
        </section>
        <section className="card space-y-3">
          <h2 className="text-xl font-semibold">Como as sessões terminam</h2>
          <Bar label="Encerradas pela IA (despedida)" value={s.byAgent} total={s.sessionsEnded} />
          <Bar label="Encerradas pelo paciente" value={s.byPatient} total={s.sessionsEnded} tone="bg-night" />
          <Bar label="Limite de tempo" value={s.byTime} total={s.sessionsEnded} tone="bg-amber-500" />
          <Bar label="Falha técnica / abandono" value={s.byTech} total={s.sessionsEnded} tone="bg-coral" />
        </section>
        <section className="card space-y-3">
          <h2 className="text-xl font-semibold">Sinais clínicos (agregado)</h2>
          <div className="flex justify-between text-sm"><span>Humor médio início → fim</span><strong>{s.moodStart ?? "—"} → {s.moodEnd ?? "—"}</strong></div>
          <div className="flex justify-between text-sm"><span>PHQ-2/GAD-2 ≥ 3</span><strong>{s.flaggedScreen} pacientes</strong></div>
          <div className="flex justify-between text-sm"><span>Exercícios realizados</span><strong>{s.exerciseRate}%</strong></div>
          <div className="pt-1 border-t border-line text-sm">
            <p className="text-muted mb-1.5">Alertas por nível</p>
            <div className="flex gap-2">{s.riskByLevel.map((r) => <Badge key={r.level} tone={r.level >= 3 ? "alert" : r.level === 2 ? "warn" : "default"}>nível {r.level}: {r.n}</Badge>)}</div>
          </div>
          <p className="text-xs text-muted">Dados de viabilidade e adesão; não medem eficácia clínica.</p>
        </section>
      </div>

      <section className="card mt-5">
        <div className="flex items-center justify-between mb-3"><h2 className="text-xl font-semibold">Atividade recente</h2><Link href="/admin/auditoria" className="text-sm font-semibold text-teal-deep">trilha completa</Link></div>
        <ul className="text-sm divide-y divide-line">
          {recent.map((a) => <li key={a.id} className="py-2 flex gap-3"><span className="text-muted w-36 shrink-0">{fmtDateTime(a.created_at)}</span><span className="font-mono text-xs bg-sand-deep rounded px-1.5 py-0.5 self-start">{a.actor}</span><span>{a.action}</span></li>)}
          {!recent.length && <li className="py-2 text-muted">Sem atividade ainda.</li>}
        </ul>
      </section>
    </>
  );
}
