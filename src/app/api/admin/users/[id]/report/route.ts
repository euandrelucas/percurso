import { apiUser } from "@/lib/auth";
import { bad, json, rateLimit } from "@/lib/api";
import { generateReport } from "@/lib/analysis";
import { prisma } from "@/lib/prisma";

export const maxDuration = 180;

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const admin = await apiUser("admin");
  if (!admin) return bad("Não autorizado", 403);
  if (!rateLimit(`report:${admin.id}`, 10, 10 * 60_000)) return bad("Muitos relatórios em sequência. Aguarde um pouco.", 429);
  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id) || !(await prisma.user.findFirst({ where: { id, role: "patient" }, select: { id: true } }))) return bad("Paciente não encontrado", 404);
  try {
    const r = await generateReport(id, `admin:${admin.id}`);
    return json({ ok: true, reportId: r.id });
  } catch (e) {
    console.error("[report]", e);
    return bad("Falha ao gerar o relatório. Tente novamente.", 502);
  }
}
