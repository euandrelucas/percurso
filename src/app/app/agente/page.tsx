import { requirePatient } from "@/lib/auth";
import { PageTitle } from "@/components/ui";
import { AgentSettings } from "@/components/AgentSettings";
import { getAgent } from "@/lib/store";
import { parseAvatar } from "@/lib/prompts/options";

export const dynamic = "force-dynamic";
export const metadata = { title: "Meu agente" };

export default async function AgentPage() {
  const u = await requirePatient();
  const a = getAgent(u.id)!;
  return (
    <>
      <PageTitle title="Seu acompanhante" sub="Mude o nome, a voz, a aparência e o jeito de conversar quando quiser." />
      <AgentSettings initial={{ preferred_name: a.preferred_name, agent_name: a.agent_name, voice: a.voice, tone: a.tone, style: a.style, formality: a.formality, humor: a.humor, pace: a.pace, avatar: parseAvatar(a.avatar), about_me: a.about_me, topics: a.topics, boundaries: a.boundaries, goal_hint: a.goal_hint }} />
    </>
  );
}
