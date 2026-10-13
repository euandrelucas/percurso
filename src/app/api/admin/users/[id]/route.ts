import { apiUser, revokeAllSessions } from "@/lib/auth";
import { bad, json, parseBody } from "@/lib/api";
import { audit, prisma } from "@/lib/prisma";
import { userActionSchema } from "@/lib/schemas";

/** Ações do admin sobre um paciente: suspender/reativar e ajustar limite diário de chamadas. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const admin = await apiUser("admin");
  if (!admin) return bad("Não autorizado", 403);
  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id)) return bad("Paciente não encontrado", 404);
  const [b, err] = await parseBody(req, userActionSchema, "Ação inválida");
  if (err) return err;
  const where = { id, role: "patient" };
  let n = 0;
  if (b.action === "suspend") {
    n = (await prisma.user.updateMany({ where, data: { status: "suspended" } })).count;
    await revokeAllSessions(id);
  } else if (b.action === "reactivate") n = (await prisma.user.updateMany({ where, data: { status: "active", failed_logins: 0, locked_until: null } })).count;
  else n = (await prisma.user.updateMany({ where, data: { calls_per_day: b.value } })).count;
  if (!n) return bad("Paciente não encontrado", 404);
  await audit(`admin:${admin.id}`, `user.${b.action}`, id, b.action === "calls_per_day" ? { value: b.value } : undefined);
  return json({ ok: true });
}
