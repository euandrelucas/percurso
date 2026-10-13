import Link from "next/link";
import { PageTitle, Badge } from "@/components/ui";
import { AlertActions } from "@/components/AdminWidgets";
import { all } from "@/lib/db";
import { fmtDateTime } from "@/lib/time";

export const dynamic = "force-dynamic";

export default function Alerts() {
  const rows = all<{ id: number; level: number; source: string; excerpt: string; status: string; note: string | null; created_at: string; name: string; uid: number }>(
    "SELECT a.*, u.name, u.id AS uid FROM alerts a JOIN users u ON u.id = a.user_id ORDER BY CASE a.status WHEN 'aberto' THEN 0 WHEN 'em_acompanhamento' THEN 1 ELSE 2 END, a.level DESC, a.id DESC LIMIT 200",
  );
  return (
    <>
      <PageTitle title="Alertas de risco" sub="Fila de supervisão humana. A IA apenas sinaliza — a avaliação e a decisão são suas. Na dúvida, entre em contato com o participante." />
      <div className="space-y-3">
        {rows.map((a) => (
          <div key={a.id} className={`card ${a.status === "aberto" ? "border-[#f1c4b8]" : ""}`}>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={a.level >= 3 ? "alert" : a.level === 2 ? "warn" : "default"}>nível {a.level}</Badge>
              <Link href={`/admin/pacientes/${a.uid}`} className="font-semibold hover:underline">{a.name}</Link>
              <Badge>{a.source.split(":")[0]}</Badge>
              <Badge tone={a.status === "aberto" ? "alert" : a.status === "resolvido" ? "good" : "dark"}>{a.status.replace("_", " ")}</Badge>
              <span className="text-sm text-muted ml-auto">{fmtDateTime(a.created_at)}</span>
            </div>
            <p className="mt-2 text-ink-soft">{a.excerpt}</p>
            {a.note && <p className="mt-1 text-sm text-muted">Nota: {a.note}</p>}
            <AlertActions id={a.id} status={a.status} />
          </div>
        ))}
        {!rows.length && <div className="card text-muted">Nenhum alerta registrado. 🎉</div>}
      </div>
    </>
  );
}
