import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number, opts: object) => Promise<Buffer>;
// OWASP: scrypt N=2^17, r=8, p=1 (≈128 MiB). Usamos N=2^15 (32 MiB) para caber em contêineres pequenos.
const PARAMS = { N: 2 ** 15, r: 8, p: 1, maxmem: 128 * 1024 * 1024 };

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, 64, PARAMS);
  return `scrypt$${PARAMS.N}$${salt.toString("hex")}$${key.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, n, saltHex, keyHex] = stored.split("$");
  if (scheme !== "scrypt" || !n || !saltHex || !keyHex) return false;
  const expected = Buffer.from(keyHex, "hex");
  const actual = await scrypt(password, Buffer.from(saltHex, "hex"), expected.length, { ...PARAMS, N: Number(n) });
  return timingSafeEqual(actual, expected);
}

// Hash descartável para gastar o mesmo tempo quando o e-mail não existe (evita enumeração por tempo de resposta).
let dummy: Promise<string> | null = null;
export const dummyVerify = async (password: string) => {
  dummy ??= hashPassword("dummy-password-for-timing");
  await verifyPassword(password, await dummy);
  return false;
};

/** Política: mínimo de 10 caracteres, não pode ser só números nem uma senha muito comum. */
const COMMON = new Set(["1234567890", "0123456789", "password123", "senha12345", "senha123456", "qwertyuiop", "1q2w3e4r5t", "abcd123456", "admin12345", "percurso123"]);
export function passwordProblem(pw: string): string | null {
  if (pw.length < 10) return "A senha precisa ter pelo menos 10 caracteres.";
  if (pw.length > 200) return "Senha longa demais.";
  if (/^\d+$/.test(pw)) return "A senha não pode ser só números.";
  if (COMMON.has(pw.toLowerCase())) return "Essa senha é muito comum. Escolha outra.";
  if (new Set(pw).size < 5) return "A senha é muito repetitiva.";
  return null;
}
