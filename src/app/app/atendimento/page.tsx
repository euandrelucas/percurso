import Link from "next/link";
import { requirePatient } from "@/lib/auth";
import { PageTitle, Badge } from "@/components/ui";
import { config } from "@/lib/config";
import { callAvailability, chatToday, getAgent, hasCompletedSession } from "@/lib/store";

export const dynamic = "force-dynamic";
export const metadata = { title: "Atendimento" };

export default async function Atendimento() {
  const u = await requirePatient();
  const agent = getAgent(u.id)!;
  const { available: ok, limit } = callAvailability(u);
  const first = !hasCompletedSession(u.id);
  return (
    <>
      <PageTitle title="Atendimento" sub={`Converse com ${agent.agent_name} por voz e vídeo, ou mande mensagem quando o aperto for maior.`} />
      <div className="grid md:grid-cols-2 gap-5">
        <section className="card flex flex-col">
          <Badge tone={ok ? "good" : "default"}>{ok ? "Disponível hoje" : "Já realizada hoje"}</Badge>
          <h2 className="text-2xl font-semibold mt-3">Chamada de voz e vídeo</h2>
          <p className="text-ink-soft mt-2 flex-1">Uma conversa de até {config.sessionMaxMinutes()} minutos com {agent.agent_name}, {limit === 1 ? "uma vez por dia" : `até ${limit} vezes por dia`}. Quando o tempo estiver acabando, a conversa é encerrada com calma, nunca de repente.{first && " Esta será a sua primeira conversa, de apresentação."}</p>
          <Link href="/app/atendimento/chamada" className={`btn btn-primary mt-5 ${ok ? "" : "pointer-events-none opacity-50"}`}>{ok ? "Entrar na chamada" : "Volte amanhã"}</Link>
        </section>
        <section className="card flex flex-col">
          <Badge tone="warn">Para momentos de emergência</Badge>
          <h2 className="text-2xl font-semibold mt-3">Mensagens</h2>
          <p className="text-ink-soft mt-2 flex-1">Escreva a qualquer hora, como num app de mensagens, quando precisar de apoio rápido entre as chamadas. Hoje você pode enviar até {config.chatPerDay() - chatToday(u.id)} mensagens.</p>
          <Link href="/app/atendimento/mensagens" className="btn btn-dark mt-5">Abrir conversa</Link>
        </section>
      </div>
      <p className="text-sm text-muted mt-6">Em perigo imediato, ligue <strong>188</strong> (CVV, 24h) ou <strong>192</strong> (SAMU). Esta é uma IA de apoio e não substitui atendimento de emergência.</p>
    </>
  );
}
