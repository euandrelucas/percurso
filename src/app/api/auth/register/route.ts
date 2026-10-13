import { bad, clientIp, formAware, json, parseBody, rateLimit } from "@/lib/api";
import { createSession, requestIp } from "@/lib/auth";
import { audit, prisma } from "@/lib/prisma";
import { hashPassword, passwordProblem } from "@/lib/password";
import { registerSchema } from "@/lib/schemas";
import { headers } from "next/headers";

async function handle(req: Request) {
  const ip = clientIp(req);
  if (!rateLimit(`reg:${ip}`, 8, 10 * 60_000)) return bad("Muitas tentativas. Tente novamente em alguns minutos.", 429);
  const [b, err] = await parseBody(req, registerSchema, "Preencha todos os campos corretamente.");
  if (err) return err;
  const problem = passwordProblem(b.password);
  if (problem) return bad(problem);

  const inv = await prisma.invite.findUnique({ where: { code: b.code } });
  // Resposta única para código inexistente/usado/revogado/expirado: não revela qual é o caso.
  const invalid = !inv || inv.revoked || inv.used_by_id !== null || (inv.expires_at !== null && inv.expires_at < new Date());
  if (invalid) {
    if (!rateLimit(`regcode:${ip}`, 5, 60 * 60_000)) return bad("Muitas tentativas. Tente novamente mais tarde.", 429);
    return bad("Código de convite inválido ou já utilizado.", 403);
  }
  if (await prisma.user.findUnique({ where: { email: b.email }, select: { id: true } })) return bad("Não foi possível criar a conta com esses dados.", 409);

  try {
    const user = await prisma.$transaction(async (tx) => {
      const u = await tx.user.create({ data: { email: b.email, name: b.name, password_hash: await hashPassword(b.password) } });
      // Consome o convite de forma atômica: se outra requisição o usou antes, count = 0 e tudo é desfeito.
      const c = await tx.invite.updateMany({ where: { id: inv.id, used_by_id: null, revoked: false }, data: { used_by_id: u.id, used_at: new Date() } });
      if (c.count === 0) throw new Error("invite-race");
      return u;
    });
    await audit("patient", "user.registered", user.id, { invite: inv.id }, ip);
    await createSession(user.id, "patient", { ip: await requestIp(), ua: (await headers()).get("user-agent") });
    return json({ ok: true, next: "/onboarding" });
  } catch (e) {
    if (e instanceof Error && e.message === "invite-race") return bad("Código de convite inválido ou já utilizado.", 403);
    console.error("[register]", e);
    return bad("Não foi possível criar a conta.", 500);
  }
}

export const POST = formAware("/cadastro", handle, ["code"]);
