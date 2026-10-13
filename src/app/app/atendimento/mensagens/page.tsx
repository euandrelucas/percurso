import Link from "next/link";
import { requirePatient } from "@/lib/auth";
import { ChatView } from "@/components/ChatView";
import { getAgent, recentChat } from "@/lib/store";
import { parseAvatar } from "@/lib/prompts/options";

export const dynamic = "force-dynamic";
export const metadata = { title: "Mensagens" };

export default async function Page() {
  const u = await requirePatient();
  const a = getAgent(u.id)!;
  return (
    <>
      <Link href="/app/atendimento" className="text-sm text-muted">← Atendimento</Link>
      <div className="mt-3">
        <ChatView agentName={a.agent_name} avatar={parseAvatar(a.avatar)} initial={recentChat(u.id, 60).map((m) => ({ id: m.id, role: m.role, content: m.content, at: m.created_at }))} />
      </div>
    </>
  );
}
