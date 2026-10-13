import { PageTitle, Badge } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { MODULES, scoreModules } from "@/lib/knowledge";
import { PROMPT_VERSION } from "@/lib/config";

export const dynamic = "force-dynamic";
export const metadata = { title: "Base de conhecimento" };

const AREAS = ["Base da relação", "Técnicas", "Temas", "Situações delicadas"] as const;

export default async function Knowledge({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireAdmin();
  const q = ((await searchParams).q ?? "").slice(0, 300);
  const hits = q ? scoreModules(q) : [];
  const words = (t: string) => t.trim().split(/\s+/).length;
  return (
    <>
      <PageTitle
        title="Base de conhecimento clínico"
        sub={`${MODULES.length} módulos que a IA usa como repertório (versão dos prompts ${PROMPT_VERSION}). Não é treinamento do modelo: é texto revisável, injetado conforme o assunto. O psicólogo responsável deve revisar e ajustar em src/lib/knowledge/modules.ts.`}
      />

      <section className="card mb-6">
        <h2 className="text-xl font-semibold mb-2">Testar ativação</h2>
        <p className="text-sm text-muted mb-3">Digite uma fala de paciente e veja quais módulos entrariam no prompt (os módulos de base e de risco entram sempre).</p>
        <form action="/admin/conhecimento" className="flex gap-2 flex-wrap">
          <input name="q" defaultValue={q} className="input flex-1 min-w-64" placeholder='Ex.: "não consigo dormir e fico remoendo o que o chefe disse"' />
          <button className="btn btn-dark">Testar</button>
        </form>
        {q && (
          <div className="mt-4 text-sm">
            {hits.length ? (
              <ul className="space-y-1.5">{hits.map((h) => <li key={h.module.id}><Badge tone={h.module.core ? "alert" : "good"}>{h.module.core ? "risco/base" : "tema"}</Badge> <strong>{h.module.titulo}</strong> <span className="text-muted">— pontos {h.score} · gatilhos: {h.matched.join(", ")}</span></li>)}</ul>
            ) : <p className="text-muted">Nenhum módulo temático ativado (a IA usa só a base).</p>}
          </div>
        )}
      </section>

      {AREAS.map((area) => (
        <section key={area} className="mb-6">
          <h2 className="text-2xl font-semibold mb-3">{area}</h2>
          <div className="space-y-2">
            {MODULES.filter((m) => m.area === area).map((m) => (
              <details key={m.id} className="card !p-4" id={m.id}>
                <summary className="cursor-pointer flex flex-wrap items-center gap-2">
                  <strong>{m.titulo}</strong>
                  {m.core && <Badge tone="dark">sempre ativo</Badge>}
                  <span className="text-xs text-muted ml-auto">{words(m.conteudo)} palavras · {m.gatilhos.length} gatilhos</span>
                </summary>
                <div className="mt-3 text-sm space-y-3">
                  <p className="whitespace-pre-line leading-relaxed text-ink-soft">{m.conteudo}</p>
                  <p><span className="font-semibold">Fontes:</span> <span className="text-muted">{m.fontes.join(" · ")}</span></p>
                  {m.gatilhos.length > 0 && <p><span className="font-semibold">Gatilhos:</span> <span className="text-muted">{m.gatilhos.join(", ")}</span></p>}
                </div>
              </details>
            ))}
          </div>
        </section>
      ))}
    </>
  );
}
