import Link from "next/link";
import { PageTitle, Badge } from "@/components/ui";
import { AlertActions } from "@/components/AdminWidgets";
import { requireAdmin } from "@/lib/auth";
import { listAlerts } from "@/lib/store";
import { fmtDateTime } from "@/lib/time";

export const dynamic = "force-dynamic";
const ORDER: Record<string, number> = { aberto: 0, em_acompanhamento: 1, resolvido: 2 };

export default async function Alerts({ searchParams }: { searchParams: Promise<{ s?: string }> }) {
  await requireAdmin();
  const filter = (await searchParams).s;
  const all = await listAlerts({}, 300);
  const rows = all.filter((a) => !filter || a.status === filter).sort((a, b) => ORDER[a.status] - ORDER[b.status] || b.level - a.level || b.id - a.id);
  const count = (s: string) => all.filter((a) => a.status === s).length;
  const tabs = [["", "Todos", all.length], ["aberto", "Abertos", count("aberto")], ["em_acompanhamento", "Em acompanhamento", count("em_acompanhamento")], ["resolvido", "Resolvidos", count("resolvido")]] as const;
  return (
    <>
      <PageTitle title="Alertas de risco" sub="Fila de supervisão humana. A IA apenas sinaliza — a avaliação e a decisão são suas. Na dúvida, entre em contato com o participante." />
      <div className="flex flex-wrap gap-2 mb-5">
        {tabs.map(([v, l, n]) => <Link key={v} href={v ? `/admin/alertas?s=${v}` : "/admin/alertas"} className={`chip ${((filter ?? "") === v) ? "!bg-night !text-white !border-ink" : ""}`}>{l} <span className="opacity-70">{n}</span></Link>)}
      </div>
      <div className="space-y-3">
        {rows.map((a) => (
          <div key={a.id} className={`card ${a.status === "aberto" ? "border-[#f1c4b8]" : ""}`}>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={a.level >= 3 ? "alert" : a.level === 2 ? "warn" : "default"}>nível {a.level}</Badge>
              <Link href={`/admin/pacientes/${a.user_id}`} className="font-semibold hover:underline">{a.user?.name}</Link>
              <Badge>{a.source.split(":")[0]}</Badge>
              <Badge tone={a.status === "aberto" ? "alert" : a.status === "resolvido" ? "good" : "dark"}>{a.status.replace("_", " ")}</Badge>
              <span className="text-sm text-muted ml-auto">{fmtDateTime(a.created_at)}</span>
            </div>
            <p className="mt-2 text-ink-soft">{a.excerpt}</p>
            {a.note && <p className="mt-1 text-sm text-muted">Nota: {a.note}</p>}
            <AlertActions id={a.id} status={a.status} />
          </div>
        ))}
        {!rows.length && <div className="card text-muted">Nenhum alerta {filter ? "neste filtro" : "registrado"}.</div>}
      </div>
    </>
  );
}
