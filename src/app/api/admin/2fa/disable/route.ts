import { z } from "zod";
import { bad, json, parseBody, rateLimit } from "@/lib/api";
import { createSession, currentUser, requestIp, revokeAllSessions } from "@/lib/auth";
import { audit, prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";
import { decTotp } from "@/lib/store";
import { verifyTotp } from "@/lib/totp";

const schema = z.object({ password: z.string().min(1).max(200), code: z.string().regex(/^\d{6}$/) });

export async function POST(req: Request) {
  const me = await currentUser();
  if (!me || me.role !== "admin") return bad("Não autorizado", 403);
  if (!rateLimit(`2fadisable:${me.id}`, 5, 15 * 60_000)) return bad("Muitas tentativas.", 429);
  const [b, err] = await parseBody(req, schema);
  if (err) return err;
  const u = await prisma.user.findUniqueOrThrow({ where: { id: me.id } });
  const okPw = await verifyPassword(b.password, u.password_hash);
  const okCode = u.totp_secret ? verifyTotp(decTotp(u.totp_secret), b.code) !== null : false;
  if (!okPw || !okCode) return bad("Senha ou código incorretos.", 401);
  await prisma.user.update({ where: { id: u.id }, data: { totp_enabled: false, totp_secret: null, totp_last_step: null } });
  await revokeAllSessions(u.id);
  await createSession(u.id, u.role, { ip: await requestIp() });
  await audit(`admin:${u.id}`, "2fa.disabled", u.id);
  return json({ ok: true });
}
