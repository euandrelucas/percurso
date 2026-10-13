import { createCipheriv, createDecipheriv, createHash, randomBytes, scryptSync } from "node:crypto";

/**
 * Criptografia em nível de campo (AES-256-GCM) para dados clínicos: transcrições, memória, análises, relatórios, alertas.
 * Formato: enc:v1:<iv>:<tag>:<ciphertext> (base64url). O "rótulo" entra como AAD: um texto cifrado não pode ser
 * copiado de uma coluna para outra sem falhar a autenticação.
 */
let cached: Buffer | null = null;

function key(): Buffer {
  if (cached) return cached;
  const raw = process.env.ENCRYPTION_KEY?.trim();
  if (raw) {
    const buf = /^[0-9a-f]{64}$/i.test(raw) ? Buffer.from(raw, "hex") : Buffer.from(raw, "base64");
    if (buf.length !== 32) throw new Error("ENCRYPTION_KEY deve ter 32 bytes (64 hex ou base64).");
    return (cached = buf);
  }
  if (process.env.NODE_ENV === "production") throw new Error("ENCRYPTION_KEY ausente em produção.");
  // Somente desenvolvimento/testes: deriva uma chave fraca e estável.
  return (cached = scryptSync(process.env.AUTH_SECRET || "dev-insecure", "percurso-dev-salt", 32));
}

export function enc(plain: string | null | undefined, label: string): string | null {
  if (plain === null || plain === undefined) return null;
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv);
  c.setAAD(Buffer.from(label));
  const ct = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return `enc:v1:${iv.toString("base64url")}:${c.getAuthTag().toString("base64url")}:${ct.toString("base64url")}`;
}

export function dec(value: string | null | undefined, label: string): string | null {
  if (value === null || value === undefined) return null;
  if (!value.startsWith("enc:v1:")) return value; // dado legado em texto puro
  const [, , iv, tag, ct] = value.split(":");
  const d = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url"));
  d.setAAD(Buffer.from(label));
  d.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([d.update(Buffer.from(ct, "base64url")), d.final()]).toString("utf8");
}

/** Decifra sem lançar (para telas que não devem quebrar por um registro corrompido). */
export function decSafe(value: string | null | undefined, label: string): string {
  try {
    return dec(value, label) ?? "";
  } catch {
    return "[conteúdo ilegível: chave de criptografia diferente]";
  }
}

export const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
