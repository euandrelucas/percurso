import { randomBytes } from "node:crypto";
import { prisma } from "./prisma";
import { hashPassword, passwordProblem } from "./password";
import { warmVoicePreviews } from "./voice-previews";

const gen = () => randomBytes(15).toString("base64url");

/** Roda uma vez na subida do servidor: garante o admin inicial e limpa sessões expiradas. */
export async function bootstrap() {
  const hasAdmin = await prisma.user.findFirst({ where: { role: "admin" }, select: { id: true } });
  if (!hasAdmin) {
    const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
    if (!email) {
      console.warn("[bootstrap] Nenhum admin existe e ADMIN_EMAIL não foi definido. Defina ADMIN_EMAIL (e ADMIN_PASSWORD) e reinicie.");
    } else {
      let password = process.env.ADMIN_PASSWORD ?? "";
      const problem = password ? passwordProblem(password) : "ausente";
      let generated = false;
      if (problem) {
        password = gen();
        generated = true;
      }
      await prisma.user.create({ data: { email, name: "Administrador", role: "admin", onboarded: true, password_hash: await hashPassword(password) } });
      console.log(`[bootstrap] Admin criado: ${email}`);
      if (generated) console.log(`[bootstrap] ADMIN_PASSWORD ${problem === "ausente" ? "não definida" : `fraca (${problem})`} — senha TEMPORÁRIA gerada: ${password}  (troque em /admin/seguranca)`);
    }
  }
  const sweep = () => prisma.authSession.deleteMany({ where: { expires_at: { lt: new Date() } } }).catch(() => {});
  await sweep();
  const t = setInterval(sweep, 3600_000);
  t.unref?.();
  warmVoicePreviews(); // prévias de voz: gera em segundo plano as que faltam
}
