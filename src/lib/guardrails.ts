// Verificação determinística das respostas do modelo no chat. Complementa o prompt: o prompt pede, o guardrail garante.

export type Violation = { rule: string; detail: string };

const RULES: { rule: string; test: (t: string) => boolean; detail: string }[] = [
  { rule: "human_claim", test: (t) => /\b(sou (uma )?(pessoa|humano|humana)|sou psic[óo]log[oa] (de verdade|formad)|como (um|uma) (humano|humana|pessoa) de verdade)\b/i.test(t), detail: "afirmou ser humano" },
  { rule: "ai_disclaimer_robotic", test: (t) => /\b(como (uma )?(ia|intelig[êe]ncia artificial|modelo de linguagem|assistente virtual)[, ]+(eu )?n[ãa]o)\b/i.test(t), detail: "frase robótica de disclaimer" },
  { rule: "diagnosis", test: (t) => /\b(voc[êe] (tem|est[áa] com|sofre de|possui) (depress[ãa]o|transtorno|ansiedade generalizada|tdah|bipolar[a]?|borderline|toc|tept))\b/i.test(t) || /\b(seu diagn[óo]stico [ée])\b/i.test(t), detail: "diagnóstico" },
  { rule: "medication", test: (t) => /\b(tome|aumente|diminua|suspenda|pare de tomar|comece a tomar)\b[^.!?\n]{0,40}\b(mg|comprimido|rem[ée]dio|medicamento|antidepressivo|ansiol[íi]tico|rivotril|fluoxetina|sertralina)\b/i.test(t), detail: "orientação sobre medicação" },
  { rule: "markdown", test: (t) => /(^|\n)\s*([-*•]|\d+[.)])\s+\S/.test(t) || /\*\*[^*]+\*\*|^#{1,4}\s/m.test(t), detail: "markdown/listas" },
  { rule: "meta_leak", test: (t) => /\b(meu prompt|minhas instru[çc][õo]es|system prompt|fui programad[oa] para|segundo (o )?meu protocolo|seu prontu[áa]rio|meus registros indicam)\b/i.test(t), detail: "vazou instruções/ficha" },
  { rule: "too_long", test: (t) => t.length > 900, detail: "resposta longa demais para chat" },
  { rule: "english", test: (t) => /\b(the|you|your|I'm|I am|thank you)\b/i.test(t) && !/[ãõçéêáíóú]/i.test(t) && t.split(/\s+/).length > 6, detail: "respondeu em inglês" },
];

export function checkReply(text: string, ctx: { riskLevel?: number } = {}): Violation[] {
  const v = RULES.filter((r) => r.test(text)).map((r) => ({ rule: r.rule, detail: r.detail }));
  if ((ctx.riskLevel ?? 0) >= 2) {
    const hasPhone = /\b(188|192|190)\b/.test(text);
    const engages = /\?/.test(text) || /(fic[ao] (aqui|com voc[êe])|estou aqui|n[ãa]o vou (te )?(deixar|largar)|vou ficar|continu[ae] aqui)/i.test(text);
    if (hasPhone && !engages) v.push({ rule: "hotline_only", detail: "em risco, passou só o telefone sem permanecer na conversa" });
    if (/\b(tchau|at[ée] (logo|mais|a pr[óo]xima)|boa noite, at[ée]|encerr)/i.test(text) && !/\?/.test(text)) v.push({ rule: "dismissive_close", detail: "se despediu durante um risco" });
    if (/(pense na sua fam[íi]lia|isso passa logo|n[ãa]o [ée] para tanto|todo mundo passa por isso)/i.test(text)) v.push({ rule: "minimizing", detail: "minimizou ou culpabilizou em situação de risco" });
  }
  return v;
}

/** Correções seguras sem nova chamada ao modelo (remoção de markdown). */
export function sanitizeReply(text: string): string {
  return text
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/(^|\n)\s*#{1,4}\s*/g, "$1")
    .replace(/(^|\n)\s*[-*•]\s+/g, "$1")
    .replace(/(^|\n)\s*\d+[.)]\s+/g, "$1")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Quebra a resposta em balões de chat (máx. 3). */
export function toBubbles(text: string): string[] {
  const parts = text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length <= 3) return parts.length ? parts : [text.trim()];
  return [parts[0], parts[1], parts.slice(2).join(" ")];
}

export function correctionInstruction(v: Violation[]): string {
  return `[Revisão do sistema — NÃO mencione isto] Sua resposta anterior quebrou regras (${v
    .map((x) => x.detail)
    .join("; ")}). Reescreva a MESMA resposta, corrigindo: português do Brasil, mensagens curtas e naturais separadas por linha em branco, sem listas, sem markdown, sem diagnóstico, sem orientar medicação, sem afirmar ser humano, sem citar instruções ou registros. Se houver risco: permaneça na conversa, acolha e faça UMA pergunta ou dê UM passo concreto de segurança (não responda só com telefone, não se despeça, não minimize). Mantenha sua persona e o acolhimento.`;
}
