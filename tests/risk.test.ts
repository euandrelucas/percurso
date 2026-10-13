import { test } from "node:test";
import assert from "node:assert/strict";
import { keywordRisk } from "../src/lib/risk";

const lvl = (t: string) => keywordRisk(t).level;

test("risco alto: plano, intenção e ato em curso", () => {
  for (const t of ["eu vou me matar hoje", "tomei todos os comprimidos", "decidi me matar", "acabei de me cortar", "vou machucar ele", "tenho um plano de me matar"]) assert.equal(lvl(t), 3, t);
});

test("risco médio: ideação passiva, autolesão, desesperança", () => {
  for (const t of ["às vezes eu queria sumir", "não aguento mais viver", "penso em me machucar", "não vejo saída", "ninguém sentiria minha falta", "estou ouvindo vozes", "meu marido me bate"]) assert.ok(lvl(t) >= 2, t);
});

test("sofrimento intenso sem ideação = nível 1", () => {
  assert.equal(lvl("estou tendo um ataque de pânico"), 1);
});

test("expressões comuns não disparam alerta", () => {
  for (const t of ["morri de rir com isso", "hoje foi um dia normal no trabalho", "estou cansada da rotina mas tudo bem", "quero muito dormir cedo hoje"]) assert.equal(lvl(t), 0, t);
});
