import { bad, clientIp, json, parseBody, rateLimit } from "@/lib/api";
import { pendingUser, promoteSession } from "@/lib/auth";
import { audit, prisma } from "@/lib/prisma";
import { totpSchema } from "@/lib/schemas";
import { decTotp } from "@/lib/store";
import { verifyTotp } from "@/lib/totp";

export async function POST(req: Request) {
  const p = await pendingUser();
  if (!p) return bad("Sessão expirada. Entre novamente.", 401);
  if (!rateLimit(`2fa:${p.sessionId}`, 5, 10 * 60_000)) return bad("Muitas tentativas. Entre novamente.", 429);
  const [b, err] = await parseBody(req, totpSchema, "Digite o código de 6 dígitos.");
  if (err) return err;
  const u = p.user;
  const step = u.totp_secret ? verifyTotp(decTotp(u.totp_secret), b.code) : null;
  if (step === null || (u.totp_last_step !== null && step <= u.totp_last_step)) {
    await audit("system", "2fa.failed", u.id, undefined, clientIp(req));
    return bad("Código incorreto ou já utilizado.", 401);
  }
  await prisma.user.update({ where: { id: u.id }, data: { totp_last_step: step } });
  await promoteSession(p.sessionId, u.role);
  await audit(u.role === "admin" ? `admin:${u.id}` : "patient", "login.ok", u.id, { twoFactor: true }, clientIp(req));
  return json({ ok: true, next: u.role === "admin" ? "/admin" : u.onboarded ? "/app" : "/onboarding" });
}
