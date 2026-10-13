import { apiUser } from "@/lib/auth";
import { bad, json, parseBody, rateLimit } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { moodSchema } from "@/lib/schemas";

export async function POST(req: Request) {
  const user = await apiUser("patient");
  if (!user) return bad("Não autenticado", 401);
  if (!rateLimit(`mood:${user.id}`, 30, 60 * 60_000)) return bad("Muitos registros em pouco tempo.", 429);
  const [b, err] = await parseBody(req, moodSchema, "Nota inválida");
  if (err) return err;
  await prisma.mood.create({ data: { user_id: user.id, score: b.score, note: b.note || null } });
  return json({ ok: true });
}
