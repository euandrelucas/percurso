import Link from "next/link";
import { requirePatient } from "@/lib/auth";
import { PageTitle, Badge } from "@/components/ui";
import { allSessions, parseAnalysis } from "@/lib/store";
import { fmtDateTime, fmtDuration } from "@/lib/time";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sessões" };

export default async function Sessions() {
  const u = await requirePatient();
  const list = allSessions(u.id);
  return (
    <>
      <PageTitle title="Suas sessões" sub="Um registro do seu percurso: o que foi conversado e o que ficou combinado." />
      {!list.length && <div className="card text-muted">Você ainda não fez nenhuma sessão.</div>}
      <ul className="space-y-3">
        {list.map((s) => {
          const a = parseAnalysis(s);
          return (
            <li key={s.id}>
              <Link href={`/app/sessoes/${s.id}`} className="card block hover:border-teal transition-colors">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="serif text-xl font-semibold">Sessão {s.number}</span>
                  <Badge tone={s.kind === "triagem" ? "warn" : "good"}>{s.kind === "triagem" ? "Primeira conversa" : "Acompanhamento"}</Badge>
                  {s.status === "active" && <Badge tone="dark">em andamento</Badge>}
                  <span className="text-sm text-muted ml-auto">{fmtDateTime(s.started_at)} · {fmtDuration(s.duration_sec)}</span>
                </div>
                {a && <p className="text-ink-soft mt-2 line-clamp-2">{a.resumo}</p>}
              </Link>
            </li>
          );
        })}
      </ul>
    </>
  );
}
