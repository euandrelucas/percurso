import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePatient } from "@/lib/auth";
import { Badge } from "@/components/ui";
import { getSession, parseAnalysis, sessionMessages } from "@/lib/store";
import { fmtDateTime, fmtDuration } from "@/lib/time";

export const dynamic = "force-dynamic";

export default async function SessionDetail({ params }: { params: Promise<{ id: string }> }) {
  const u = await requirePatient();
  const sid = Number((await params).id);
  const s = Number.isInteger(sid) ? await getSession(sid) : null;
  if (!s || s.user_id !== u.id) notFound();
  const a = parseAnalysis(s);
  const msgs = await sessionMessages(s.id);
  return (
    <div className="space-y-6 max-w-3xl">
      <Link href="/app/sessoes" className="text-sm text-muted">← Voltar</Link>
      <div>
        <h1 className="text-4xl font-semibold">Sessão {s.number}</h1>
        <p className="text-muted mt-1">{fmtDateTime(s.started_at)} · {fmtDuration(s.duration_sec)}</p>
      </div>
      {a ? (
        <>
          <section className="card"><h2 className="text-xl font-semibold mb-2">Resumo</h2><p className="leading-relaxed text-ink-soft">{a.resumo}</p>
            {a.temas.length > 0 && <div className="mt-3 flex flex-wrap gap-1.5">{a.temas.map((t) => <Badge key={t}>{t}</Badge>)}</div>}</section>
          {a.exercicio && <section className="card"><h2 className="text-xl font-semibold mb-1">Exercício combinado</h2><p className="font-semibold">{a.exercicio.titulo}</p><p className="text-ink-soft mt-1">{a.exercicio.descricao}</p></section>}
          {a.metas.length > 0 && <section className="card"><h2 className="text-xl font-semibold mb-2">Metas</h2><ul className="list-disc pl-5 space-y-1 text-ink-soft">{a.metas.map((m) => <li key={m.titulo}>{m.titulo}</li>)}</ul></section>}
        </>
      ) : (
        <div className="card text-muted">{s.status === "active" ? "Esta sessão ainda está em andamento." : "O resumo desta sessão está sendo preparado. Volte em instantes."}</div>
      )}
      {msgs.length > 0 && (
        <details className="card">
          <summary className="cursor-pointer font-semibold">Ver transcrição</summary>
          <div className="mt-4 space-y-3 text-sm">
            {msgs.map((m) => (
              <p key={m.id}><span className="font-semibold">{m.role === "assistant" ? "Acompanhante" : "Você"}:</span> <span className="text-ink-soft">{m.content}</span></p>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
