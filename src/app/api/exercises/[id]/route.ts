import { apiUser } from "@/lib/auth";
import { bad, json, parseBody } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { exerciseSchema } from "@/lib/schemas";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await apiUser("patient");
  if (!user) return bad("Não autenticado", 401);
  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id)) return bad("Exercício não encontrado", 404);
  const [b, err] = await parseBody(req, exerciseSchema, "Status inválido");
  if (err) return err;
  // Filtro por user_id: um paciente nunca altera exercício de outro.
  const r = await prisma.exercise.updateMany({ where: { id, user_id: user.id }, data: { status: b.status, feedback: b.feedback || null, completed_at: b.status === "feito" ? new Date() : null } });
  return r.count ? json({ ok: true }) : bad("Exercício não encontrado", 404);
}
