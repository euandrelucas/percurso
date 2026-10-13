import { apiUser } from "@/lib/auth";
import { bad, json, rateLimit } from "@/lib/api";
import { analyzeSession } from "@/lib/analysis";
import { audit } from "@/lib/prisma";
import { getSession } from "@/lib/store";

export const maxDuration = 180;

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const admin = await apiUser("admin");
  if (!admin) return bad("Não autorizado", 403);
  if (!rateLimit(`analyze:${admin.id}`, 20, 10 * 60_000)) return bad("Muitas análises em sequência.", 429);
  const id = Number((await ctx.params).id);
  const s = Number.isInteger(id) ? await getSession(id) : null;
  if (!s || s.status !== "ended") return bad("Sessão não encontrada ou ainda em andamento", 404);
  await analyzeSession(s.id);
  await audit(`admin:${admin.id}`, "session.reanalyzed", s.user_id, { id: s.id });
  return json({ ok: true });
}
