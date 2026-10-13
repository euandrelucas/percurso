import { randomInt } from "node:crypto";
import { apiUser } from "@/lib/auth";
import { bad, json, readJson, str } from "@/lib/api";
import { audit, get, run } from "@/lib/db";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sem 0/O/1/I para evitar confusão ao digitar
const genCode = () => "PERC-" + Array.from({ length: 4 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("") + "-" + Array.from({ length: 4 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");

export async function POST(req: Request) {
  const admin = await apiUser("admin");
  if (!admin) return bad("Não autorizado", 403);
  const b = await readJson(req);
  const count = Math.min(20, Math.max(1, Number(b?.count) || 1));
  const label = str(b?.label, 80);
  const days = Number(b?.expiresInDays);
  const created: string[] = [];
  for (let i = 0; i < count; i++) {
    let code = genCode();
    while (get("SELECT 1 FROM invites WHERE code = ?", code)) code = genCode();
    run("INSERT INTO invites (code, label, expires_at) VALUES (?, ?, ?)", code, count > 1 && label ? `${label} ${i + 1}` : label || null, days > 0 ? new Date(Date.now() + days * 864e5).toISOString().replace("T", " ").slice(0, 19) : null);
    created.push(code);
  }
  audit("admin", "invite.created", null, { count });
  return json({ ok: true, codes: created });
}

export async function DELETE(req: Request) {
  const admin = await apiUser("admin");
  if (!admin) return bad("Não autorizado", 403);
  const b = await readJson(req);
  const r = run("UPDATE invites SET revoked = 1 WHERE id = ? AND used_by IS NULL", Number(b?.id));
  return r.changes ? json({ ok: true }) : bad("Convite não encontrado ou já utilizado", 404);
}
