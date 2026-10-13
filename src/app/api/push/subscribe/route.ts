import { z } from "zod";
import { apiUser } from "@/lib/auth";
import { bad, json, parseBody, rateLimit } from "@/lib/api";
import { prisma } from "@/lib/prisma";

const subSchema = z.object({
  endpoint: z.string().url().max(1000).startsWith("https://"),
  keys: z.object({ p256dh: z.string().min(10).max(200), auth: z.string().min(6).max(100) }),
});

export async function POST(req: Request) {
  const user = await apiUser("patient");
  if (!user) return bad("Não autenticado", 401);
  if (!rateLimit(`push:${user.id}`, 20, 60 * 60_000)) return bad("Muitas requisições.", 429);
  const [b, err] = await parseBody(req, subSchema, "Inscrição inválida");
  if (err) return err;
  // O mesmo aparelho pode trocar de conta: o endpoint passa a pertencer a quem acabou de se inscrever.
  await prisma.pushSubscription.upsert({
    where: { endpoint: b.endpoint },
    create: { user_id: user.id, endpoint: b.endpoint, p256dh: b.keys.p256dh, auth: b.keys.auth },
    update: { user_id: user.id, p256dh: b.keys.p256dh, auth: b.keys.auth },
  });
  return json({ ok: true });
}

export async function DELETE(req: Request) {
  const user = await apiUser("patient");
  if (!user) return bad("Não autenticado", 401);
  const [b, err] = await parseBody(req, z.object({ endpoint: z.string().max(1000) }), "Requisição inválida");
  if (err) return err;
  await prisma.pushSubscription.deleteMany({ where: { endpoint: b.endpoint, user_id: user.id } });
  return json({ ok: true });
}
