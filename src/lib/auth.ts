import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { get } from "./db";

const COOKIE = "percurso_session";
const MAX_AGE = 60 * 60 * 24 * 14;

export type User = {
  id: number;
  email: string;
  name: string;
  role: "admin" | "patient";
  status: string;
  onboarded: number;
  consent_at: string | null;
  calls_per_day: number | null;
  created_at: string;
};

function secret(): string {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 16) {
    if (process.env.NODE_ENV === "production") throw new Error("AUTH_SECRET ausente ou curto demais");
    return "dev-insecure-secret-change-me";
  }
  return s;
}

const sign = (payload: string) => createHmac("sha256", secret()).update(payload).digest("base64url");

export function makeToken(uid: number): string {
  const payload = Buffer.from(JSON.stringify({ uid, exp: Math.floor(Date.now() / 1000) + MAX_AGE })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

function readToken(token: string | undefined): number | null {
  if (!token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const { uid, exp } = JSON.parse(Buffer.from(payload, "base64url").toString());
    return typeof uid === "number" && exp > Date.now() / 1000 ? uid : null;
  } catch {
    return null;
  }
}

export async function setSessionCookie(uid: number) {
  (await cookies()).set(COOKIE, makeToken(uid), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function clearSessionCookie() {
  (await cookies()).delete(COOKIE);
}

export async function currentUser(): Promise<User | null> {
  const uid = readToken((await cookies()).get(COOKIE)?.value);
  if (!uid) return null;
  const u = get<User>("SELECT id,email,name,role,status,onboarded,consent_at,calls_per_day,created_at FROM users WHERE id = ?", uid);
  return u && u.status === "active" ? u : null;
}

/** Para páginas: redireciona se não houver sessão. */
export async function requireUser(): Promise<User> {
  const u = await currentUser();
  if (!u) redirect("/entrar");
  return u;
}

export async function requireAdmin(): Promise<User> {
  const u = await requireUser();
  if (u.role !== "admin") redirect("/app");
  return u;
}

/** Para páginas de paciente: exige onboarding concluído. */
export async function requirePatient(): Promise<User> {
  const u = await requireUser();
  if (u.role === "admin") redirect("/admin");
  if (!u.onboarded) redirect("/onboarding");
  return u;
}

/** Para rotas de API: retorna null em vez de redirecionar. */
export async function apiUser(role?: "admin" | "patient"): Promise<User | null> {
  const u = await currentUser();
  if (!u) return null;
  if (role && u.role !== role) return null;
  return u;
}
