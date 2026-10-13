import { apiUser } from "@/lib/auth";
import { bad, json } from "@/lib/api";
import { analyzeSession } from "@/lib/analysis";
import { getSession } from "@/lib/store";

export const maxDuration = 120;

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const admin = await apiUser("admin");
  if (!admin) return bad("Não autorizado", 403);
  const s = getSession(Number((await ctx.params).id));
  if (!s || s.status !== "ended") return bad("Sessão não encontrada ou ainda em andamento", 404);
  await analyzeSession(s.id);
  return json({ ok: true });
}
