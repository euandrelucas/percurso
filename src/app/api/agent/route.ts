import { apiUser } from "@/lib/auth";
import { bad, json, readJson } from "@/lib/api";
import { audit, prisma } from "@/lib/prisma";
import { parseAgentInput } from "@/lib/agent-input";

export async function PUT(req: Request) {
  const user = await apiUser("patient");
  if (!user) return bad("Não autenticado", 401);
  const b = await readJson(req);
  if (!b || typeof b !== "object") return bad("Requisição inválida");
  const i = parseAgentInput(b as Record<string, unknown>);
  if (!i.preferred_name) return bad("Diga como você gosta de ser chamado(a).");
  await prisma.agentSettings.update({ where: { user_id: user.id }, data: i });
  await audit("patient", "agent.updated", user.id);
  return json({ ok: true });
}
