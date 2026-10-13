import { test } from "node:test";
import assert from "node:assert/strict";
import { useTempDb } from "./helpers";

useTempDb();

test("regra de 1 chamada por dia: falha técnica curta não consome o direito", async () => {
  const { run } = await import("../src/lib/db");
  const { callsToday, callAvailability } = await import("../src/lib/store");
  const uid = run("INSERT INTO users (email, name, password_hash, onboarded) VALUES ('c@d.e', 'C', 'x', 1)").id;
  assert.equal(callsToday(uid), 0);
  run("INSERT INTO sessions (user_id, number, kind, status, max_minutes, duration_sec) VALUES (?, 1, 'triagem', 'ended', 60, 40)", uid);
  assert.equal(callsToday(uid), 0, "40s não conta");
  run("INSERT INTO sessions (user_id, number, kind, status, max_minutes, duration_sec) VALUES (?, 2, 'triagem', 'ended', 60, 1800)", uid);
  assert.equal(callsToday(uid), 1);
  const a = callAvailability({ id: uid, calls_per_day: null });
  assert.equal(a.available, false);
  assert.equal(callAvailability({ id: uid, calls_per_day: 2 }).available, true, "limite individual do admin");
});

test("memória é versionada (append-only)", async () => {
  const { run, all } = await import("../src/lib/db");
  const { saveMemory, getMemory } = await import("../src/lib/store");
  const { EMPTY_MEMORY } = await import("../src/lib/types");
  const uid = run("INSERT INTO users (email, name, password_hash) VALUES ('e@f.g', 'E', 'x')").id;
  saveMemory(uid, { ...EMPTY_MEMORY, queixa_principal: "v1" });
  saveMemory(uid, { ...EMPTY_MEMORY, queixa_principal: "v2" });
  assert.equal(getMemory(uid).queixa_principal, "v2");
  assert.equal(all("SELECT * FROM case_memory_versions WHERE user_id = ?", uid).length, 2);
});

test("alertas duplicados em sequência são agrupados e o nível só sobe", async () => {
  const { run, all } = await import("../src/lib/db");
  const { raiseAlert } = await import("../src/lib/store");
  const uid = run("INSERT INTO users (email, name, password_hash) VALUES ('h@i.j', 'H', 'x')").id;
  raiseAlert(uid, 2, "chat", "a");
  raiseAlert(uid, 3, "chat", "b");
  raiseAlert(uid, 1, "chat", "c");
  const rows = all<{ level: number }>("SELECT level FROM alerts WHERE user_id = ?", uid);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].level, 3);
});
