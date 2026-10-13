import { apiUser } from "@/lib/auth";
import { bad, json, readJson, str } from "@/lib/api";
import { addMessage, getSession } from "@/lib/store";
import { config } from "@/lib/config";
import { mockReply } from "@/lib/openai";

/** Apenas para o MODO DEMONSTRAÇÃO da chamada (sem OpenAI). Em produção a voz usa WebRTC direto com a API Realtime. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await apiUser("patient");
  if (!user) return bad("Não autenticado", 401);
  if (!config.mock()) return bad("Indisponível", 404);
  const s = getSession(Number((await ctx.params).id));
  if (!s || s.user_id !== user.id || s.status !== "active") return bad("Sessão inválida", 404);
  const b = await readJson(req);
  const text = str(b?.text, 2000);
  if (!text) return bad("Vazio");
  const reply = mockReply().replace(/\n\n/g, " ");
  addMessage(user.id, s.id, "voice", "user", text);
  addMessage(user.id, s.id, "voice", "assistant", reply);
  return json({ reply });
}
