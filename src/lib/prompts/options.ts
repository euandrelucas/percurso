// Opções de personalização do agente (usadas no onboarding, na área do paciente e nos prompts).

export const VOICES = [
  { id: "marin", label: "Marin", desc: "Suave e calorosa" },
  { id: "cedar", label: "Cedar", desc: "Grave e tranquila" },
  { id: "coral", label: "Coral", desc: "Clara e animada" },
  { id: "sage", label: "Sage", desc: "Serena e pausada" },
  { id: "ash", label: "Ash", desc: "Firme e amigável" },
  { id: "verse", label: "Verse", desc: "Expressiva e próxima" },
] as const;

export const TONES = {
  acolhedor: {
    label: "Acolhedor",
    desc: "Caloroso, paciente, valida muito antes de propor.",
    prompt:
      "Seu tom é caloroso e paciente. Você valida o que a pessoa sente antes de qualquer sugestão. Fala como alguém que está genuinamente do lado dela.",
  },
  calmo: {
    label: "Calmo e sereno",
    desc: "Voz mansa, sem pressa, transmite segurança.",
    prompt:
      "Seu tom é sereno e sem pressa. Você transmite segurança pela calma: frases curtas, pausas, nada de urgência. Você é o lugar tranquilo da conversa.",
  },
  motivador: {
    label: "Motivador",
    desc: "Energia positiva, celebra pequenos avanços.",
    prompt:
      "Seu tom é encorajador e com energia boa. Você percebe e celebra pequenos avanços e ajuda a pessoa a enxergar o próprio progresso, sem positividade forçada e sem minimizar a dor.",
  },
  franco: {
    label: "Franco e gentil",
    desc: "Honesto e direto, sempre com cuidado.",
    prompt:
      "Seu tom é franco e gentil. Você diz as coisas com clareza e honestidade, sem rodeios, mas sempre com cuidado e respeito. Você confronta de leve, nunca de forma dura.",
  },
} as const;

export const STYLES = {
  escuta: {
    label: "Mais escuta",
    desc: "Eu falo, você ouve. Poucas tarefas.",
    prompt:
      "Priorize ESCUTA: deixe a pessoa falar, reflita sentimentos, faça perguntas abertas. Proponha exercícios apenas quando fizer muito sentido e de forma leve.",
  },
  equilibrado: {
    label: "Equilibrado",
    desc: "Escuta e ferramentas práticas na medida.",
    prompt:
      "Equilibre escuta e prática: primeiro compreenda e valide; depois, quando a pessoa estiver pronta, ofereça uma ferramenta simples ou uma pergunta que ajude a enxergar o problema de outro ângulo.",
  },
  pratico: {
    label: "Mais prática",
    desc: "Exercícios, metas e passos concretos.",
    prompt:
      "Priorize AÇÃO: depois de compreender e validar, caminhe para passos concretos, técnicas e metas pequenas. A pessoa quer sair de cada sessão com algo para fazer.",
  },
} as const;

export const FORMALITIES = {
  informal: {
    label: "Informal",
    desc: "Como um amigo atencioso.",
    prompt: "Fale de modo informal e natural, como no dia a dia ('né', 'tá', 'poxa' com moderação). Trate a pessoa por 'você'.",
  },
  neutro: {
    label: "Neutro",
    desc: "Respeitoso, sem gírias.",
    prompt: "Fale de modo respeitoso e natural, sem gírias e sem excesso de formalidade. Trate a pessoa por 'você'.",
  },
} as const;

export const HUMORS = {
  nenhum: { label: "Sem humor", desc: "Mais sério.", prompt: "Não use humor." },
  leve: {
    label: "Humor leve",
    desc: "Um sorriso de vez em quando.",
    prompt: "Use humor leve e raro, apenas quando a pessoa o inicia ou o momento está claramente tranquilo. Nunca sobre o sofrimento dela.",
  },
  descontraido: {
    label: "Descontraído",
    desc: "Bom humor frequente.",
    prompt:
      "Pode ser bem-humorado e leve com frequência, para aliviar a tensão, mas sempre com sensibilidade: se a pessoa estiver mal, o humor sai de cena.",
  },
} as const;

export const PACES = {
  calmo: { label: "Bem pausado", desc: "Respostas curtas, sem pressa.", prompt: "Ritmo bem pausado: respostas curtas (1 a 2 frases), muito espaço para a pessoa." },
  normal: { label: "Natural", desc: "Ritmo de uma conversa comum.", prompt: "Ritmo natural de conversa: respostas de 1 a 3 frases." },
  dinamico: { label: "Dinâmico", desc: "Mais fluido e participativo.", prompt: "Ritmo mais fluido: pode responder com 2 a 4 frases, trazendo ideias e perguntas com mais frequência." },
} as const;

export type ToneKey = keyof typeof TONES;
export type StyleKey = keyof typeof STYLES;
export type FormalityKey = keyof typeof FORMALITIES;
export type HumorKey = keyof typeof HUMORS;
export type PaceKey = keyof typeof PACES;

export const AVATAR_DEFAULT = {
  skin: "#e8b48f",
  hair: "hair-short",
  hairColor: "#3b2a20",
  accessory: "none",
  accent: "#0d9488",
} as const;

export type Avatar = {
  skin: string;
  hair: string;
  hairColor: string;
  accessory: string;
  accent: string;
};

export const SKIN_TONES = ["#f6d7bd", "#e8b48f", "#c98e63", "#a86b43", "#7b4a2d", "#5a3420"];
export const HAIR_COLORS = ["#1c1410", "#3b2a20", "#6b4a2f", "#a8742e", "#c9a35a", "#8a8a8a", "#7b2d4e", "#2f4f7a"];
export const HAIR_STYLES = [
  { id: "hair-short", label: "Curto" },
  { id: "hair-long", label: "Longo" },
  { id: "hair-curly", label: "Cacheado" },
  { id: "hair-bun", label: "Coque" },
  { id: "hair-none", label: "Careca" },
];
export const ACCESSORIES = [
  { id: "none", label: "Nenhum" },
  { id: "glasses-round", label: "Óculos redondos" },
  { id: "glasses-square", label: "Óculos quadrados" },
];
export const ACCENTS = ["#0d9488", "#6366f1", "#e11d48", "#d97706", "#0284c7", "#7c3aed"];

export function parseAvatar(json: string | null | undefined): Avatar {
  try {
    return { ...AVATAR_DEFAULT, ...(json ? JSON.parse(json) : {}) };
  } catch {
    return { ...AVATAR_DEFAULT };
  }
}

export const VOICE_GENDER: Record<string, "f" | "m"> = {
  marin: "f",
  cedar: "m",
  coral: "f",
  sage: "f",
  ash: "m",
  verse: "m",
};
