import { apiUser } from "@/lib/auth";
import { bad, json, parseBody, rateLimit } from "@/lib/api";
import { chatSchema } from "@/lib/schemas";
import { config } from "@/lib/config";
import { chatText, mockReply, type ChatMsg } from "@/lib/openai";
import { buildChatSystem } from "@/lib/prompts";
import { REMINDER_CHAT } from "@/lib/prompts/phases";
import { CRISIS_TEXT_PT } from "@/lib/prompts/safety";
import { checkReply, correctionInstruction, sanitizeReply, toBubbles } from "@/lib/guardrails";
import { classifyRisk, keywordRisk, type RiskResult } from "@/lib/risk";
import { addMessage, chatToday, raiseAlert, recentChat } from "@/lib/store";
import { audit } from "@/lib/prisma";

export async function GET() {
  const user = await apiUser("patient");
  if (!user) return bad("Não autenticado", 401);
  const msgs = await recentChat(user.id, 60);
  return json({ messages: msgs.map((m) => ({ id: m.id, role: m.role, content: m.content, at: m.created_at })), left: Math.max(0, config.chatPerDay() - (await chatToday(user.id))) });
}

export async function POST(req: Request) {
  const user = await apiUser("patient");
  if (!user) return bad("Não autenticado", 401);
  const [b, err] = await parseBody(req, chatSchema, "Mensagem vazia ou longa demais.");
  if (err) return err;
  const text = b.text;
  if (!rateLimit(`chat:${user.id}`, 12, 60_000)) return bad("Calma, uma mensagem de cada vez 💛 Tente de novo em alguns segundos.", 429);
  if ((await chatToday(user.id)) >= config.chatPerDay()) return bad("Você chegou ao limite de mensagens de hoje. Se for uma emergência, ligue 188 (CVV) ou 192 (SAMU).", 429);

  const history = await recentChat(user.id, 24);
  await addMessage(user.id, null, "chat", "user", text);

  // Risco: regras (imediato) + modelo rápido, com teto de 1,5s para não atrasar a resposta.
  const quick = keywordRisk(text);
  const ctxLines = history.slice(-4).map((m) => `${m.role === "assistant" ? "IA" : "PACIENTE"}: ${m.content}`);
  const risk: RiskResult = await Promise.race([classifyRisk(text, ctxLines), new Promise<RiskResult>((r) => setTimeout(() => r(quick), 1500))]);
  if (risk.level >= 1) await raiseAlert(user.id, risk.level, "chat", `${text.slice(0, 300)} [${risk.source}: ${risk.reason}]`);

  let reply: string;
  if (config.mock()) {
    reply = mockReply();
  } else {
    const messages: ChatMsg[] = [
      { role: "system", content: await buildChatSystem(user.id, risk.level) },
      ...history.map((m) => ({ role: m.role === "assistant" ? ("assistant" as const) : ("user" as const), content: m.content })),
      { role: "user", content: text },
      { role: "system", content: REMINDER_CHAT },
    ];
    try {
      reply = sanitizeReply(await chatText({ messages, temperature: 0.8, maxTokens: 350 }));
      let v = checkReply(reply);
      if (v.length) {
        await audit("system", "guardrail.violation", user.id, { rules: v.map((x) => x.rule) });
        const retry = await chatText({ messages: [...messages, { role: "assistant", content: reply }, { role: "system", content: correctionInstruction(v) }], temperature: 0.6, maxTokens: 350 });
        const fixed = sanitizeReply(retry);
        if (checkReply(fixed).length <= v.length) reply = fixed;
        v = checkReply(reply);
      }
      if (!reply) throw new Error("resposta vazia");
    } catch (e) {
      console.error("[chat]", e);
      reply = "Desculpa, tive uma falha aqui agora, mas estou com você.\n\nSe estiver difícil neste momento, ligue 188 (CVV, 24h). Me conta o que está acontecendo?";
    }
  }

  const bubbles = toBubbles(reply);
  await addMessage(user.id, null, "chat", "assistant", bubbles.join("\n\n"));
  // Em risco médio/alto o cartão de recursos aparece SEMPRE, determinístico — independe do que o modelo disse.
  return json({ bubbles, crisis: risk.level >= 2 ? { level: risk.level, text: CRISIS_TEXT_PT } : null });
}
