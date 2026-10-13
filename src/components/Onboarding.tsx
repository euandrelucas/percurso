"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { AboutFields, IdentityFields, PersonalityFields, defaultAgentForm, type AgentForm } from "./AgentFields";
import { Avatar } from "./Avatar";
import { GAD2, PHQ2, SCALE_OPTIONS } from "@/lib/screening";
import { Logo } from "./ui";
import { CRISIS_RESOURCES } from "@/lib/prompts/safety";

const STEPS = ["Boas-vindas", "Triagem rápida", "Seu acompanhante", "Jeito de conversar", "Sobre você"];

function Scale({ title, items, values, onChange }: { title: string; items: string[]; values: (number | null)[]; onChange: (i: number, v: number) => void }) {
  return (
    <fieldset className="space-y-4">
      <legend className="text-sm text-muted mb-2">{title}</legend>
      {items.map((q, i) => (
        <div key={q}>
          <p className="font-medium mb-2">{q}</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {SCALE_OPTIONS.map((o, v) => (
              <button key={o} type="button" className="choice !py-2 !px-3 text-sm" aria-pressed={values[i] === v} onClick={() => onChange(i, v)}>{o}</button>
            ))}
          </div>
        </div>
      ))}
    </fieldset>
  );
}

export function Onboarding({ userName }: { userName: string }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<AgentForm>(() => defaultAgentForm(userName.split(" ")[0]));
  const [consent, setConsent] = useState({ adult: false, ai: false, privacy: false, study: false });
  const [phq, setPhq] = useState<(number | null)[]>([null, null]);
  const [gad, setGad] = useState<(number | null)[]>([null, null]);
  const [selfHarm, setSelfHarm] = useState<"sim" | "nao" | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<null | { crisis: boolean }>(null);
  const set = (p: Partial<AgentForm>) => setForm((f) => ({ ...f, ...p }));

  const canNext = [
    Object.values(consent).every(Boolean),
    phq.every((v) => v !== null) && gad.every((v) => v !== null) && selfHarm !== null,
    form.agent_name.trim().length > 0,
    true,
    form.preferred_name.trim().length > 0,
  ][step];

  async function finish() {
    setBusy(true);
    setErr("");
    const res = await fetch("/api/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, consent: true, adult: true, phq2: phq, gad2: gad, selfHarm }),
    });
    const j = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setErr(j.error ?? "Algo deu errado.");
    setDone({ crisis: !!j.crisis });
  }

  if (done) {
    return (
      <main className="min-h-dvh grid place-items-center px-5 py-10">
        <div className="max-w-md w-full text-center fade-up">
          <div className="w-48 h-48 mx-auto rounded-full overflow-hidden border-4 border-white shadow-lg">
            <Avatar avatar={form.avatar} className="w-full h-full" />
          </div>
          <h1 className="text-4xl font-semibold mt-6">Conheça {form.agent_name}</h1>
          <p className="text-ink-soft mt-3 leading-relaxed">Tudo pronto, {form.preferred_name}. {form.agent_name} já sabe como você gosta de conversar. Sua primeira sessão será uma conversa de apresentação, sem pressa.</p>
          {done.crisis && (
            <div className="mt-5 rounded-2xl bg-coral-soft border border-crisis-line p-4 text-left text-sm text-ink-soft">
              <strong className="text-ink">Obrigado por ter sido sincero(a).</strong> Você marcou que anda tendo pensamentos difíceis. A equipe foi avisada e vai acompanhar com cuidado. Se piorar, ligue <strong>188</strong> (CVV, 24h) ou <strong>192</strong> (SAMU), a qualquer hora.
            </div>
          )}
          <button className="btn btn-primary mt-7" onClick={() => { router.push("/app"); router.refresh(); }}>Ir para o meu espaço</button>
        </div>
      </main>
    );
  }

  return (
    <main className="max-w-3xl mx-auto px-5 py-8">
      <div className="flex items-center justify-between mb-8"><Logo href="/onboarding" /><span className="text-sm text-muted">Passo {step + 1} de {STEPS.length}</span></div>
      <div className="flex gap-1.5 mb-8" aria-hidden>{STEPS.map((_, i) => <div key={i} className={`h-1.5 flex-1 rounded-full ${i <= step ? "bg-teal" : "bg-sand-deep"}`} />)}</div>

      <div className="card !p-6 md:!p-8 fade-up" key={step}>
        <h1 className="text-3xl font-semibold mb-1">{["Antes de começar", "Uma triagem rápida", "Crie o seu acompanhante", "Como vocês vão conversar", "Um pouco sobre você"][step]}</h1>
        <p className="text-muted mb-6">{["Combinados importantes, em linguagem simples.", "Quatro perguntinhas para o seu acompanhante te conhecer melhor. Leva um minuto.", "Escolha nome, voz e aparência. Você pode mudar quando quiser.", "Personalize o jeito como vocês vão conversar.", "Tudo opcional, exceto o seu nome."][step]}</p>

        {step === 0 && (
          <div className="space-y-5">
            <ul className="space-y-3 text-ink-soft leading-relaxed">
              <li><strong className="text-ink">É uma IA.</strong> Seu acompanhante é uma inteligência artificial de apoio emocional. Não é um psicólogo humano, não faz diagnóstico e não substitui atendimento profissional.</li>
              <li><strong className="text-ink">Um estudo entre convidados.</strong> Você faz parte de um estudo fechado, com um grupo pequeno de pessoas. O objetivo é entender se esta ferramenta ajuda e como melhorá-la.</li>
              <li><strong className="text-ink">Suas conversas são criptografadas.</strong> Tudo o que você escreve ou fala fica criptografado no servidor, e o acesso é restrito à pessoa que coordena o estudo. Suas conversas não são lidas no dia a dia, não são vendidas e não são usadas em anúncios.</li>
              <li><strong className="text-ink">No fim do estudo.</strong> Quando ele terminar, as conversas e os resumos poderão ser analisados pela pessoa responsável pela pesquisa, para avaliar a ferramenta. Qualquer divulgação de resultados será feita sem identificar você.</li>
              <li><strong className="text-ink">Se houver risco.</strong> Se a IA perceber risco à sua vida ou à de outras pessoas, a pessoa responsável é avisada e pode ver o trecho da conversa relacionado, para tentar te ajudar.</li>
              <li><strong className="text-ink">Em emergência, procure ajuda humana:</strong> {CRISIS_RESOURCES.cvv}; {CRISIS_RESOURCES.samu}; ou {CRISIS_RESOURCES.upa}.</li>
              <li><strong className="text-ink">Você pode sair quando quiser.</strong> Sem justificativa.</li>
            </ul>
            <div className="space-y-2.5 pt-2">
              {[
                ["adult", "Tenho 18 anos ou mais."],
                ["ai", "Entendo que estou conversando com uma IA e que ela não substitui um profissional de saúde."],
                ["privacy", "Li e entendi como meus dados são tratados: criptografia, uso no fim do estudo e a exceção para situações de risco."],
                ["study", "Aceito participar deste estudo fechado e que, ao final dele, minhas conversas sejam analisadas pela pessoa responsável pela pesquisa."],
              ].map(([k, t]) => (
                <label key={k} className="flex items-start gap-3 cursor-pointer">
                  <input type="checkbox" className="mt-1 w-5 h-5 accent-teal" checked={consent[k as keyof typeof consent]} onChange={(e) => setConsent({ ...consent, [k]: e.target.checked })} />
                  <span>{t}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-8">
            <Scale title={PHQ2.title} items={PHQ2.items} values={phq} onChange={(i, v) => setPhq((p) => p.map((x, j) => (j === i ? v : x)))} />
            <Scale title={GAD2.title} items={GAD2.items} values={gad} onChange={(i, v) => setGad((p) => p.map((x, j) => (j === i ? v : x)))} />
            <fieldset>
              <legend className="font-medium mb-2">Nas últimas semanas, você pensou em se machucar ou que seria melhor não estar aqui?</legend>
              <div className="grid grid-cols-2 gap-2 max-w-sm">
                <button type="button" className="choice text-center" aria-pressed={selfHarm === "nao"} onClick={() => setSelfHarm("nao")}>Não</button>
                <button type="button" className="choice text-center" aria-pressed={selfHarm === "sim"} onClick={() => setSelfHarm("sim")}>Sim</button>
              </div>
              {selfHarm === "sim" && (
                <p className="mt-3 text-sm rounded-xl bg-coral-soft p-3 text-ink-soft">Obrigado por contar. Você pode continuar, e a equipe vai acompanhar com cuidado. Se estiver em perigo agora, ligue <strong>188</strong> (CVV) ou <strong>192</strong> (SAMU).</p>
              )}
            </fieldset>
          </div>
        )}

        {step === 2 && <IdentityFields form={form} set={set} />}
        {step === 3 && <PersonalityFields form={form} set={set} />}
        {step === 4 && <AboutFields form={form} set={set} />}

        {err && <p role="alert" className="mt-5 text-sm text-coral-ink bg-coral-soft rounded-xl px-3 py-2">{err}</p>}
        <div className="mt-8 flex justify-between">
          <button className="btn btn-ghost" disabled={step === 0 || busy} onClick={() => setStep(step - 1)}>Voltar</button>
          {step < STEPS.length - 1 ? (
            <button className="btn btn-primary" disabled={!canNext} onClick={() => setStep(step + 1)}>Continuar</button>
          ) : (
            <button className="btn btn-primary" disabled={!canNext || busy} onClick={finish}>{busy ? "Salvando…" : "Concluir"}</button>
          )}
        </div>
      </div>
    </main>
  );
}
