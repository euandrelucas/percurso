import { apiUser } from "@/lib/auth";
import { bad, json, parseBody } from "@/lib/api";
import { audit, prisma } from "@/lib/prisma";
import { alertActionSchema } from "@/lib/schemas";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const admin = await apiUser("admin");
  if (!admin) return bad("Não autorizado", 403);
  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id)) return bad("Alerta não encontrado", 404);
  const [b, err] = await parseBody(req, alertActionSchema, "Status inválido");
  if (err) return err;
  const r = await prisma.alert.updateMany({ where: { id }, data: { status: b.status, note: b.note || null, handled_at: new Date() } });
  if (!r.count) return bad("Alerta não encontrado", 404);
  await audit(`admin:${admin.id}`, "alert.handled", null, { id, status: b.status });
  return json({ ok: true });
}
