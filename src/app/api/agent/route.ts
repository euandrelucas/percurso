import { apiUser } from "@/lib/auth";
import { bad, json, readJson } from "@/lib/api";
import { audit, run } from "@/lib/db";
import { parseAgentInput } from "@/lib/agent-input";

export async function PUT(req: Request) {
  const user = await apiUser("patient");
  if (!user) return bad("Não autenticado", 401);
  const b = await readJson(req);
  if (!b) return bad("Requisição inválida");
  const i = parseAgentInput(b);
  if (!i.preferred_name) return bad("Diga como você gosta de ser chamado(a).");
  run(
    `UPDATE agent_settings SET preferred_name=?, agent_name=?, voice=?, tone=?, style=?, formality=?, humor=?, pace=?, avatar=?, about_me=?, topics=?, boundaries=?, goal_hint=?, updated_at=datetime('now') WHERE user_id=?`,
    i.preferred_name, i.agent_name, i.voice, i.tone, i.style, i.formality, i.humor, i.pace, i.avatar, i.about_me, i.topics, i.boundaries, i.goal_hint, user.id,
  );
  audit("patient", "agent.updated", user.id);
  return json({ ok: true });
}
