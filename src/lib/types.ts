export type Agent = {
  user_id: number;
  preferred_name: string;
  agent_name: string;
  voice: string;
  tone: string;
  style: string;
  formality: string;
  humor: string;
  pace: string;
  avatar: string;
  about_me: string;
  topics: string;
  boundaries: string;
  goal_hint: string;
};

export type CaseMemory = {
  queixa_principal: string;
  contexto_de_vida: string;
  historico_relevante: string;
  padroes: string[];
  forcas_e_recursos: string[];
  o_que_funciona: string[];
  o_que_evitar: string[];
  temas_recorrentes: string[];
  rede_de_apoio: string;
  preferencias_de_comunicacao: string;
};

export const EMPTY_MEMORY: CaseMemory = {
  queixa_principal: "",
  contexto_de_vida: "",
  historico_relevante: "",
  padroes: [],
  forcas_e_recursos: [],
  o_que_funciona: [],
  o_que_evitar: [],
  temas_recorrentes: [],
  rede_de_apoio: "",
  preferencias_de_comunicacao: "",
};

export type Hypothesis = { texto: string; confianca: "baixa" | "media" | "alta" };

export type SessionAnalysis = {
  resumo: string;
  temas: string[];
  emocoes_predominantes: string[];
  humor_estimado_inicio: number | null;
  humor_estimado_fim: number | null;
  risco: { nivel: number; evidencias: string[] };
  fatos_observados: string[];
  hipoteses: Hypothesis[];
  tecnicas_usadas: string[];
  exercicio: { titulo: string; descricao: string } | null;
  metas: { titulo: string; status: "nova" | "em_andamento" | "atingida" | "abandonada" }[];
  pontos_para_proxima_sessao: string[];
  abertura_sugerida: string;
  para_o_profissional: string;
  memoria_atualizada: CaseMemory;
};

export type ReportData = {
  titulo: string;
  gerado_em: string;
  identificacao: string;
  motivo_da_busca: string;
  triagem: string;
  evolucao: string;
  temas_principais: string[];
  fatos_observados: string[];
  hipoteses: Hypothesis[];
  metas_e_exercicios: string;
  riscos_e_alertas: string;
  adesao_e_engajamento: string;
  recomendacoes_ao_profissional: string[];
  limitacoes: string;
};

export type Session = {
  id: number;
  user_id: number;
  number: number;
  kind: "triagem" | "acompanhamento";
  status: "active" | "ended";
  started_at: string;
  ended_at: string | null;
  duration_sec: number | null;
  end_reason: string | null;
  max_minutes: number;
  prompt_version: string | null;
  mood_start: number | null;
  mood_end: number | null;
  analysis: string | null;
};

export type Message = {
  id: number;
  user_id: number;
  session_id: number | null;
  channel: "voice" | "chat";
  role: "user" | "assistant" | "system";
  content: string;
  created_at: string;
};
