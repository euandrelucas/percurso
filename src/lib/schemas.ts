import { z } from "zod";

const email = z.string().trim().toLowerCase().email().max(120);
const text = (max: number) => z.string().trim().max(max);

export const registerSchema = z.object({
  code: z.string().trim().toUpperCase().min(6).max(40),
  name: z.string().trim().min(2).max(80),
  email,
  password: z.string().min(1).max(200),
});
export const loginSchema = z.object({ email, password: z.string().min(1).max(200) });
export const totpSchema = z.object({ code: z.string().trim().regex(/^\d{6}$/) });
export const passwordChangeSchema = z.object({ current: z.string().min(1).max(200), next: z.string().min(1).max(200) });

const scale = z.array(z.number().int().min(0).max(3)).length(2);
export const onboardingSchema = z
  .object({ consent: z.literal(true), adult: z.literal(true), phq2: scale, gad2: scale, selfHarm: z.enum(["sim", "nao"]) })
  .catchall(z.unknown()); // os campos do agente são normalizados por parseAgentInput (lista de opções permitidas)

export const moodSchema = z.object({ score: z.number().int().min(0).max(10), note: text(280).optional() });
export const exerciseSchema = z.object({ status: z.enum(["feito", "pendente"]), feedback: text(400).optional() });
export const chatSchema = z.object({ text: z.string().trim().min(1).max(2000) });
export const turnSchema = z.object({ role: z.enum(["user", "assistant"]), text: z.string().trim().min(1).max(4000), injected: z.array(z.string().max(60)).max(40).optional() });
export const riskSchema = z.object({ nivel: z.coerce.number().int().min(1).max(3), motivo: text(400).default("") });
export const endSchema = z.object({ reason: z.enum(["agente", "paciente", "tempo", "falha_tecnica"]).default("paciente") });
export const feedbackSchema = z.object({ rating: z.number().int().min(1).max(3), note: z.string().trim().max(600).optional().default("") });
export const demoChatSchema = z.object({ text: z.string().trim().min(1).max(2000) });

export const inviteCreateSchema = z.object({ label: text(80).optional(), count: z.coerce.number().int().min(1).max(20).default(1), expiresInDays: z.coerce.number().int().min(0).max(365).optional() });
export const inviteRevokeSchema = z.object({ id: z.number().int() });
export const userActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("suspend") }),
  z.object({ action: z.literal("reactivate") }),
  z.object({ action: z.literal("calls_per_day"), value: z.number().int().min(0).max(10).nullable() }),
]);
export const alertActionSchema = z.object({ status: z.enum(["resolvido", "em_acompanhamento"]), note: text(500).optional() });
