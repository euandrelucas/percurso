import { apiUser } from "@/lib/auth";
import { bad, json, readJson, str } from "@/lib/api";
import { audit, run } from "@/lib/db";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const admin = await apiUser("admin");
  if (!admin) return bad("Não autorizado", 403);
  const id = Number((await ctx.params).id);
  const b = await readJson(req);
  const status = b?.status === "resolvido" ? "resolvido" : b?.status === "em_acompanhamento" ? "em_acompanhamento" : null;
  if (!status) return bad("Status inválido");
  run("UPDATE alerts SET status = ?, note = ?, handled_at = datetime('now') WHERE id = ?", status, str(b?.note, 500) || null, id);
  audit("admin", "alert.handled", null, { id, status });
  return json({ ok: true });
}
