import { apiUser } from "@/lib/auth";
import { bad, json, parseBody } from "@/lib/api";
import { addMessage, getSession } from "@/lib/store";
import { config } from "@/lib/config";
import { mockReply } from "@/lib/openai";
import { demoChatSchema } from "@/lib/schemas";

/** Apenas para o MODO DEMONSTRAÇÃO da chamada (sem OpenAI). Em produção a voz usa WebRTC direto com a API Realtime. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await apiUser("patient");
  if (!user) return bad("Não autenticado", 401);
  if (!config.mock()) return bad("Indisponível", 404);
  const id = Number((await ctx.params).id);
  const s = Number.isInteger(id) ? await getSession(id) : null;
  if (!s || s.user_id !== user.id || s.status !== "active") return bad("Sessão inválida", 404);
  const [b, err] = await parseBody(req, demoChatSchema);
  if (err) return err;
  const reply = mockReply().replace(/\n\n/g, " ");
  await addMessage(user.id, s.id, "voice", "user", b.text);
  await addMessage(user.id, s.id, "voice", "assistant", reply);
  return json({ reply });
}
