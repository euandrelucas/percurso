import { bad, json, rateLimit } from "@/lib/api";
import { currentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { encTotp } from "@/lib/store";
import { newSecret, otpauthUrl, qrSvg } from "@/lib/totp";

/** Gera um segredo TOTP novo (ainda não ativo até confirmar um código). */
export async function POST() {
  const me = await currentUser();
  if (!me || me.role !== "admin") return bad("Não autorizado", 403);
  if (!rateLimit(`2fasetup:${me.id}`, 10, 60 * 60_000)) return bad("Muitas tentativas.", 429);
  if (me.totp_enabled) return bad("O 2FA já está ativo.", 409);
  const secret = newSecret();
  await prisma.user.update({ where: { id: me.id }, data: { totp_secret: encTotp(secret), totp_enabled: false, totp_last_step: null } });
  return json({ secret, qr: await qrSvg(otpauthUrl(secret, me.email)) });
}
