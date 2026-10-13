import { MODULES, type KnowledgeModule } from "./modules";

export { MODULES };
export type { KnowledgeModule };

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Gatilho casa no INÍCIO de uma palavra ("suicid" casa "suicidio"); frases casam como um todo.
const compiled = MODULES.map((m) => ({ m, res: m.gatilhos.map((g) => ({ g, re: new RegExp(`(^|[^a-z0-9])${escape(norm(g).trim())}`) })) }));

export type Scored = { module: KnowledgeModule; score: number; matched: string[] };

/** Pontua os módulos temáticos contra um texto (fala do paciente, resumo, temas). Determinístico e auditável. */
export function scoreModules(text: string): Scored[] {
  const t = norm(text);
  if (!t.trim()) return [];
  const out: Scored[] = [];
  for (const { m, res } of compiled) {
    const matched = res.filter((r) => r.re.test(t)).map((r) => r.g);
    if (!matched.length) continue;
    // frases (mais de uma palavra) valem mais que palavras soltas
    const score = matched.reduce((a, g) => a + (g.trim().includes(" ") ? 2 : 1), 0);
    out.push({ module: m, score, matched });
  }
  return out.sort((a, b) => b.score - a.score);
}

export function selectModules(text: string, opts: { exclude?: Iterable<string>; max?: number; includeCore?: boolean } = {}): KnowledgeModule[] {
  const ex = new Set(opts.exclude ?? []);
  return scoreModules(text)
    .filter((s) => (opts.includeCore ? true : !s.module.core) && !ex.has(s.module.id))
    .slice(0, opts.max ?? 3)
    .map((s) => s.module);
}

export const coreModules = () => MODULES.filter((m) => m.core);

const render = (m: KnowledgeModule) => `## ${m.titulo}\n${m.conteudo}`;

const USO = `Como usar este conhecimento (importante):
- É repertório seu, não um roteiro. Use SÓ o que servir ao que a pessoa trouxe AGORA; uma técnica por vez, explicada em linguagem simples e com licença ("posso te propor uma coisa?").
- Nada de jargão com a pessoa (diga "armadilha de pensamento", não "distorção cognitiva"). Nada de dar aulas: 1–3 frases por vez e devolva a palavra.
- Nunca diagnostique. Se os critérios de encaminhamento aparecerem, sugira ajuda profissional com cuidado.
- A experiência dela vale mais que a teoria: se algo não encaixar, abandone.`;

/** Núcleo sempre presente (base da relação, estrutura, encaminhamento, risco). */
export function coreKnowledgeBlock(): string {
  return `# CONHECIMENTO CLÍNICO DE BASE\n${USO}\n\n${coreModules().map(render).join("\n\n")}`;
}

/** Módulos temáticos relevantes (voz: escolhidos pelos temas do caso na abertura; chat: pela mensagem atual). */
export function topicalKnowledgeBlock(mods: KnowledgeModule[]): string {
  if (!mods.length) return "";
  return `# CONHECIMENTO CLÍNICO PARA ESTE ASSUNTO (use se fizer sentido; não recite)\n\n${mods.map(render).join("\n\n")}`;
}

/** Texto curto para injeção "just-in-time" no meio de uma chamada de voz. */
export function injectionText(mods: KnowledgeModule[]): string {
  return `[Conhecimento de apoio do sistema — NÃO leia em voz alta, NÃO mencione]\nA pessoa tocou em um assunto para o qual você tem orientação. Use-a só se fizer sentido, uma ideia por vez, em linguagem simples.\n\n${mods.map(render).join("\n\n")}`;
}
