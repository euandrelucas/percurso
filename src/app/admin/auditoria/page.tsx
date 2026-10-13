import Link from "next/link";
import { PageTitle, Badge } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { fmtDateTime } from "@/lib/time";

export const dynamic = "force-dynamic";
export const metadata = { title: "Auditoria" };
const PAGE = 50;

export default async function Audit({ searchParams }: { searchParams: Promise<{ p?: string; a?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.p) || 1);
  const actor = sp.a === "admin" ? { actor: { startsWith: "admin" } } : sp.a === "system" ? { actor: "system" } : sp.a === "patient" ? { actor: "patient" } : {};
  const [rows, total] = await Promise.all([prisma.auditLog.findMany({ where: actor, orderBy: { id: "desc" }, take: PAGE, skip: (page - 1) * PAGE }), prisma.auditLog.count({ where: actor })]);
  const pages = Math.max(1, Math.ceil(total / PAGE));
  const q = (p: number, a = sp.a) => `/admin/auditoria?p=${p}${a ? `&a=${a}` : ""}`;
  return (
    <>
      <PageTitle title="Trilha de auditoria" sub="Registro append-only de tudo que acontece: logins, acessos de admin a dados de pacientes, alertas, relatórios e mudanças de conta." />
      <div className="flex flex-wrap gap-2 mb-4">
        {[["", "Tudo"], ["admin", "Admin"], ["patient", "Pacientes"], ["system", "Sistema"]].map(([v, l]) => <Link key={v} href={q(1, v)} className={`chip ${(sp.a ?? "") === v ? "!bg-night !text-white !border-ink" : ""}`}>{l}</Link>)}
      </div>
      <div className="card !p-0 overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-muted border-b border-line"><th className="p-3">Quando</th><th className="p-3">Ator</th><th className="p-3">Ação</th><th className="p-3">Paciente</th><th className="p-3">IP</th><th className="p-3">Detalhe</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-line last:border-0 align-top">
                <td className="p-3 whitespace-nowrap text-muted">{fmtDateTime(r.created_at)}</td>
                <td className="p-3"><Badge tone={r.actor.startsWith("admin") ? "dark" : "default"}>{r.actor}</Badge></td>
                <td className="p-3 font-mono text-xs">{r.action}</td>
                <td className="p-3">{r.user_id ? <Link href={`/admin/pacientes/${r.user_id}`} className="text-teal-deep hover:underline">#{r.user_id}</Link> : "—"}</td>
                <td className="p-3 text-muted">{r.ip ?? "—"}</td>
                <td className="p-3 font-mono text-xs text-muted max-w-xs truncate">{r.detail ? JSON.stringify(r.detail) : ""}</td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={6} className="p-6 text-muted">Sem registros.</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between mt-4 text-sm text-muted">
        <span>{total} registros · página {page} de {pages}</span>
        <div className="flex gap-2">{page > 1 && <Link className="btn btn-ghost !py-1.5" href={q(page - 1)}>← Anterior</Link>}{page < pages && <Link className="btn btn-ghost !py-1.5" href={q(page + 1)}>Próxima →</Link>}</div>
      </div>
    </>
  );
}
