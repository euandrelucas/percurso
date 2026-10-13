// Escalas validadas aplicadas de forma determinística (PHQ-2 e GAD-2). O modelo nunca calcula nem interpreta escores.

export const PHQ2 = {
  kind: "phq2",
  title: "Nas últimas 2 semanas, com que frequência você foi incomodado(a) por:",
  items: ["Pouco interesse ou prazer em fazer as coisas", "Se sentir para baixo, deprimido(a) ou sem esperança"],
};
export const GAD2 = {
  kind: "gad2",
  title: "Nas últimas 2 semanas, com que frequência você foi incomodado(a) por:",
  items: ["Se sentir nervoso(a), ansioso(a) ou muito tenso(a)", "Não conseguir impedir ou controlar as preocupações"],
};
export const SCALE_OPTIONS = ["Nenhuma vez", "Vários dias", "Mais da metade dos dias", "Quase todos os dias"];
export const CUTOFF = 3;

export function scoreScale(answers: number[]): { score: number; flagged: boolean } {
  if (answers.length !== 2 || answers.some((a) => !Number.isInteger(a) || a < 0 || a > 3)) throw new Error("Respostas inválidas");
  const score = answers[0] + answers[1];
  return { score, flagged: score >= CUTOFF };
}
