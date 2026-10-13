import { bad, json, parseBody, rateLimit } from "@/lib/api";
import { createSession, currentUser, requestIp, revokeAllSessions } from "@/lib/auth";
import { audit, prisma } from "@/lib/prisma";
import { hashPassword, passwordProblem, verifyPassword } from "@/lib/password";
import { passwordChangeSchema } from "@/lib/schemas";

/** Troca de senha: exige a senha atual e encerra todas as outras sessões. */
export async function POST(req: Request) {
  const me = await currentUser();
  if (!me) return bad("Não autenticado", 401);
  if (!rateLimit(`pw:${me.id}`, 5, 15 * 60_000)) return bad("Muitas tentativas.", 429);
  const [b, err] = await parseBody(req, passwordChangeSchema);
  if (err) return err;
  const u = await prisma.user.findUniqueOrThrow({ where: { id: me.id } });
  if (!(await verifyPassword(b.current, u.password_hash))) return bad("Senha atual incorreta.", 403);
  const problem = passwordProblem(b.next);
  if (problem) return bad(problem);
  await prisma.user.update({ where: { id: u.id }, data: { password_hash: await hashPassword(b.next) } });
  await revokeAllSessions(u.id);
  await createSession(u.id, u.role, { ip: await requestIp() });
  await audit(u.role === "admin" ? `admin:${u.id}` : "patient", "password.changed", u.id);
  return json({ ok: true });
}
