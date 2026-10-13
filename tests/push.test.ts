import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { resetDb } from "./helpers";

let prisma: Awaited<ReturnType<typeof resetDb>>;
before(async () => {
  prisma = await resetDb();
  await prisma.appSetting.deleteMany();
});
after(() => prisma.$disconnect());

const at19 = new Date("2026-10-14T22:30:00Z"); // 19:30 em Brasília (UTC-3)
const mkSub = async (email: string, extra: { onboarded?: boolean } = {}) => {
  const u = await prisma.user.create({ data: { email, name: "T", password_hash: "x", onboarded: extra.onboarded ?? true } });
  const s = await prisma.pushSubscription.create({ data: { user_id: u.id, endpoint: `https://push.example/${email}`, p256dh: "p".repeat(20), auth: "a".repeat(10) } });
  return { u, s };
};

test("VAPID: gerada uma vez, privada criptografada no banco", async () => {
  const { getVapid } = await import("../src/lib/push");
  const v = await getVapid();
  assert.ok(v.publicKey.length > 40 && v.privateKey.length > 20);
  const priv = await prisma.appSetting.findUnique({ where: { key: "vapid_private" } });
  assert.ok(priv?.value.startsWith("enc:v1:"), "chave privada deve estar criptografada");
  assert.notEqual(priv?.value, v.privateKey);
});

test("lembrete: só às 19h, um por dia, e não para quem já conversou hoje", async () => {
  const { runReminders } = await import("../src/lib/push");
  const sent: string[] = [];
  const send = (async (sub: { endpoint: string }, payload?: unknown) => (sent.push(`${sub.endpoint}|${String(payload)}`), { statusCode: 201 })) as never;
  const a = await mkSub("a@t.test");
  const b = await mkSub("b@t.test");
  await prisma.therapySession.create({ data: { user_id: b.u.id, number: 1, kind: "triagem", status: "ended", max_minutes: 60, started_at: new Date("2026-10-14T15:00:00Z") } });
  const c = await mkSub("c@t.test", { onboarded: false });
  void c;

  assert.equal(await runReminders(new Date("2026-10-14T15:00:00Z"), send), 0, "fora das 19h não envia");
  assert.equal(await runReminders(at19, send), 1, "só A recebe (B já conversou hoje; C não terminou o onboarding)");
  assert.ok(sent[0].includes("a@t.test"));
  assert.ok(!sent[0].toLowerCase().includes("ansiedade"), "texto neutro");
  assert.equal(await runReminders(at19, send), 0, "no máximo um por dia");
  assert.ok((await prisma.pushSubscription.findUnique({ where: { id: a.s.id } }))?.last_sent_at);
});

test("aparelho que cancelou (410) tem a inscrição apagada", async () => {
  const { runReminders } = await import("../src/lib/push");
  const d = await mkSub("d@t.test");
  const gone = (async () => {
    throw Object.assign(new Error("gone"), { statusCode: 410 });
  }) as never;
  await runReminders(new Date("2026-10-15T22:30:00Z"), gone);
  assert.equal(await prisma.pushSubscription.findUnique({ where: { id: d.s.id } }), null);
});
