import { bad, clientIp, json, rateLimit, readJson, str } from "@/lib/api";
import { audit, get, run } from "@/lib/db";
import { setSessionCookie } from "@/lib/auth";
import { hashPassword } from "@/lib/password";

export async function POST(req: Request) {
  if (!rateLimit(`reg:${clientIp(req)}`, 8, 10 * 60_000)) return bad("Muitas tentativas. Tente novamente em alguns minutos.", 429);
  const b = await readJson(req);
  if (!b) return bad("Requisição inválida");
  const code = str(b.code, 40).toUpperCase().replace(/\s+/g, "");
  const name = str(b.name, 80);
  const email = str(b.email, 120).toLowerCase();
  const password = typeof b.password === "string" ? b.password : "";
  if (!code || !name || !email || !password) return bad("Preencha todos os campos.");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return bad("E-mail inválido.");
  if (password.length < 8) return bad("A senha precisa ter pelo menos 8 caracteres.");

  const inv = get<{ id: number; used_by: number | null; revoked: number; expires_at: string | null }>("SELECT * FROM invites WHERE code = ?", code);
  if (!inv || inv.revoked) return bad("Código de convite inválido.", 403);
  if (inv.used_by) return bad("Este código de convite já foi utilizado.", 403);
  if (inv.expires_at && inv.expires_at < new Date().toISOString().replace("T", " ").slice(0, 19)) return bad("Este código de convite expirou.", 403);
  if (get("SELECT 1 FROM users WHERE email = ?", email)) return bad("Já existe uma conta com este e-mail.", 409);

  const uid = run("INSERT INTO users (email, name, password_hash, role, invite_id) VALUES (?, ?, ?, 'patient', ?)", email, name, hashPassword(password), inv.id).id;
  run("UPDATE invites SET used_by = ?, used_at = datetime('now') WHERE id = ? AND used_by IS NULL", uid, inv.id);
  audit("system", "user.registered", uid, { invite: inv.id });
  await setSessionCookie(uid);
  return json({ ok: true, next: "/onboarding" });
}
