import { bad, json, parseBody, rateLimit } from "@/lib/api";
import { createSession, currentUser, requestIp, revokeAllSessions } from "@/lib/auth";
import { audit, prisma } from "@/lib/prisma";
import { totpSchema } from "@/lib/schemas";
import { decTotp } from "@/lib/store";
import { verifyTotp } from "@/lib/totp";

export async function POST(req: Request) {
  const me = await currentUser();
  if (!me || me.role !== "admin") return bad("Não autorizado", 403);
  if (!rateLimit(`2faenable:${me.id}`, 8, 15 * 60_000)) return bad("Muitas tentativas.", 429);
  const [b, err] = await parseBody(req, totpSchema, "Digite o código de 6 dígitos.");
  if (err) return err;
  const u = await prisma.user.findUniqueOrThrow({ where: { id: me.id } });
  if (!u.totp_secret) return bad("Gere o QR code primeiro.", 409);
  const step = verifyTotp(decTotp(u.totp_secret), b.code);
  if (step === null) return bad("Código incorreto. Confira o horário do celular.", 401);
  await prisma.user.update({ where: { id: u.id }, data: { totp_enabled: true, totp_last_step: step } });
  await revokeAllSessions(u.id);
  await createSession(u.id, u.role, { ip: await requestIp() });
  await audit(`admin:${u.id}`, "2fa.enabled", u.id);
  return json({ ok: true });
}
