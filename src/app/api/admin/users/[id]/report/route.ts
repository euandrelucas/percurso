import { apiUser } from "@/lib/auth";
import { bad, json } from "@/lib/api";
import { generateReport } from "@/lib/analysis";
import { get } from "@/lib/db";

export const maxDuration = 120;

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const admin = await apiUser("admin");
  if (!admin) return bad("Não autorizado", 403);
  const id = Number((await ctx.params).id);
  if (!get("SELECT 1 FROM users WHERE id = ? AND role = 'patient'", id)) return bad("Paciente não encontrado", 404);
  try {
    const r = await generateReport(id);
    return json({ ok: true, reportId: r.id });
  } catch (e) {
    console.error("[report]", e);
    return bad("Falha ao gerar o relatório. Tente novamente.", 502);
  }
}
