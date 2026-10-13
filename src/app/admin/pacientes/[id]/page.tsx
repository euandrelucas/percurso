import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, Stat } from "@/components/ui";
import { AlertActions, PatientActions, ReanalyzeButton } from "@/components/AdminWidgets";
import { all, get } from "@/lib/db";
import { activeGoals, allExercises, allSessions, getAgent, getMemory, moodHistory, parseAnalysis, recentChat, screenings, sessionMessages } from "@/lib/store";
import { latestReport } from "@/lib/analysis";
import { buildChatSystem, buildVoiceInstructions } from "@/lib/prompts";
import { fmtDate, fmtDateTime, fmtDuration } from "@/lib/time";
import { config } from "@/lib/config";
import { TONES, STYLES, VOICES } from "@/lib/prompts/options";
import { SCALE_OPTIONS } from "@/lib/screening";

export const dynamic = "force-dynamic";

const Sec = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="card"><h2 className="text-xl font-semibold mb-3">{title}</h2>{children}</section>
);

export default async function PatientPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const u = get<{ id: number; name: string; email: string; status: string; onboarded: number; created_at: string; consent_at: string | null; calls_per_day: number | null }>("SELECT * FROM users WHERE id = ? AND role = 'patient'", id);
  if (!u) notFound();
  const agent = getAgent(id);
  const sessions = allSessions(id);
  const scr = screenings(id);
  const mem = getMemory(id);
  const moods = moodHistory(id, 40);
  const goals = activeGoals(id);
  const exs = allExercises(id);
  const alerts = all<{ id: number; level: number; source: string; excerpt: string; status: string; note: string | null; created_at: string }>("SELECT * FROM alerts WHERE user_id = ? ORDER BY id DESC", id);
  const report = latestReport(id);
  const chat = recentChat(id, 40);
  const done = sessions.filter((s) => s.status === "ended" && (s.duration_sec ?? 0) >= 180);
  const memEmpty = !mem.queixa_principal && !mem.contexto_de_vida;

  const nextKind = done.some((s) => s.kind === "triagem") ? "acompanhamento" : "triagem";
  let promptPreview = "";
  if (agent) {
    try {
      promptPreview = buildVoiceInstructions(id, { sessionNumber: sessions.length + 1, kind: nextKind, maxMinutes: config.sessionMaxMinutes() });
    } catch {
      promptPreview = "";
    }
  }
  const chatPrompt = agent ? buildChatSystem(id, 0).length : 0;

  return (
    <div className="space-y-6 max-w-4xl">
      <Link href="/admin/pacientes" className="text-sm text-muted">← Pacientes</Link>
      <div>
        <div className="flex items-center gap-3 flex-wrap"><h1 className="text-4xl font-semibold">{u.name}</h1>{u.status !== "active" && <Badge tone="alert">suspenso</Badge>}</div>
        <p className="text-muted mt-1">{u.email} · cadastro em {fmtDate(u.created_at)}{u.consent_at ? ` · consentimento em ${fmtDate(u.consent_at)}` : ""}</p>
      </div>

      <PatientActions id={id} status={u.status} callsPerDay={u.calls_per_day} hasReport={!!report} />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Sessões" value={done.length} />
        <Stat label="Tempo total" value={fmtDuration(done.reduce((a, s) => a + (s.duration_sec ?? 0), 0))} />
        <Stat label="Último humor" value={moods.at(-1)?.score ?? "—"} sub="0 a 10" />
        <Stat label="Alertas abertos" value={alerts.filter((a) => a.status === "aberto").length} tone={alerts.some((a) => a.status === "aberto") ? "alert" : "default"} />
      </div>

      {alerts.length > 0 && (
        <Sec title="Alertas de risco">
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
      )}

      {agent && (
        <Sec title="Agente escolhido pelo paciente">
          <p className="text-sm text-ink-soft"><strong>{agent.agent_name}</strong> · voz {VOICES.find((v) => v.id === agent.voice)?.label} · tom {TONES[agent.tone as keyof typeof TONES]?.label} · estilo {STYLES[agent.style as keyof typeof STYLES]?.label}. Chama o paciente de “{agent.preferred_name}”.</p>
          {agent.about_me && <p className="text-sm mt-2"><span className="text-muted">Sobre si:</span> {agent.about_me}</p>}
          {agent.goal_hint && <p className="text-sm mt-1"><span className="text-muted">Expectativa:</span> {agent.goal_hint}</p>}
          {agent.topics && <p className="text-sm mt-1"><span className="text-muted">Assuntos:</span> {agent.topics}</p>}
          {agent.boundaries && <p className="text-sm mt-1"><span className="text-muted">Prefere evitar:</span> {agent.boundaries}</p>}
        </Sec>
      )}

      <Sec title="Triagem inicial">
        {scr.length ? (
          <ul className="text-sm space-y-1.5">
            {scr.map((s, i) => (
              <li key={i} className="flex gap-2 items-center flex-wrap">
                <strong className="uppercase w-24">{s.kind === "seguranca" ? "Segurança" : s.kind}</strong>
                {s.kind === "seguranca" ? <span>{s.score ? "Respondeu SIM a pensamentos de se machucar" : "Respondeu não"}</span> : <span>escore {s.score}/6 {s.flagged ? <Badge tone="warn">acima do ponto de atenção (≥3)</Badge> : null} <span className="text-muted">({(JSON.parse(s.answers) as number[]).map((a) => SCALE_OPTIONS[a]).join(" · ")})</span></span>}
                <span className="text-muted ml-auto text-xs">{fmtDate(s.created_at)}</span>
              </li>
            ))}
          </ul>
        ) : <p className="text-muted text-sm">Sem dados.</p>}
      </Sec>

      <Sec title="Contexto do caso (memória do agente)">
        {memEmpty ? <p className="text-muted text-sm">Ainda vazio — será preenchido após a primeira sessão.</p> : (
          <dl className="text-sm space-y-2">
            {([["Queixa principal", mem.queixa_principal], ["Contexto de vida", mem.contexto_de_vida], ["Histórico relevante", mem.historico_relevante], ["Rede de apoio", mem.rede_de_apoio], ["Comunicação", mem.preferencias_de_comunicacao]] as const).filter(([, v]) => v).map(([k, v]) => <div key={k}><dt className="text-muted">{k}</dt><dd>{v}</dd></div>)}
            {([["Temas recorrentes", mem.temas_recorrentes], ["Forças e recursos", mem.forcas_e_recursos], ["O que funciona", mem.o_que_funciona], ["O que evitar", mem.o_que_evitar], ["Padrões (hipóteses da IA)", mem.padroes]] as const).filter(([, v]) => v.length).map(([k, v]) => <div key={k}><dt className="text-muted">{k}</dt><dd><ul className="list-disc pl-5">{v.map((x) => <li key={x}>{x}</li>)}</ul></dd></div>)}
          </dl>
        )}
      </Sec>

      <div className="grid md:grid-cols-2 gap-6">
        <Sec title="Metas">{goals.length ? <ul className="text-sm space-y-1.5">{goals.map((g) => <li key={g.id} className="flex gap-2"><Badge tone={g.status === "atingida" ? "good" : "default"}>{g.status}</Badge>{g.title}</li>)}</ul> : <p className="text-sm text-muted">Nenhuma meta.</p>}</Sec>
        <Sec title="Exercícios">{exs.length ? <ul className="text-sm space-y-2">{exs.map((e) => <li key={e.id}><Badge tone={e.status === "feito" ? "good" : e.status === "pendente" ? "warn" : "default"}>{e.status.replace("_", " ")}</Badge> <strong>{e.title}</strong>{e.feedback && <span className="block text-xs text-muted mt-0.5">“{e.feedback}”</span>}</li>)}</ul> : <p className="text-sm text-muted">Nenhum exercício.</p>}</Sec>
      </div>

      <Sec title="Sessões">
        {!sessions.length && <p className="text-muted text-sm">Nenhuma sessão ainda.</p>}
        <div className="space-y-3">
          {sessions.map((s) => {
            const a = parseAnalysis(s);
            const msgs = sessionMessages(s.id);
            return (
              <details key={s.id} className="rounded-xl border border-line p-4">
                <summary className="cursor-pointer flex flex-wrap items-center gap-2">
                  <strong>Sessão {s.number}</strong><Badge tone={s.kind === "triagem" ? "warn" : "good"}>{s.kind}</Badge>
                  {s.status === "active" && <Badge tone="dark">em andamento</Badge>}
                  {a && a.risco.nivel >= 1 && <Badge tone={a.risco.nivel >= 3 ? "alert" : "warn"}>risco {a.risco.nivel}</Badge>}
                  <span className="text-sm text-muted ml-auto">{fmtDateTime(s.started_at)} · {fmtDuration(s.duration_sec)}{s.end_reason ? ` · ${s.end_reason}` : ""}</span>
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
                      <p className="text-muted">Humor {a.humor_estimado_inicio ?? "—"} → {a.humor_estimado_fim ?? "—"} · técnicas: {a.tecnicas_usadas.join(", ") || "—"} · prompt {s.prompt_version}</p>
                    </>
                  ) : <p className="text-muted">Sem análise.</p>}
                  {s.status === "ended" && <ReanalyzeButton id={s.id} />}
                  {msgs.length > 0 && (
                    <details><summary className="cursor-pointer font-semibold text-teal-deep">Transcrição ({msgs.length} falas)</summary>
                      <div className="mt-3 space-y-2 max-h-96 overflow-y-auto">{msgs.map((m) => <p key={m.id}><strong>{m.role === "assistant" ? agent?.agent_name ?? "IA" : "Paciente"}:</strong> <span className="text-ink-soft">{m.content}</span></p>)}</div>
                    </details>
                  )}
                </div>
              </details>
            );
          })}
        </div>
      </Sec>

      {chat.length > 0 && (
        <Sec title="Mensagens de emergência (chat)">
          <div className="space-y-1.5 text-sm max-h-96 overflow-y-auto">{chat.map((m) => <p key={m.id}><span className="text-xs text-muted">{fmtDateTime(m.created_at)}</span> <strong>{m.role === "assistant" ? agent?.agent_name ?? "IA" : "Paciente"}:</strong> <span className="text-ink-soft whitespace-pre-line">{m.content}</span></p>)}</div>
        </Sec>
      )}

      {report && (
        <Sec title="Último relatório">
          <p className="text-sm text-muted">Gerado em {fmtDateTime(report.created_at)}. <a className="text-teal-deep font-semibold" href={`/api/admin/users/${id}/pdf`}>Baixar PDF</a></p>
        </Sec>
      )}

      {promptPreview && (
        <details className="card">
          <summary className="cursor-pointer font-semibold">Prompt montado para a próxima chamada ({promptPreview.length.toLocaleString("pt-BR")} caracteres · chat: {chatPrompt.toLocaleString("pt-BR")})</summary>
          <p className="text-xs text-muted mt-2">É exatamente isto que o modelo recebe: persona + regras de conversa + memória + roteiro da sessão + segurança. Útil para auditar e depurar o comportamento.</p>
          <pre className="mt-3 text-xs whitespace-pre-wrap bg-sand rounded-xl p-4 max-h-[500px] overflow-auto">{promptPreview}</pre>
        </details>
      )}
    </div>
  );
}
