import { test } from "node:test";
import assert from "node:assert/strict";
import { checkReply, sanitizeReply, toBubbles } from "../src/lib/guardrails";

const rules = (t: string) => checkReply(t).map((v) => v.rule);

test("pega respostas que quebram a persona", () => {
  assert.ok(rules("Eu sou uma pessoa de verdade, pode confiar").includes("human_claim"));
  assert.ok(rules("Você tem depressão, tenho certeza.").includes("diagnosis"));
  assert.ok(rules("Aumente a dose do seu remédio para 50 mg").includes("medication"));
  assert.ok(rules("Seguem as dicas:\n- respire\n- durma").includes("markdown"));
  assert.ok(rules("Segundo o meu protocolo, devo te encaminhar").includes("meta_leak"));
  assert.ok(rules("x".repeat(1000)).includes("too_long"));
});

test("resposta boa passa limpa", () => {
  assert.deepEqual(rules("Poxa, imagino como isso pesa.\n\nO que aconteceu logo antes?"), []);
});

test("sanitize remove markdown sem alterar o conteúdo", () => {
  assert.equal(sanitizeReply("**Respire** fundo\n- inspira\n- solta"), "Respire fundo\ninspira\nsolta");
});

test("balões: no máximo 3", () => {
  assert.equal(toBubbles("a\n\nb\n\nc\n\nd\n\ne").length, 3);
  assert.deepEqual(toBubbles("oi\n\ntudo bem?"), ["oi", "tudo bem?"]);
});
