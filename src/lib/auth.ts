import { randomBytes } from "node:crypto";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "./prisma";
import { decSafe, sha256 } from "./crypto";

const IS_HTTPS = (process.env.APP_URL ?? "").startsWith("https://");
const COOKIE = IS_HTTPS ? "__Host-percurso" : "percurso_session"; // __Host- exige Secure, Path=/ e sem Domain
const PATIENT_TTL_MS = 7 * 24 * 3600_000;
const ADMIN_TTL_MS = 8 * 3600_000;
const PENDING_TTL_MS = 10 * 60_000;

export type User = {
  id: number;
  email: string;
  name: string;
  role: "admin" | "patient";
  status: string;
  onboarded: boolean;
  consent_at: Date | null;
  calls_per_day: number | null;
  totp_enabled: boolean;
  created_at: Date;
};

export const requireAdmin2fa = () => process.env.ADMIN_REQUIRE_2FA !== "0" && process.env.NODE_ENV === "production";

/** Cria uma sessão revogável (o token só existe no cookie; no banco fica o hash). */
export async function createSession(userId: number, role: string, opts: { pending2fa?: boolean; ip?: string; ua?: string | null }) {
  const token = randomBytes(32).toString("base64url");
  const ttl = opts.pending2fa ? PENDING_TTL_MS : role === "admin" ? ADMIN_TTL_MS : PATIENT_TTL_MS;
  await prisma.authSession.create({
    data: { id: sha256(token), user_id: userId, pending_2fa: !!opts.pending2fa, ip: opts.ip ?? null, user_agent: opts.ua?.slice(0, 200) ?? null, expires_at: new Date(Date.now() + ttl) },
  });
  (await cookies()).set(COOKIE, token, { httpOnly: true, sameSite: "strict", secure: IS_HTTPS, path: "/", maxAge: Math.floor(ttl / 1000) });
  return token;
}

export async function readToken(): Promise<string | undefined> {
  return (await cookies()).get(COOKIE)?.value;
}

export async function destroySession() {
  const t = await readToken();
  if (t) await prisma.authSession.deleteMany({ where: { id: sha256(t) } });
  (await cookies()).delete(COOKIE);
}

/** Encerra todas as sessões de um usuário (troca de senha, suspensão, 2FA alterado). */
export const revokeAllSessions = (userId: number) => prisma.authSession.deleteMany({ where: { user_id: userId } });

async function load(token: string | undefined, allowPending: boolean) {
  if (!token || token.length < 32 || token.length > 128) return null;
  const s = await prisma.authSession.findUnique({ where: { id: sha256(token) }, include: { user: true } });
  if (!s || s.expires_at < new Date()) return null;
  if (s.pending_2fa && !allowPending) return null;
  const u = s.user;
  if (u.status !== "active") return null;
  if (Date.now() - s.last_seen_at.getTime() > 5 * 60_000) void prisma.authSession.update({ where: { id: s.id }, data: { last_seen_at: new Date() } }).catch(() => {});
  return { session: s, user: u };
}

const toUser = (u: NonNullable<Awaited<ReturnType<typeof load>>>["user"]): User => ({
  id: u.id, email: u.email, name: u.name, role: u.role as User["role"], status: u.status, onboarded: u.onboarded, consent_at: u.consent_at, calls_per_day: u.calls_per_day, totp_enabled: u.totp_enabled, created_at: u.created_at,
});

export const currentUser = cache(async (): Promise<User | null> => {
  const r = await load(await readToken(), false);
  return r ? toUser(r.user) : null;
});

/** Usuário com senha validada, mas ainda sem o código 2FA. */
export async function pendingUser() {
  const r = await load(await readToken(), true);
  return r && r.session.pending_2fa ? { user: r.user, sessionId: r.session.id } : null;
}

export async function promoteSession(sessionId: string, role: string) {
  const ttl = role === "admin" ? ADMIN_TTL_MS : PATIENT_TTL_MS;
  await prisma.authSession.update({ where: { id: sessionId }, data: { pending_2fa: false, expires_at: new Date(Date.now() + ttl), last_seen_at: new Date() } });
  const token = await readToken();
  if (token) (await cookies()).set(COOKIE, token, { httpOnly: true, sameSite: "strict", secure: IS_HTTPS, path: "/", maxAge: Math.floor(ttl / 1000) });
}

export async function requireUser(): Promise<User> {
  const u = await currentUser();
  if (!u) redirect("/entrar");
  return u;
}

export async function requireAdmin(opts: { skip2fa?: boolean } = {}): Promise<User> {
  const u = await requireUser();
  if (u.role !== "admin") redirect("/app");
  if (!opts.skip2fa && requireAdmin2fa() && !u.totp_enabled) redirect("/admin/seguranca");
  return u;
}

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
  if (u.role === "admin" && requireAdmin2fa() && !u.totp_enabled) return null;
  return u;
}

export async function requestIp(): Promise<string> {
  const h = await headers();
  if (process.env.TRUST_PROXY === "1") return h.get("x-forwarded-for")?.split(",")[0]?.trim().slice(0, 64) ?? "direct";
  return "direct";
}

export { decSafe };
