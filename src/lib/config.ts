const num = (v: string | undefined, d: number) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : d;
};

export const config = {
  openaiKey: () => process.env.OPENAI_API_KEY ?? "",
  mock: () => process.env.MOCK_AI === "1" || !process.env.OPENAI_API_KEY,
  chatModel: () => process.env.OPENAI_CHAT_MODEL || "gpt-4.1",
  fastModel: () => process.env.OPENAI_FAST_MODEL || "gpt-4.1-mini",
  realtimeModel: () => process.env.OPENAI_REALTIME_MODEL || "gpt-realtime-mini",
  sessionMaxMinutes: () => num(process.env.SESSION_MAX_MINUTES, 60),
  callsPerDay: () => num(process.env.CALLS_PER_DAY, 1),
  chatPerDay: () => num(process.env.CHAT_MESSAGES_PER_DAY, 80),
  timezone: "America/Sao_Paulo",
};

/** Versão dos prompts: gravada em cada sessão para auditoria. Suba ao editar qualquer prompt. */
export const PROMPT_VERSION = "2026.10.13-3";
export const APP_NAME = "Percurso";
