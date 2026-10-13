import { test } from "node:test";
import assert from "node:assert/strict";
import { scoreScale } from "../src/lib/screening";
import { applyGender } from "../src/lib/prompts/safety";

test("PHQ-2/GAD-2: soma e ponto de corte 3", () => {
  assert.deepEqual(scoreScale([1, 1]), { score: 2, flagged: false });
  assert.deepEqual(scoreScale([2, 1]), { score: 3, flagged: true });
  assert.deepEqual(scoreScale([3, 3]), { score: 6, flagged: true });
});

test("rejeita respostas inválidas", () => {
  assert.throws(() => scoreScale([1]));
  assert.throws(() => scoreScale([4, 0]));
  assert.throws(() => scoreScale([1.5, 0]));
});

test("marcadores de gênero", () => {
  assert.equal(applyGender("Obrigad{a|o} e seja honest{a|o}", "f"), "Obrigada e seja honesta");
  assert.equal(applyGender("Obrigad{a|o} e seja honest{a|o}", "m"), "Obrigado e seja honesto");
});
