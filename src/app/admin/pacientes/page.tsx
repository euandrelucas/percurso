import Link from "next/link";
import { PageTitle, Badge } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { fmtDateTime } from "@/lib/time";

export const dynamic = "force-dynamic";
export const metadata = { title: "Pacientes" };

export default async function Patients({ searchParams }: { searchParams: Promise<{ q?: string; f?: string }> }) {
  await requireAdmin();
  const { q = "", f = "" } = await searchParams;
  const term = q.trim().slice(0, 60);
  const users = await prisma.user.findMany({
    where: {
      role: "patient",
      ...(term ? { OR: [{ name: { contains: term, mode: "insensitive" } }, { email: { contains: term, mode: "insensitive" } }] } : {}),
      ...(f === "alertas" ? { alerts: { some: { status: "aberto" } } } : f === "pendente" ? { onboarded: false } : f === "suspenso" ? { status: "suspended" } : {}),
    },
    include: {
      sessions: { select: { status: true, duration_sec: true, started_at: true } },
      alerts: { where: { status: { not: "resolvido" } }, select: { level: true, status: true } },
      moods: { orderBy: { id: "desc" }, take: 1, select: { score: true } },
    },
    orderBy: { id: "desc" },
  });
  const rows = users
    .map((u) => ({
      ...u,
      n: u.sessions.filter((s) => s.status === "ended" && (s.duration_sec ?? 0) >= 180).length,
      last: u.sessions.map((s) => s.started_at).sort((a, b) => b.getTime() - a.getTime())[0] ?? null,
      open: u.alerts.filter((a) => a.status === "aberto").length,
      max: Math.max(0, ...u.alerts.map((a) => a.level)),
    }))
    .sort((a, b) => Number(b.open > 0) - Number(a.open > 0) || b.id - a.id);
  const filters = [["", "Todos"], ["alertas", "Com alerta aberto"], ["pendente", "Onboarding pendente"], ["suspenso", "Suspensos"]];
  return (
    <>
      <PageTitle title="Pacientes" sub="Acompanhamento individual de cada participante do beta." />
      <form className="flex flex-wrap gap-2 mb-4" action="/admin/pacientes">
        <input name="q" defaultValue={term} placeholder="Buscar por nome ou e-mail" className="input !w-72" aria-label="Buscar" />
        {f && <input type="hidden" name="f" value={f} />}
        <button className="btn btn-dark">Buscar</button>
        <div className="flex gap-2 flex-wrap ml-2">{filters.map(([v, l]) => <Link key={v} href={`/admin/pacientes?${term ? `q=${encodeURIComponent(term)}&` : ""}${v ? `f=${v}` : ""}`} className={`chip ${f === v ? "!bg-ink !text-white !border-ink" : ""}`}>{l}</Link>)}</div>
      </form>
      <div className="card !p-0 overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-muted border-b border-line"><th className="p-3">Paciente</th><th className="p-3">Status</th><th className="p-3">Sessões</th><th className="p-3">Última atividade</th><th className="p-3">Humor</th><th className="p-3">Alertas</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-line last:border-0 hover:bg-sand/60">
                <td className="p-3"><Link href={`/admin/pacientes/${r.id}`} className="font-semibold hover:underline">{r.name}</Link><span className="block text-xs text-muted">#{r.id} · {r.email}</span></td>
                <td className="p-3">{r.status !== "active" ? <Badge tone="alert">suspenso</Badge> : r.onboarded ? <Badge tone="good">ativo</Badge> : <Badge tone="warn">onboarding pendente</Badge>}</td>
                <td className="p-3">{r.n}</td>
                <td className="p-3 text-muted">{fmtDateTime(r.last)}</td>
                <td className="p-3">{r.moods[0]?.score ?? "—"}</td>
                <td className="p-3">{r.open ? <Badge tone={r.max >= 3 ? "alert" : "warn"}>{r.open} aberto(s)</Badge> : <span className="text-muted">—</span>}</td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={6} className="p-6 text-muted">Nenhum paciente {term || f ? "neste filtro" : "ainda. Gere um convite para começar"}.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
