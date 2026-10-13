import Link from "next/link";
import { requirePatient } from "@/lib/auth";
import { CallRoom } from "@/components/CallRoom";
import { config } from "@/lib/config";
import { callAvailability, getAgent, hasCompletedSession } from "@/lib/store";
import { reapStale } from "@/lib/sessions";
import { parseAvatar } from "@/lib/prompts/options";

export const dynamic = "force-dynamic";
export const metadata = { title: "Chamada" };

export default async function Page() {
  const u = await requirePatient();
  reapStale(u.id);
  const a = getAgent(u.id)!;
  const { available, resumable } = callAvailability(u);
  if (!available) {
    return (
      <div className="card max-w-lg mx-auto text-center py-10">
        <h1 className="text-3xl font-semibold">Você já conversou hoje 💛</h1>
        <p className="text-ink-soft mt-3">A chamada de hoje já foi realizada. Amanhã ela estará liberada de novo. Se precisar de apoio antes disso, você pode mandar mensagem.</p>
        <div className="mt-6 flex justify-center gap-3"><Link href="/app/atendimento/mensagens" className="btn btn-dark">Enviar mensagem</Link><Link href="/app" className="btn btn-ghost">Voltar</Link></div>
      </div>
    );
  }
  return (
    <CallRoom
      agent={{ name: a.agent_name, avatar: parseAvatar(a.avatar), preferredName: a.preferred_name }}
      first={!hasCompletedSession(u.id)}
      maxMinutes={config.sessionMaxMinutes()}
      resumable={resumable}
    />
  );
}
