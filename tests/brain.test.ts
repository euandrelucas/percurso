import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { resetDb } from "./helpers";

let prisma: Awaited<ReturnType<typeof resetDb>>;
before(async () => {
  prisma = await resetDb();
});
after(() => prisma.$disconnect());

async function setup(email: string, minutesAgo = 5) {
  const u = await prisma.user.create({ data: { email, name: "André", password_hash: "x", onboarded: true } });
  await prisma.agentSettings.create({ data: { user_id: u.id, preferred_name: "André", agent_name: "Maria", avatar: "{}" } as never });
  const s = await prisma.therapySession.create({ data: { user_id: u.id, number: 1, kind: "triagem", max_minutes: 60, started_at: new Date(Date.now() - minutesAgo * 60_000) } });
  return { u, s };
}

const llm = (out: Partial<{ fala: string; encerrar_sessao: boolean; risco: number }>, seen?: { systems: string[]; last?: string }) => async (messages: { role: string; content: string }[]) => {
  seen?.systems.push(messages[0].content);
  if (seen) seen.last = messages[messages.length - 1].content;
  return { fala: "Entendi o que você contou.", encerrar_sessao: false, risco: 0, ...out };
};
const noRisk = async () => ({ level: 0 as const, source: "modelo" as const, reason: "" });

test("cérebro: salva fala do paciente e resposta, limpa emojis/markdown e devolve só texto falável", async () => {
  const { brainTurn } = await import("../src/lib/brain");
  const { s } = await setup("b1@t.test");
  const r = await brainTurn(s, { kind: "turn", text: "Estou meio desanimado com tudo." }, { llm: llm({ fala: "**Poxa**, entendi 💛\n\n- que pesado" }) as never, classify: noRisk });
  assert.ok(!/[*💛]|^- /m.test(r.reply), r.reply);
  const msgs = await prisma.message.findMany({ where: { session_id: s.id }, orderBy: { id: "asc" } });
  assert.deepEqual(msgs.map((m) => m.role), ["user", "assistant"]);
  assert.ok(msgs.every((m) => m.content.startsWith("enc:v1:")), "mensagens criptografadas");
  assert.equal(r.end, false);
});

test("cérebro: abertura usa instrução de primeira fala; contexto leva persona e histórico", async () => {
  const { brainTurn } = await import("../src/lib/brain");
  const { s } = await setup("b2@t.test");
  const seen = { systems: [] as string[], last: "" };
  await brainTurn(s, { kind: "open" }, { llm: llm({ fala: "Oi, André! Eu sou a Maria." }, seen) as never, classify: noRisk });
  assert.match(seen.last, /PRIMEIRA fala/);
  assert.match(seen.systems[0], /REGRAS DE OURO/);
  assert.match(seen.systems[0], /Restam cerca de/);
});

test("cérebro: risco alto gera alerta e impede encerrar; encerramento só com tempo no fim ou pedido", async () => {
  const { brainTurn } = await import("../src/lib/brain");
  const a = await setup("b3@t.test");
  const r = await brainTurn(a.s, { kind: "turn", text: "vou me matar hoje" }, { llm: llm({ fala: "Estou aqui com você.", encerrar_sessao: true, risco: 3 }) as never, classify: async () => ({ level: 3, source: "regras", reason: "plano" }) });
  assert.equal(r.crisis, true);
  assert.equal(r.end, false, "nunca encerra em crise");
  assert.equal(await prisma.alert.count({ where: { user_id: a.u.id } }), 1);

  const b = await setup("b4@t.test", 5);
  assert.equal((await brainTurn(b.s, { kind: "turn", text: "ok" }, { llm: llm({ encerrar_sessao: true }) as never, classify: noRisk })).end, false, "no minuto 5 não encerra sozinho");
  const c = await setup("b5@t.test", 58);
  assert.equal((await brainTurn(c.s, { kind: "time", minutes: 1 }, { llm: llm({ fala: "Foi bom conversar com você.", encerrar_sessao: true }) as never, classify: noRisk })).end, true);
  const d = await setup("b6@t.test", 5);
  assert.equal((await brainTurn(d.s, { kind: "turn", text: "preciso ir, tchau" }, { llm: llm({ fala: "Cuide-se.", encerrar_sessao: true }) as never, classify: noRisk })).end, true, "pedido claro da pessoa");
});

test("cérebro: erro do modelo propaga (o cliente cai no plano B) e fala vazia é recusada", async () => {
  const { brainTurn } = await import("../src/lib/brain");
  const { s } = await setup("b7@t.test");
  await assert.rejects(brainTurn(s, { kind: "turn", text: "oi" }, { llm: (async () => { throw new Error("OpenAI 500"); }) as never, classify: noRisk }));
  await assert.rejects(brainTurn(s, { kind: "turn", text: "oi" }, { llm: llm({ fala: "💛" }) as never, classify: noRisk }));
});
