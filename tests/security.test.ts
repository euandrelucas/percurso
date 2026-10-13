import { test } from "node:test";
import assert from "node:assert/strict";
import "./helpers";
import { dec, enc } from "../src/lib/crypto";
import { hotp, verifyTotp, base32 } from "../src/lib/totp";
import { hashPassword, passwordProblem, verifyPassword } from "../src/lib/password";
import { rateLimit } from "../src/lib/ratelimit";

test("cifragem AES-GCM: ida e volta, IV aleatório e AAD vinculada à coluna", () => {
  const a = enc("texto clínico", "message.content")!;
  const b = enc("texto clínico", "message.content")!;
  assert.notEqual(a, b, "IV diferente a cada cifragem");
  assert.equal(dec(a, "message.content"), "texto clínico");
  assert.throws(() => dec(a, "alert.excerpt"), "mover o texto cifrado para outra coluna deve falhar");
  const tampered = a.slice(0, -3) + (a.endsWith("AAA") ? "BBB" : "AAA");
  assert.throws(() => dec(tampered, "message.content"), "adulteração é detectada");
  assert.equal(dec(null, "x"), null);
});

test("TOTP bate com os vetores do RFC 4226/6238", () => {
  const secret = base32(Buffer.from("12345678901234567890"));
  assert.equal(hotp(secret, 0), "755224");
  assert.equal(hotp(secret, 1), "287082");
  assert.equal(hotp(secret, 9), "520489");
  assert.equal(verifyTotp(secret, "287082", 59_000 + 30_000 * 0), Math.floor(59 / 30) === 1 ? 1 : null); // passo 1 em t=59s
  assert.equal(verifyTotp(secret, "000000", 59_000), null);
  assert.equal(verifyTotp(secret, "12345", 59_000), null);
});

test("senha: hash com scrypt, verificação e política", async () => {
  const h = await hashPassword("Uma-Senha-Forte-2026");
  assert.ok(h.startsWith("scrypt$"));
  assert.ok(await verifyPassword("Uma-Senha-Forte-2026", h));
  assert.ok(!(await verifyPassword("outra-senha", h)));
  assert.ok(passwordProblem("curta"));
  assert.ok(passwordProblem("1234567890123"));
  assert.ok(passwordProblem("aaaaaaaaaaaa"));
  assert.equal(passwordProblem("Uma-Senha-Forte-2026"), null);
});

test("rate limit: bloqueia após o limite dentro da janela", () => {
  const k = "t:" + Math.random();
  assert.ok([1, 2, 3].every(() => rateLimit(k, 3, 60_000)));
  assert.equal(rateLimit(k, 3, 60_000), false);
});
