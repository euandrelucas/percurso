import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, Stat } from "@/components/ui";
import { AlertActions, PatientActions, ReanalyzeButton } from "@/components/AdminWidgets";
import { LineChart } from "@/components/charts";
import { requireAdmin } from "@/lib/auth";
import { audit, prisma } from "@/lib/prisma";
import { buildDossier } from "@/lib/report-data";
import { getReport, listAlerts } from "@/lib/store";
import { buildChatSystem, buildVoiceInstructions } from "@/lib/prompts";
import { fmtDateTime } from "@/lib/time";
import { config } from "@/lib/config";
import { AvatarThumb } from "@/components/Avatar";
import type { ReportData } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "Paciente" };

const Sec = ({ id, title, children }: { id: string; title: string; children: React.ReactNode }) => (
  <section id={id} className="card scroll-mt-6"><h2 className="text-xl font-semibold mb-3">{title}</h2>{children}</section>
);

export default async function PatientPage({ params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const exists = await prisma.user.findFirst({ where: { id, role: "patient" }, select: { id: true, status: true, calls_per_day: true } });
  if (!exists) notFound();
  await audit(`admin:${admin.id}`, "patient.viewed", id); // todo acesso de admin a dados de paciente fica registrado

  const [d, alerts, report] = await Promise.all([buildDossier(id), listAlerts({ user_id: id }, 100), getReport<ReportData>(id)]);
  const doneSessions = d.sessions.filter((s) => s.status === "ended" && s.durationSec >= 180);
  const nextKind = doneSessions.some((s) => s.kind === "triagem") ? "acompanhamento" : "triagem";
  let promptPreview = "";
  let chatLen = 0;
  if (d.agent) {
    try {
      promptPreview = await buildVoiceInstructions(id, { sessionNumber: d.sessions.length + 1, kind: nextKind, maxMinutes: config.sessionMaxMinutes() });
      chatLen = (await buildChatSystem(id, 0)).length;
    } catch {
      /* sem agente */
    }
  }
  const mem = d.memory;
  const memEmpty = !mem.queixa_principal && !mem.contexto_de_vida;
  const moodPoints = d.moods.slice(-30).map((m) => ({ d: m.iso, v: m.score }));
  const nav = [["resumo", "Resumo"], ["alertas", "Alertas"], ["triagem", "Triagem"], ["memoria", "Memória"], ["metas", "Metas"], ["sessoes", "Sessões"], ["chat", "Chat"], ["prompt", "Prompt"]];

  return (
    <div className="space-y-6 max-w-4xl">
      <Link href="/admin/pacientes" className="text-sm text-muted">← Pacientes</Link>
      <div className="flex items-center gap-4">
        {d.agent && <AvatarThumb avatar={d.agent.avatar!} size={160} className="w-16 h-16 rounded-2xl shrink-0" />}
        <div>
          <div className="flex items-center gap-3 flex-wrap"><h1 className="text-4xl font-semibold">{d.patient.name}</h1><span className="text-muted">#{d.patient.id}</span>{d.patient.status !== "active" && <Badge tone="alert">suspenso</Badge>}</div>
          <p className="text-muted mt-1">{d.patient.email} · cadastro em {d.patient.registeredAt}{d.patient.consentAt ? ` · consentimento em ${d.patient.consentAt}` : " · SEM CONSENTIMENTO"}</p>
        </div>
      </div>

      <nav className="flex flex-wrap gap-2 text-sm sticky top-0 z-10 bg-sand/90 backdrop-blur py-2" aria-label="Seções">{nav.map(([h, l]) => <a key={h} href={`#${h}`} className="chip">{l}</a>)}</nav>

      <PatientActions id={id} status={exists.status} callsPerDay={exists.calls_per_day} hasReport={!!report} />
      {report && <p className="text-sm text-muted -mt-3">Último dossiê gerado em {fmtDateTime(report.created_at)}.</p>}

      <div id="resumo" className="grid grid-cols-2 md:grid-cols-4 gap-3 scroll-mt-6">
        <Stat label="Sessões de voz" value={d.totals.sessions} sub={`${d.totals.minutes} min no total`} />
        <Stat label="Mensagens (chat)" value={d.totals.chatMessages} />
        <Stat label="Último humor" value={d.moods.at(-1)?.score ?? "—"} sub="0 a 10" />
        <Stat label="Alertas abertos" value={alerts.filter((a) => a.status === "aberto").length} tone={alerts.some((a) => a.status === "aberto") ? "alert" : "default"} sub={`${alerts.length} no total`} />
      </div>

      <Sec id="humor" title="Evolução do humor"><LineChart points={moodPoints} label="Evolução do humor" /></Sec>

      <Sec id="alertas" title="Alertas de risco">
        {!alerts.length && <p className="text-sm text-muted">Nenhum alerta registrado.</p>}
        <ul className="space-y-3">
          {alerts.map((a) => (
            <li key={a.id} className="rounded-xl border border-line p-3">
              <div className="flex items-center gap-2 flex-wrap"><Badge tone={a.level >= 3 ? "alert" : "warn"}>nível {a.level}</Badge><Badge>{a.source}</Badge><Badge tone={a.status === "aberto" ? "alert" : "good"}>{a.status.replace("_", " ")}</Badge><span className="text-xs text-muted ml-auto">{fmtDateTime(a.created_at)}</span></div>
              <p className="text-sm text-ink-soft mt-1.5">{a.excerpt}</p>
              {a.note && <p className="text-xs text-muted mt-1">Nota: {a.note}</p>}
              <AlertActions id={a.id} status={a.status} />
            </li>
          ))}
        </ul>
      </Sec>

      {d.agent && (
        <Sec id="agente" title="Agente escolhido pelo paciente">
          <p className="text-sm text-ink-soft"><strong>{d.agent.name}</strong> · voz {d.agent.voice} · tom {d.agent.tone} · estilo {d.agent.style}. Chama o paciente de “{d.agent.preferredName}”.</p>
          {d.agent.aboutMe && <p className="text-sm mt-2"><span className="text-muted">Sobre si:</span> {d.agent.aboutMe}</p>}
          {d.agent.goalHint && <p className="text-sm mt-1"><span className="text-muted">Expectativa:</span> {d.agent.goalHint}</p>}
          {d.agent.topics && <p className="text-sm mt-1"><span className="text-muted">Assuntos:</span> {d.agent.topics}</p>}
          {d.agent.boundaries && <p className="text-sm mt-1"><span className="text-muted">Prefere evitar:</span> {d.agent.boundaries}</p>}
        </Sec>
      )}

      <Sec id="triagem" title="Triagem inicial">
        {d.screenings.length ? (
          <ul className="text-sm space-y-1.5">
            {d.screenings.map((s, i) => (
              <li key={i} className="flex gap-2 items-center flex-wrap">
                <strong className="w-28">{s.kind === "seguranca" ? "Segurança" : s.kind.toUpperCase()}</strong>
                {s.kind === "seguranca" ? <span>{s.flagged ? <Badge tone="alert">respondeu SIM a pensamentos de se machucar</Badge> : "respondeu não"}</span> : <span>escore {s.score}/6 {s.flagged ? <Badge tone="warn">≥ 3: ponto de atenção</Badge> : null} <span className="text-muted">({s.answers.join(" · ")})</span></span>}
                <span className="text-muted ml-auto text-xs">{s.date}</span>
              </li>
            ))}
          </ul>
        ) : <p className="text-muted text-sm">Sem dados.</p>}
      </Sec>

      <Sec id="memoria" title="Contexto do caso (memória do agente)">
        {memEmpty ? <p className="text-muted text-sm">Ainda vazio — será preenchido após a primeira sessão.</p> : (
          <dl className="text-sm space-y-2">
            {([["Queixa principal", mem.queixa_principal], ["Contexto de vida", mem.contexto_de_vida], ["Histórico relevante", mem.historico_relevante], ["Rede de apoio", mem.rede_de_apoio], ["Comunicação", mem.preferencias_de_comunicacao]] as const).filter(([, v]) => v).map(([k, v]) => <div key={k}><dt className="text-muted">{k}</dt><dd>{v}</dd></div>)}
            {([["Temas recorrentes", mem.temas_recorrentes], ["Forças e recursos", mem.forcas_e_recursos], ["O que funciona", mem.o_que_funciona], ["O que evitar", mem.o_que_evitar], ["Padrões (hipóteses da IA)", mem.padroes]] as const).filter(([, v]) => v.length).map(([k, v]) => <div key={k}><dt className="text-muted">{k}</dt><dd><ul className="list-disc pl-5">{v.map((x) => <li key={x}>{x}</li>)}</ul></dd></div>)}
          </dl>
        )}
        {d.memoryVersions.length > 0 && <p className="text-xs text-muted mt-3">{d.memoryVersions.length} versão(ões) arquivada(s) · atual v{d.memoryVersions.at(-1)?.version}</p>}
      </Sec>

      <div id="metas" className="grid md:grid-cols-2 gap-6 scroll-mt-6">
        <Sec id="metas-l" title="Metas">{d.goals.length ? <ul className="text-sm space-y-1.5">{d.goals.map((g, i) => <li key={i} className="flex gap-2"><Badge tone={g.status === "atingida" ? "good" : "default"}>{g.status}</Badge>{g.title}</li>)}</ul> : <p className="text-sm text-muted">Nenhuma meta.</p>}</Sec>
        <Sec id="ex" title="Exercícios">{d.exercises.length ? <ul className="text-sm space-y-2">{d.exercises.map((e, i) => <li key={i}><Badge tone={e.status === "feito" ? "good" : e.status === "pendente" ? "warn" : "default"}>{e.status.replace("_", " ")}</Badge> <strong>{e.title}</strong>{e.feedback && <span className="block text-xs text-muted mt-0.5">“{e.feedback}”</span>}</li>)}</ul> : <p className="text-sm text-muted">Nenhum exercício.</p>}</Sec>
      </div>

      <Sec id="sessoes" title="Sessões">
        {!d.sessions.length && <p className="text-muted text-sm">Nenhuma sessão ainda.</p>}
        <div className="space-y-3">
          {[...d.sessions].reverse().map((s) => {
            const a = s.analysis;
            return (
              <details key={s.id} className="rounded-xl border border-line p-4">
                <summary className="cursor-pointer flex flex-wrap items-center gap-2">
                  <strong>Sessão {s.number}</strong><Badge tone={s.kind === "triagem" ? "warn" : "good"}>{s.kind}</Badge>
                  {s.status === "active" && <Badge tone="dark">em andamento</Badge>}
                  {a && a.risco.nivel >= 1 && <Badge tone={a.risco.nivel >= 3 ? "alert" : "warn"}>risco {a.risco.nivel}</Badge>}
                  <span className="text-sm text-muted ml-auto">{s.started} · {s.duration}{s.endReason ? ` · ${s.endReason}` : ""}</span>
                </summary>
                <div className="mt-4 space-y-4 text-sm">
                  {a ? (
                    <>
                      <p className="leading-relaxed">{a.resumo}</p>
                      <div className="grid md:grid-cols-2 gap-4">
                        <div><h3 className="font-semibold mb-1">Fatos observados</h3><ul className="list-disc pl-5 text-ink-soft space-y-0.5">{a.fatos_observados.map((f) => <li key={f}>{f}</li>)}</ul></div>
                        <div><h3 className="font-semibold mb-1">Hipóteses <span className="font-normal text-muted">(não são fatos)</span></h3><ul className="list-disc pl-5 text-ink-soft space-y-0.5">{a.hipoteses.map((h) => <li key={h.texto}>{h.texto} <span className="text-muted">[{h.confianca}]</span></li>)}</ul></div>
                      </div>
                      <p><span className="font-semibold">Para o profissional:</span> {a.para_o_profissional}</p>
                      <p className="text-muted">Humor {a.humor_estimado_inicio ?? "—"} → {a.humor_estimado_fim ?? "—"} · técnicas: {a.tecnicas_usadas.join(", ") || "—"} · prompt {s.promptVersion}</p>
                    </>
                  ) : <p className="text-muted">Sem análise.</p>}
                  {s.status === "ended" && <ReanalyzeButton id={s.id} />}
                  {s.messages.length > 0 && (
                    <details><summary className="cursor-pointer font-semibold text-teal-deep">Transcrição ({s.messages.length} falas)</summary>
                      <div className="mt-3 space-y-2 max-h-96 overflow-y-auto">{s.messages.map((m, i) => <p key={i}><strong>{m.role === "assistant" ? d.agent?.name ?? "IA" : "Paciente"}:</strong> <span className="text-ink-soft">{m.content}</span></p>)}</div>
                    </details>
                  )}
                </div>
              </details>
            );
          })}
        </div>
      </Sec>

      <Sec id="chat" title={`Mensagens de emergência (${d.chat.length})`}>
        {d.chat.length ? <div className="space-y-1.5 text-sm max-h-96 overflow-y-auto">{d.chat.map((m, i) => <p key={i}><span className="text-xs text-muted">{m.at}</span> <strong>{m.role === "assistant" ? d.agent?.name ?? "IA" : "Paciente"}:</strong> <span className="text-ink-soft whitespace-pre-line">{m.content}</span></p>)}</div> : <p className="text-sm text-muted">Nenhuma mensagem.</p>}
      </Sec>

      {promptPreview && (
        <details id="prompt" className="card scroll-mt-6">
          <summary className="cursor-pointer font-semibold">Prompt montado para a próxima chamada ({promptPreview.length.toLocaleString("pt-BR")} caracteres · chat: {chatLen.toLocaleString("pt-BR")})</summary>
          <p className="text-xs text-muted mt-2">É exatamente isto que o modelo recebe: persona + regras de conversa + memória + roteiro da sessão + segurança. Útil para auditar e depurar o comportamento.</p>
          <pre className="mt-3 text-xs whitespace-pre-wrap bg-sand rounded-xl p-4 max-h-[500px] overflow-auto">{promptPreview}</pre>
        </details>
      )}
    </div>
  );
}
