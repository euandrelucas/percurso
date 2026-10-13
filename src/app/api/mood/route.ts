import { apiUser } from "@/lib/auth";
import { bad, json, readJson, str } from "@/lib/api";
import { run } from "@/lib/db";

export async function POST(req: Request) {
  const user = await apiUser("patient");
  if (!user) return bad("Não autenticado", 401);
  const b = await readJson(req);
  const score = Number(b?.score);
  if (!Number.isInteger(score) || score < 0 || score > 10) return bad("Nota inválida");
  run("INSERT INTO moods (user_id, score, note) VALUES (?, ?, ?)", user.id, score, str(b?.note, 280) || null);
  return json({ ok: true });
}
