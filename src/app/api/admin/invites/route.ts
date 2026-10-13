import { randomInt } from "node:crypto";
import { apiUser } from "@/lib/auth";
import { bad, json, parseBody } from "@/lib/api";
import { audit, prisma } from "@/lib/prisma";
import { inviteCreateSchema, inviteRevokeSchema } from "@/lib/schemas";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sem 0/O/1/I para evitar confusão ao digitar
const part = () => Array.from({ length: 4 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
const genCode = () => `PERC-${part()}-${part()}`; // 8 símbolos de 32 = 40 bits de entropia

export async function POST(req: Request) {
  const admin = await apiUser("admin");
  if (!admin) return bad("Não autorizado", 403);
  const [b, err] = await parseBody(req, inviteCreateSchema);
  if (err) return err;
  const created: string[] = [];
  for (let i = 0; i < b.count; i++) {
    for (let tries = 0; tries < 5; tries++) {
      const code = genCode();
      try {
        await prisma.invite.create({
          data: { code, label: b.count > 1 && b.label ? `${b.label} ${i + 1}` : b.label || null, expires_at: b.expiresInDays ? new Date(Date.now() + b.expiresInDays * 864e5) : null },
        });
        created.push(code);
        break;
      } catch {
        /* colisão de código: tenta outro */
      }
    }
  }
  await audit(`admin:${admin.id}`, "invite.created", null, { count: created.length });
  return json({ ok: true, codes: created });
}

export async function DELETE(req: Request) {
  const admin = await apiUser("admin");
  if (!admin) return bad("Não autorizado", 403);
  const [b, err] = await parseBody(req, inviteRevokeSchema);
  if (err) return err;
  const r = await prisma.invite.updateMany({ where: { id: b.id, used_by_id: null }, data: { revoked: true } });
  if (r.count) await audit(`admin:${admin.id}`, "invite.revoked", null, { id: b.id });
  return r.count ? json({ ok: true }) : bad("Convite não encontrado ou já utilizado", 404);
}
