import { ACCENTS, FORMALITIES, HAIR_COLORS, HAIR_STYLES, HUMORS, PACES, SKIN_TONES, STYLES, TONES, ACCESSORIES, VOICES, type Avatar, AVATAR_DEFAULT } from "./prompts/options";
import { str } from "./api";

const oneOf = <T extends string>(v: unknown, allowed: readonly T[], d: T): T => (typeof v === "string" && (allowed as readonly string[]).includes(v) ? (v as T) : d);

/** Valida e normaliza a personalização do agente vinda do cliente (nada vai para o prompt sem passar por aqui). */
export function parseAgentInput(b: Record<string, unknown>) {
  const av = (b.avatar ?? {}) as Record<string, unknown>;
  const avatar: Avatar = {
    skin: oneOf(av.skin, SKIN_TONES, AVATAR_DEFAULT.skin),
    hair: oneOf(av.hair, HAIR_STYLES.map((h) => h.id), AVATAR_DEFAULT.hair),
    hairColor: oneOf(av.hairColor, HAIR_COLORS, AVATAR_DEFAULT.hairColor),
    accessory: oneOf(av.accessory, ACCESSORIES.map((a) => a.id), AVATAR_DEFAULT.accessory),
    accent: oneOf(av.accent, ACCENTS, AVATAR_DEFAULT.accent),
  };
  return {
    preferred_name: str(b.preferred_name, 40),
    agent_name: str(b.agent_name, 30) || "Alma",
    voice: oneOf(b.voice, VOICES.map((v) => v.id), "marin"),
    tone: oneOf(b.tone, Object.keys(TONES), "acolhedor"),
    style: oneOf(b.style, Object.keys(STYLES), "equilibrado"),
    formality: oneOf(b.formality, Object.keys(FORMALITIES), "informal"),
    humor: oneOf(b.humor, Object.keys(HUMORS), "leve"),
    pace: oneOf(b.pace, Object.keys(PACES), "normal"),
    avatar: JSON.stringify(avatar),
    about_me: str(b.about_me, 600),
    topics: str(b.topics, 400),
    boundaries: str(b.boundaries, 400),
    goal_hint: str(b.goal_hint, 400),
  };
}

export type AgentInput = ReturnType<typeof parseAgentInput>;
