import { bad, clientIp, json, rateLimit, readJson, str } from "@/lib/api";
import { get } from "@/lib/db";
import { setSessionCookie } from "@/lib/auth";
import { verifyPassword } from "@/lib/password";

export async function POST(req: Request) {
  if (!rateLimit(`login:${clientIp(req)}`, 10, 10 * 60_000)) return bad("Muitas tentativas. Tente novamente em alguns minutos.", 429);
  const b = await readJson(req);
  const email = str(b?.email, 120).toLowerCase();
  const password = typeof b?.password === "string" ? b.password : "";
  const u = get<{ id: number; password_hash: string; role: string; status: string; onboarded: number }>("SELECT id, password_hash, role, status, onboarded FROM users WHERE email = ?", email);
  if (!u || u.status !== "active" || !verifyPassword(password, u.password_hash)) return bad("E-mail ou senha incorretos.", 401);
  await setSessionCookie(u.id);
  return json({ ok: true, next: u.role === "admin" ? "/admin" : u.onboarded ? "/app" : "/onboarding" });
}
