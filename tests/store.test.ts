import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { resetDb } from "./helpers";

let prisma: Awaited<ReturnType<typeof resetDb>>;
before(async () => {
  prisma = await resetDb();
});
after(() => prisma.$disconnect());

const mkUser = (email: string) => prisma.user.create({ data: { email, name: "T", password_hash: "x", onboarded: true } });

test("regra de 1 chamada por dia: falha técnica curta não consome o direito", async () => {
  const { callsToday, callAvailability } = await import("../src/lib/store");
  const u = await mkUser("c@d.e");
  assert.equal(await callsToday(u.id), 0);
  await prisma.therapySession.create({ data: { user_id: u.id, number: 1, kind: "triagem", status: "ended", max_minutes: 60, duration_sec: 40 } });
  assert.equal(await callsToday(u.id), 0, "40s não conta");
  await prisma.therapySession.create({ data: { user_id: u.id, number: 2, kind: "triagem", status: "ended", max_minutes: 60, duration_sec: 1800 } });
  assert.equal(await callsToday(u.id), 1);
  assert.equal((await callAvailability({ id: u.id, calls_per_day: null })).available, false);
  assert.equal((await callAvailability({ id: u.id, calls_per_day: 2 })).available, true, "limite individual do admin");
});

test("sessão em andamento pode ser retomada mesmo com o limite diário usado", async () => {
  const { callAvailability } = await import("../src/lib/store");
  const u = await mkUser("res@d.e");
  await prisma.therapySession.create({ data: { user_id: u.id, number: 1, kind: "triagem", status: "active", max_minutes: 60 } });
  const a = await callAvailability({ id: u.id, calls_per_day: null });
  assert.equal(a.resumable, true);
  assert.equal(a.available, true);
});

test("memória é versionada (append-only) e cifrada", async () => {
  const { saveMemory, getMemory, memoryVersions } = await import("../src/lib/store");
  const { EMPTY_MEMORY } = await import("../src/lib/types");
  const u = await mkUser("e@f.g");
  await saveMemory(u.id, { ...EMPTY_MEMORY, queixa_principal: "v1" });
  await saveMemory(u.id, { ...EMPTY_MEMORY, queixa_principal: "v2" });
  assert.equal((await getMemory(u.id)).queixa_principal, "v2");
  const versions = await memoryVersions(u.id);
  assert.equal(versions.length, 2);
  assert.equal(versions[0].data?.queixa_principal, "v1");
  const raw = await prisma.$queryRaw<{ data: string }[]>`SELECT data FROM case_memory_versions WHERE user_id = ${u.id}`;
  assert.ok(raw.every((r) => r.data.startsWith("enc:v1:") && !r.data.includes("queixa")));
});

test("mensagens e alertas ficam cifrados no banco e voltam legíveis pela API", async () => {
  const { addMessage, sessionMessages, raiseAlert, listAlerts } = await import("../src/lib/store");
  const u = await mkUser("m@n.o");
  const s = await prisma.therapySession.create({ data: { user_id: u.id, number: 1, kind: "triagem", max_minutes: 60 } });
  await addMessage(u.id, s.id, "voice", "user", "segredo clínico 123");
  const raw = await prisma.$queryRaw<{ content: string }[]>`SELECT content FROM messages WHERE user_id = ${u.id}`;
  assert.ok(!raw[0].content.includes("segredo") && raw[0].content.startsWith("enc:v1:"));
  assert.equal((await sessionMessages(s.id))[0].content, "segredo clínico 123");
  await raiseAlert(u.id, 2, "chat", "trecho sensível");
  const rawA = await prisma.$queryRaw<{ excerpt: string }[]>`SELECT excerpt FROM alerts WHERE user_id = ${u.id}`;
  assert.ok(rawA[0].excerpt.startsWith("enc:v1:"));
  assert.equal((await listAlerts({ user_id: u.id }))[0].excerpt, "trecho sensível");
});

test("alertas duplicados em sequência são agrupados e o nível só sobe", async () => {
  const { raiseAlert } = await import("../src/lib/store");
  const u = await mkUser("h@i.j");
  await raiseAlert(u.id, 2, "chat", "a");
  await raiseAlert(u.id, 3, "chat", "b");
  await raiseAlert(u.id, 1, "chat", "c");
  const rows = await prisma.alert.findMany({ where: { user_id: u.id } });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].level, 3);
});

test("encerrar sessão é idempotente e limita a duração", async () => {
  const { endSession } = await import("../src/lib/sessions");
  const u = await mkUser("z@z.z");
  const s = await prisma.therapySession.create({ data: { user_id: u.id, number: 1, kind: "triagem", max_minutes: 60, started_at: new Date(Date.now() - 3 * 3600_000) } });
  const a = await endSession(s.id, "paciente");
  const b = await endSession(s.id, "tempo");
  assert.equal(a?.status, "ended");
  assert.equal(b?.end_reason, "paciente", "o segundo encerramento não sobrescreve");
  assert.ok((a?.duration_sec ?? 0) <= 63 * 60, "duração limitada a max + 3 min");
});

test("feedback do fim da sessão: nota salva e comentário criptografado no banco", async () => {
  const { saveFeedback, getSession } = await import("../src/lib/store");
  const u = await mkUser("fb@t.test");
  const s = await prisma.therapySession.create({ data: { user_id: u.id, number: 1, kind: "triagem", status: "ended", max_minutes: 60 } });
  await saveFeedback(s.id, 1, "  Achei repetitiva  ");
  const raw = await prisma.therapySession.findUnique({ where: { id: s.id } });
  assert.equal(raw?.feedback_rating, 1);
  assert.ok(raw?.feedback_note?.startsWith("enc:v1:"), "comentário deve estar criptografado");
  assert.ok(raw?.feedback_at);
  const got = await getSession(s.id);
  assert.equal(got?.feedback_note, "Achei repetitiva");
  await saveFeedback(s.id, 3, "");
  assert.equal((await getSession(s.id))?.feedback_note, null);
});
