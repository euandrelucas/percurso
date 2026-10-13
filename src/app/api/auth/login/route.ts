import { headers } from "next/headers";
import { bad, clientIp, formAware, json, parseBody, rateLimit } from "@/lib/api";
import { createSession } from "@/lib/auth";
import { audit, prisma } from "@/lib/prisma";
import { dummyVerify, verifyPassword } from "@/lib/password";
import { loginSchema } from "@/lib/schemas";

const GENERIC = "E-mail ou senha incorretos.";
const MAX_FAILS = 5;

async function handle(req: Request) {
  const ip = clientIp(req);
  const [b, err] = await parseBody(req, loginSchema, GENERIC);
  if (err) return err;
  if (!rateLimit(`login:ip:${ip}`, 20, 10 * 60_000) || !rateLimit(`login:em:${b.email}`, 10, 15 * 60_000)) return bad("Muitas tentativas. Tente novamente em alguns minutos.", 429);

  const u = await prisma.user.findUnique({ where: { email: b.email } });
  if (u?.locked_until && u.locked_until > new Date()) {
    await dummyVerify(b.password); // mesmo custo de tempo
    return bad("Conta temporariamente bloqueada por excesso de tentativas. Tente novamente mais tarde.", 429);
  }
  const ok = u ? await verifyPassword(b.password, u.password_hash) : await dummyVerify(b.password);
  if (!u || !ok || u.status !== "active") {
    if (u) {
      const fails = u.failed_logins + 1;
      const lock = fails >= MAX_FAILS ? new Date(Date.now() + Math.min(24 * 60, 15 * 2 ** (fails - MAX_FAILS)) * 60_000) : null;
      await prisma.user.update({ where: { id: u.id }, data: { failed_logins: fails, locked_until: lock } });
      await audit("system", "login.failed", u.id, { fails }, ip);
    }
    return bad(GENERIC, 401);
  }

  await prisma.user.update({ where: { id: u.id }, data: { failed_logins: 0, locked_until: null, last_login_at: new Date() } });
  const ua = (await headers()).get("user-agent");
  if (u.totp_enabled) {
    await createSession(u.id, u.role, { pending2fa: true, ip, ua });
    return json({ ok: true, next: "/entrar/2fa" });
  }
  await createSession(u.id, u.role, { ip, ua });
  await audit(u.role === "admin" ? `admin:${u.id}` : "patient", "login.ok", u.id, undefined, ip);
  return json({ ok: true, next: u.role === "admin" ? "/admin" : u.onboarded ? "/app" : "/onboarding" });
}

export const POST = formAware("/entrar", handle);
